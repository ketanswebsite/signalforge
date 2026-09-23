/**
 * GAPS #21 - a monthly AI sweep that dies part-way is picked up again, and the owner
 * hears how every run ended (ml/conviction-sweep.js).
 *
 * The sweep runs for about four hours inside the web process. On production the
 * 2026-08-22 and 08-29 runs stopped writing part-way (1,655 and 2,022 of 5,029 symbols)
 * with no deploy that morning, and nothing noticed: the in-memory status died with the
 * process, and nothing after a restart looked back.
 *
 * Pinned down here:
 *   1. isSweepDay(): the FIRST Saturday of the month on the UK clock, including the
 *      BST/GMT edges where the UTC date says something else.
 *   2. resumeInterruptedSweep(), a restart:
 *      - on sweep day after 08:00 it picks the run up and scores ONLY what is not stored
 *        yet - nothing this run already paid for is paid for again;
 *      - never on another day, before the 08:00 cron, with CONVICTION_SWEEP=false or
 *        CONVICTION_SWEEP_BOOT_RESUME=false, or while a sweep runs in this process;
 *      - fails closed when conviction_daily cannot be read (an empty skip list would
 *        re-score, and pay for, the whole universe);
 *      - waits while another process is still writing verdicts (after a deploy the old
 *        process sweeps on until Render kills it), and scheduleResumeCheck() looks again.
 *   3. runConvictionSweep() refuses to start without its skip list - and says so.
 *   4. The owner report: a start message and an end message with the tally, the duration
 *      and the coverage read back from the TABLE (SHORT when symbols are left), plus a
 *      line when Gemini failed and verdicts were stored rule-based (what 2026-08-29 did);
 *      sent to ADMIN_EMAIL's linked chat only, retried as plain text, never fatal to the
 *      sweep, and off with CONVICTION_SWEEP_ALERTS=false.
 *   5. The rails around the owner's shouldResumeSweep() policy.
 *   6. getVerdictStats(days, { day }) adds one date's writes per 10 minutes.
 *
 * "The shipped policy" block describes shouldResumeSweep() as shipped - if you reshape
 * that function, that block is the one to edit with it. Everything else holds whatever
 * the policy decides.
 */

process.env.CONVICTION_SWEEP_DELAY_MS = '1';   // read once, when the sweep module loads

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, getUserChatId: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../lib/shared/stock-data', () => ({ getAllStocks: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    sendTelegramAlert: jest.fn(),
    broadcastToSubscribers: jest.fn()
}));

const axios = require('axios');
const db = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const StockData = require('../../lib/shared/stock-data');
const OwnerAlerts = require('../../lib/portfolio/close-failure-alerts');
const Sweep = require('../../ml/conviction-sweep');

const DAY_MS = 24 * 60 * 60 * 1000;
const day = ageDays => new Date(Date.now() - ageDays * DAY_MS).toISOString().split('T')[0];

// The UK clock a restart is judged by. 2026-10-03 is the first Saturday of October (BST).
const SWEEP_DAY_10AM = new Date('2026-10-03T09:00:00Z');   // Sat 3 Oct, 10:00 UK
const SWEEP_DAY_0730 = new Date('2026-10-03T06:30:00Z');   // 07:30 UK: the 08:00 cron has not fired yet
const SECOND_SATURDAY = new Date('2026-10-10T09:00:00Z');
const WEDNESDAY = new Date('2026-09-23T12:00:00Z');

const ENV = ['CONVICTION_SWEEP', 'CONVICTION_SWEEP_BOOT_RESUME', 'CONVICTION_SWEEP_ALERTS', 'CONVICTION_SWEEP_FRESH',
    'CONVICTION_SWEEP_RESUME_DAYS', 'CONVICTION_MAX_AGE_DAYS', 'CONVICTION_CACHE_TTL_MIN', 'GEMINI_API_KEY',
    'PRICE_UNIT_REPAIR', 'ADMIN_EMAIL'];
const envAtStart = Object.fromEntries(ENV.map(k => [k, process.env[k]]));

/** A verdict as the engine stored it `ageDays` ago */
function storedVerdict(symbol, ageDays) {
    return {
        success: true, symbol, name: symbol, confidence: 7.1, verdict: 'GO', engine: 'rule-based', summary: null,
        pillars: {
            technical: { score: 9, evidence: ['stored'], weight: 45 },
            fundamental: { score: 5, evidence: ['stored'], weight: 30 },
            information: { score: 6, evidence: ['stored'], weight: 25 }
        },
        context: { winRate: null },
        generatedAt: new Date(Date.now() - ageDays * DAY_MS).toISOString()
    };
}

/**
 * conviction_daily, in memory. Answers the statements the sweep and the engine send,
 * honours the primary key the way Postgres does (DO NOTHING keeps the row, DO UPDATE
 * replaces it) and keeps created_at, so "is anyone still writing?" can be asked.
 * Seed rows are [symbol, ageDays, secondsSinceWritten] - written an hour ago by default.
 */
function verdictTable(seed = []) {
    const rows = new Map();                                   // "SYMBOL|YYYY-MM-DD" -> { payload, createdAt }
    const key = (symbol, date) => `${symbol}|${date}`;
    for (const [symbol, ageDays, secondsAgo = 3600] of seed) {
        rows.set(key(symbol, day(ageDays)), { payload: storedVerdict(symbol, ageDays), createdAt: Date.now() - secondsAgo * 1000 });
    }
    const since = cutoff => [...rows.entries()].filter(([k]) => k.split('|')[1] >= cutoff);

    db.pool.query.mockImplementation(async (sql, params) => {
        if (/^\s*SELECT payload/.test(sql)) {
            const [symbol, cutoff] = params;
            const newest = since(cutoff).filter(([k]) => k.startsWith(`${symbol}|`)).sort(([a], [b]) => a.localeCompare(b)).pop();
            return { rows: newest ? [{ payload: newest[1].payload }] : [] };
        }
        if (/^\s*INSERT INTO conviction_daily/.test(sql)) {
            const [symbol, date, , , , json] = params;
            if (!rows.has(key(symbol, date)) || /DO UPDATE/.test(sql)) {
                rows.set(key(symbol, date), { payload: JSON.parse(json), createdAt: Date.now() });
            }
            return { rowCount: 1 };
        }
        if (/SELECT DISTINCT symbol/.test(sql)) {
            const [cutoff] = params;
            return { rows: [...new Set(since(cutoff).map(([k]) => k.split('|')[0]))].map(symbol => ({ symbol })) };
        }
        if (/LOCALTIMESTAMP - max\(created_at\)/.test(sql)) {
            const [cutoff] = params;
            const newest = Math.max(...since(cutoff).map(([, row]) => row.createdAt));
            return { rows: [{ age: Number.isFinite(newest) ? Math.floor((Date.now() - newest) / 1000) : null }] };
        }
        throw new Error(`verdictTable: unexpected statement: ${sql}`);
    });

    return { today: symbol => (rows.get(key(symbol, day(0))) || {}).payload };
}

/** 60 rising daily bars: the technical pillar scores well above neutral, so the verdict is storable */
function risingChart() {
    const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.004, i));
    return {
        meta: {},
        timestamp: closes.map((_, i) => 1789714800 - (59 - i) * 86400),
        indicators: { quote: [{
            open: closes.map(c => c * 0.995), high: closes.map(c => c * 1.01), low: closes.map(c => c * 0.99),
            close: closes, volume: closes.map(() => 100000)
        }] }
    };
}

const CHART = '/v8/finance/chart/';
const chartSymbol = url => decodeURIComponent(String(url).split(CHART)[1] || '');

// restoreMocks wipes jest.fn() implementations before every test, so each test installs its own.
// Price history answers (except for `blind` symbols); fundamentals and news are refused and
// score neutral on their own - so a blind symbol comes back all-neutral, and is not stored.
function sourcesUp(...blind) {
    axios.get.mockImplementation(async url => {
        if (String(url).includes(CHART) && !blind.includes(chartSymbol(url))) {
            return { data: { chart: { result: [risingChart()] } } };
        }
        throw new Error('refused by test');
    });
}
/** The symbols the engine really scored, in request order */
const scoredSymbols = () => axios.get.mock.calls.map(([url]) => url).filter(url => String(url).includes(CHART)).map(chartSymbol);

const universe = (...symbols) => StockData.getAllStocks.mockReturnValue(symbols.map(symbol => ({ symbol, name: symbol })));

function ownerLinked(chatId = '4242') {
    db.getUserChatId.mockResolvedValue(chatId);
    telegramBot.sendTelegramAlert.mockResolvedValue(true);
}
const sentMessages = () => telegramBot.sendTelegramAlert.mock.calls.map(([, alert]) => alert.message);
const logged = () => console.log.mock.calls.flat().join('\n');

beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    // The shared owner sender remembers the last good chat id (a failing database answers null)
    OwnerAlerts.reset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
});

afterAll(() => {
    for (const k of ENV) {
        if (envAtStart[k] === undefined) delete process.env[k];
        else process.env[k] = envAtStart[k];
    }
});

// The engine keeps a per-symbol memory cache for the life of the module, so every test
// uses symbols of its own.

describe('isSweepDay - the first Saturday of the month, on the UK clock', () => {
    test.each([
        ['2026-10-03T09:00:00Z', true, 'Sat 3 Oct (BST)'],
        ['2026-11-07T08:30:00Z', true, 'Sat 7 Nov (GMT): day 7 is still the first Saturday'],
        ['2026-08-01T09:00:00Z', true, 'Sat 1 Aug'],
        ['2026-08-08T09:00:00Z', false, 'Sat 8 Aug: the second Saturday'],
        ['2026-10-10T09:00:00Z', false, 'Sat 10 Oct'],
        ['2026-09-23T12:00:00Z', false, 'a Wednesday'],
        ['2026-10-02T23:30:00Z', true, 'still Friday in UTC, already Sat 3 Oct 00:30 in the UK'],
        ['2026-10-03T23:30:00Z', false, 'still Saturday in UTC, already Sun 4 Oct 00:30 in the UK']
    ])('%s -> %s (%s)', (iso, expected) => {
        expect(Sweep.isSweepDay(new Date(iso))).toBe(expected);
    });
});

describe('resumeInterruptedSweep - a restart on sweep day', () => {
    test('picks the run up again and scores ONLY what this run has not stored', async () => {
        const table = verdictTable([['DONE1.L', 0], ['DONE2.L', 0]]);
        universe('DONE1.L', 'DONE2.L', 'LEFT1.L', 'LEFT2.L');
        sourcesUp();
        ownerLinked();

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });
        expect(decision).toMatchObject({ resumed: true, remaining: 2 });
        const result = await decision.run;

        expect(result).toMatchObject({ trigger: 'resume', total: 4, scored: 2, skipped: 2, reused: 0, remaining: 0 });
        expect(scoredSymbols().sort()).toEqual(['LEFT1.L', 'LEFT2.L']);
        expect(table.today('LEFT1.L')).toBeDefined();
        expect(table.today('DONE1.L').pillars.technical.evidence).toEqual(['stored']);   // not paid for twice
    });

    test.each([
        ['CONVICTION_SWEEP=false', { CONVICTION_SWEEP: 'false' }, SWEEP_DAY_10AM, /CONVICTION_SWEEP=false/],
        ['CONVICTION_SWEEP_BOOT_RESUME=false', { CONVICTION_SWEEP_BOOT_RESUME: 'false' }, SWEEP_DAY_10AM, /BOOT_RESUME=false/],
        ['an ordinary deploy on a Wednesday', {}, WEDNESDAY, /not sweep day/],
        ['a deploy on the second Saturday', {}, SECOND_SATURDAY, /not sweep day/],
        ['a restart at 07:30 UK - the 08:00 cron starts the run', {}, SWEEP_DAY_0730, /before 8:00 UK/]
    ])('never on %s - and not even a table read', async (_, env, now, reason) => {
        Object.assign(process.env, env);
        verdictTable();
        universe('RAIL1.L', 'RAIL2.L');
        sourcesUp();
        ownerLinked();

        const decision = await Sweep.resumeInterruptedSweep({ now });

        expect(decision).toMatchObject({ resumed: false, reason: expect.stringMatching(reason) });
        expect(db.pool.query).not.toHaveBeenCalled();
        expect(axios.get).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });

    test('never a second run in this process: the monthly cron is already sweeping', async () => {
        verdictTable();
        universe('CRON1.L', 'CRON2.L');
        sourcesUp();
        ownerLinked();

        const cronRun = Sweep.runConvictionSweep({ trigger: 'monthly' });
        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });
        await cronRun;

        expect(decision).toMatchObject({ resumed: false, reason: expect.stringMatching(/already running/) });
        expect(scoredSymbols().sort()).toEqual(['CRON1.L', 'CRON2.L']);        // each scored once
        // and it did not even ask the table: only the restart check asks who wrote last
        expect(db.pool.query.mock.calls.filter(([sql]) => /LOCALTIMESTAMP/.test(sql))).toHaveLength(0);
    });

    test('nor when the cron starts while the restart check is reading the table', async () => {
        verdictTable();
        universe('RACE1.L', 'RACE2.L');
        sourcesUp();
        ownerLinked();

        const pending = Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });   // parked on its first read
        const cronRun = Sweep.runConvictionSweep({ trigger: 'monthly' });        // 08:00 fires meanwhile
        const decision = await pending;
        await cronRun;

        expect(decision.resumed).toBe(false);
        expect(scoredSymbols().sort()).toEqual(['RACE1.L', 'RACE2.L']);        // each scored once
    });

    test('fails closed when conviction_daily cannot be read: an empty skip list would pay for everything', async () => {
        db.pool.query.mockRejectedValue(new Error('Connection terminated unexpectedly'));
        universe('DARK1.L', 'DARK2.L');
        sourcesUp();
        ownerLinked();

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });

        expect(decision).toMatchObject({ resumed: false, reason: expect.stringMatching(/could not be read/) });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('waits while another process is still writing verdicts - a deploy\'s old process', async () => {
        verdictTable([['BUSY1.L', 0, 30]]);                   // written 30 seconds ago
        universe('BUSY1.L', 'BUSY2.L');
        sourcesUp();
        ownerLinked();

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });

        expect(decision).toMatchObject({ resumed: false, retry: true, remaining: 1 });
        expect(decision.reason).toMatch(/written 30s ago/);
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('leaves a run that covered the universe alone', async () => {
        verdictTable([['FULL1.L', 0], ['FULL2.L', 3]]);
        universe('FULL1.L', 'FULL2.L');
        sourcesUp();

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM });

        expect(decision).toMatchObject({ resumed: false, remaining: 0, reason: expect.stringMatching(/covered/) });
        expect(axios.get).not.toHaveBeenCalled();
    });
});

describe('scheduleResumeCheck - the boot hook', () => {
    test('looks once, a while after boot, and says what it decided', async () => {
        jest.useFakeTimers({ now: WEDNESDAY });
        verdictTable();
        universe('BOOT1.L');

        Sweep.scheduleResumeCheck(60 * 1000);
        await jest.advanceTimersByTimeAsync(59 * 1000);
        expect(logged()).not.toMatch(/Restart check/);
        await jest.advanceTimersByTimeAsync(1000);

        expect(logged()).toMatch(/Restart check: not sweep day/);
        expect(jest.getTimerCount()).toBe(0);                  // and does not look again
    });

    test('keeps looking while another process writes, then picks the run up', async () => {
        jest.useFakeTimers({ now: SWEEP_DAY_10AM });
        const table = verdictTable([['HAND1.L', 0, 20]]);      // the old process wrote 20 s ago
        universe('HAND1.L', 'HAND2.L');
        sourcesUp();
        ownerLinked();

        Sweep.scheduleResumeCheck(1000);
        await jest.advanceTimersByTimeAsync(1000);
        expect(logged()).toMatch(/another process may still be sweeping/);
        expect(axios.get).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(3 * 60 * 1000);   // the old process is gone by now
        for (let i = 0; i < 20 && Sweep.getSweepStatus().running; i++) await jest.advanceTimersByTimeAsync(50);

        expect(logged()).toMatch(/picking the sweep up again — 1 symbol left/);
        expect(scoredSymbols()).toEqual(['HAND2.L']);
        expect(table.today('HAND2.L')).toBeDefined();
    });
});

describe('runConvictionSweep - no skip list, no sweep', () => {
    test('refuses to start when conviction_daily cannot be read, and tells the owner', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        db.pool.query.mockRejectedValue(new Error('connect ECONNREFUSED'));
        universe('REFUSE1.L');
        sourcesUp();
        ownerLinked();

        const result = await Sweep.runConvictionSweep();

        expect(result).toMatchObject({ started: false, reason: expect.stringMatching(/could not be read/) });
        expect(axios.get).not.toHaveBeenCalled();
        expect(Sweep.getSweepStatus().running).toBe(false);
        expect(sentMessages()).toEqual([expect.stringMatching(/AI SWEEP DID NOT START/)]);
    });
});

describe('the owner report', () => {
    test('a run that covers the universe: STARTED, then FINISHED with tally, coverage and duration', async () => {
        verdictTable([['REP1.L', 0]]);
        universe('REP1.L', 'REP2.L');
        sourcesUp();
        ownerLinked();

        await Sweep.runConvictionSweep({ trigger: 'monthly' });
        const [start, end, ...more] = sentMessages();

        expect(more).toEqual([]);
        expect(start).toMatch(/🧠 \*AI SWEEP STARTED\* — monthly run/);
        expect(start).toMatch(/\*To score:\* 1 of 2 symbols \(skipping 1 with a verdict from the last 14 days\)/);
        expect(end).toMatch(/✅ \*AI SWEEP FINISHED\* — monthly run/);
        expect(end).toMatch(/\*This run:\* 1 scored · 0 reused · 0 blind · 1 skipped · 0 failed/);
        expect(end).toMatch(/\*Covered:\* 2 of 2 symbols hold a verdict from the last 14 days/);
        expect(end).toMatch(/\*Took:\* 0m \(\d\d-\d\d-\d{4} \d\d:\d\d → \d\d-\d\d-\d{4} \d\d:\d\d\)/);
        expect(end).not.toMatch(/SHORT/);
    });

    test('FINISHED SHORT when the table says symbols are left - a blind result stores nothing', async () => {
        verdictTable();
        universe('SHORT1.L', 'SHORT2.L');
        sourcesUp('SHORT2.L');
        ownerLinked();

        const result = await Sweep.runConvictionSweep();
        const end = sentMessages()[1];

        expect(result).toMatchObject({ scored: 1, blind: 1, remaining: 1 });
        expect(Sweep.getSweepStatus().remaining).toBe(1);
        expect(end).toMatch(/⚠️ \*AI SWEEP FINISHED SHORT\* — manual run/);
        expect(end).toMatch(/\*Covered:\* 1 of 2 symbols/);
        expect(end).toMatch(/1 symbol left without a verdict this recent/);
        expect(end).toMatch(/re-fire POST \/api\/ops\/conviction-sweep, which skips what is done/);
    });

    test('a Gemini outage shows: the verdicts stored were rule-based, and a re-fire would skip them', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});      // the engine logs each fallback
        process.env.GEMINI_API_KEY = 'test-key';
        const table = verdictTable();
        universe('NOGEM1.L', 'NOGEM2.L');
        sourcesUp();
        axios.post.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
        ownerLinked();

        const result = await Sweep.runConvictionSweep();
        const end = sentMessages()[1];

        expect(result).toMatchObject({ scored: 2, withoutGemini: 2, remaining: 0 });
        expect(table.today('NOGEM1.L').engine).toBe('rule-based');
        expect(end).toMatch(/✅ \*AI SWEEP FINISHED\*/);                   // covered, so not SHORT
        expect(end).toMatch(/🤖 \*Gemini failed for 2 symbols:\* their stored verdicts are rule-based, and a re-fire within 14 days skips them/);
    });

    test('no Gemini warning while Gemini answers - nor without a key, when rule-based is the design', async () => {
        process.env.GEMINI_API_KEY = 'test-key';
        verdictTable();
        universe('GEMOK1.L');
        sourcesUp();
        const pillar = score => ({ score, evidence: [`${score} from the test`] });
        axios.post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
            technical: pillar(7), fundamental: pillar(6), information: pillar(6), summary: 'fine'
        }) }] } }] } });
        ownerLinked();

        const answered = await Sweep.runConvictionSweep();
        delete process.env.GEMINI_API_KEY;
        universe('NOKEY1.L');
        const keyless = await Sweep.runConvictionSweep();

        expect(answered).toMatchObject({ scored: 1, withoutGemini: 0 });
        expect(keyless).toMatchObject({ scored: 1, withoutGemini: 1 });
        expect(sentMessages().filter(message => /Gemini failed/.test(message))).toEqual([]);
    });

    test('a picked-up run says so', async () => {
        verdictTable([['PICK1.L', 0]]);
        universe('PICK1.L', 'PICK2.L');
        sourcesUp();
        ownerLinked();

        await (await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM })).run;
        const [start, end] = sentMessages();

        expect(start).toMatch(/🔁 \*AI SWEEP PICKED UP AGAIN\* — picked up after a restart/);
        expect(end).toMatch(/✅ \*AI SWEEP FINISHED\* — picked up after a restart/);
    });

    test('goes to the owner only: ADMIN_EMAIL\'s linked chat - never a broadcast, never a fallback chat', async () => {
        process.env.ADMIN_EMAIL = 'owner@example.test';
        verdictTable();
        universe('OWNER1.L');
        sourcesUp();
        ownerLinked('777');

        await Sweep.runConvictionSweep();

        expect(db.getUserChatId).toHaveBeenCalledWith('owner@example.test');
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(2);
        for (const [chatId, alert] of telegramBot.sendTelegramAlert.mock.calls) {
            expect(chatId).toBe('777');
            expect(alert.type).toBe('custom');
        }
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
    });

    test('no linked Telegram: nothing is sent - sendTelegramAlert would fall back to TELEGRAM_CHAT_ID', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const table = verdictTable();
        universe('NOLINK1.L');
        sourcesUp();
        db.getUserChatId.mockResolvedValue(null);

        const result = await Sweep.runConvictionSweep();

        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(result).toMatchObject({ scored: 1, remaining: 0 });
        expect(table.today('NOLINK1.L')).toBeDefined();
    });

    test('Telegram turning the Markdown down: the same report again, plain', async () => {
        verdictTable();
        universe('PLAIN1.L');
        sourcesUp();
        db.getUserChatId.mockResolvedValue('4242');
        telegramBot.sendTelegramAlert.mockResolvedValueOnce(false).mockResolvedValue(true);

        await Sweep.runConvictionSweep();
        const [formatted, plain] = sentMessages();

        expect(formatted).toMatch(/\*AI SWEEP STARTED\*/);
        expect(plain).toMatch(/^🧠 AI SWEEP STARTED — manual run/);
        expect(plain).not.toMatch(/\*/);
    });

    test('a Telegram failure never stops the sweep', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const table = verdictTable();
        universe('TGDOWN1.L');
        sourcesUp();
        db.getUserChatId.mockResolvedValue('4242');
        telegramBot.sendTelegramAlert.mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await Sweep.runConvictionSweep();

        expect(result).toMatchObject({ started: true, scored: 1, remaining: 0 });
        expect(table.today('TGDOWN1.L')).toBeDefined();
        // The owner-alert sender catches the failure itself now (it never rejects) and logs it
        expect(console.error).toHaveBeenCalledWith('❌ [OWNER ALERT] Sending failed:', 'ETIMEDOUT');
    });

    test('CONVICTION_SWEEP_ALERTS=false: no messages at all', async () => {
        process.env.CONVICTION_SWEEP_ALERTS = 'false';
        verdictTable();
        universe('QUIET1.L');
        sourcesUp();
        ownerLinked();

        const result = await Sweep.runConvictionSweep();

        expect(result).toMatchObject({ scored: 1 });
        expect(db.getUserChatId).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });
});

describe('shouldResumeSweep - the shipped policy', () => {
    const state = remaining => ({ remaining, universe: 5029, ukHour: 10, minutesSinceLastWrite: 5 });

    test('picks the run up whenever anything is left', () => {
        expect(Sweep.shouldResumeSweep(state(1))).toBe(true);
        expect(Sweep.shouldResumeSweep(state(3007))).toBe(true);
        expect(Sweep.shouldResumeSweep(state(0))).toBe(false);
    });
});

describe('the rails around shouldResumeSweep', () => {
    function oneLeft(prefix) {
        verdictTable([[`${prefix}1.L`, 0]]);
        universe(`${prefix}1.L`, `${prefix}2.L`);
        sourcesUp();
        ownerLinked();
    }

    test('it sees what it needs to decide', async () => {
        oneLeft('SEES');
        const policy = jest.fn(() => false);

        await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM, policy });

        expect(policy).toHaveBeenCalledWith({ remaining: 1, universe: 2, ukHour: 10, minutesSinceLastWrite: 60 });
    });

    test('a no is obeyed', async () => {
        oneLeft('DECLINE');

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM, policy: () => false });

        expect(decision).toMatchObject({ resumed: false, reason: expect.stringMatching(/declined/) });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test.each([
        ['throws', () => { throw new Error('policy bug'); }],
        ['answers something other than true/false', () => 'yes']
    ])('a policy that %s is replaced by the plain rule', async (_, policy) => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        oneLeft(`BROKEN${policy.length}${String(policy).length}`);

        const decision = await Sweep.resumeInterruptedSweep({ now: SWEEP_DAY_10AM, policy });
        await decision.run;

        expect(decision).toMatchObject({ resumed: true, remaining: 1 });
    });

    test('no policy can resume past a rail', async () => {
        oneLeft('PASTRAIL');

        const decision = await Sweep.resumeInterruptedSweep({ now: WEDNESDAY, policy: () => true });

        expect(decision).toMatchObject({ resumed: false, reason: 'not sweep day' });
        expect(axios.get).not.toHaveBeenCalled();
    });
});

describe('getVerdictStats - one date, per 10 minutes', () => {
    function statsTable() {
        universe('STATS1.L');
        db.pool.query.mockImplementation(async (sql) => {
            if (/date_trunc/.test(sql)) return { rows: [{ at: '07:00', verdicts: 212, gemini: 211, noPriceHistory: 0 }] };
            if (/count\(DISTINCT symbol\)::int AS "symbols"/.test(sql)) return { rows: [{ verdicts: 0, symbols: 0 }] };
            return { rows: [] };
        });
    }
    const timelineQueries = () => db.pool.query.mock.calls.filter(([sql]) => /date_trunc/.test(sql));

    test('only when asked, and only for that date', async () => {
        statsTable();

        const plain = await Sweep.getVerdictStats(30);
        expect(plain.timeline).toBeUndefined();
        expect(timelineQueries()).toHaveLength(0);

        const withDay = await Sweep.getVerdictStats(30, { day: '2026-08-29' });
        expect(withDay.timeline).toEqual({ day: '2026-08-29', buckets: [{ at: '07:00', verdicts: 212, gemini: 211, noPriceHistory: 0 }] });
        expect(timelineQueries()).toHaveLength(1);
        expect(timelineQueries()[0][1]).toEqual(['2026-08-29']);
    });

    test('settings show whether the restart pick-up and the owner reports are on', async () => {
        statsTable();
        process.env.CONVICTION_SWEEP_BOOT_RESUME = 'false';

        const { settings } = await Sweep.getVerdictStats(30);

        expect(settings).toMatchObject({ bootResume: false, ownerReports: true, sweepEnabled: true });
    });
});
