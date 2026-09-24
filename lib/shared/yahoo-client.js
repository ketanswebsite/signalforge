/**
 * Yahoo Finance in process: the one client the server's own modules use.
 *
 * The 7 AM scanner, the high-conviction manager and the exit monitor used to reach Yahoo through
 * this server's own /yahoo/* routes, over HTTP (BASE_URL, else localhost), which is why those
 * routes had to answer anonymous callers. They call these functions directly now, and /yahoo/*
 * serves only the signed-in pages (the Positions chart and the Simulator).
 *
 *   fetchChart(symbol, params)         Yahoo's v8 chart answer, exactly as Yahoo sent it (the
 *                                      conviction engine's technical pillar)
 *   fetchQuoteChart(symbol)            the one-day chart: meta.regularMarketPrice is the live price
 *                                      (GET /yahoo/quote, the exit monitor, the 1 PM executor,
 *                                      POST /api/prices)
 *   fetchHistoryCsv(symbol, range)     daily bars as the CSV GET /yahoo/history serves, through the
 *                                      price-unit and stale-fill repairs (the scanner, the
 *                                      high-conviction manager)
 *   getSession(), invalidateSession()  the cookie and crumb Yahoo's quoteSummary (the conviction
 *                                      engine) and v7 quote endpoints need
 *   fetchQuotes(symbols)               Yahoo's v7 quote for up to 50 symbols (the market caps)
 *
 * Every symbol is URL-encoded into Yahoo's path. Through the proxy the scanner sent
 * ?symbol=M&M.NS unencoded, which Express reads as symbol "M" (Macy's): the ten Indian lines with
 * "&" in their symbol were backtested on another company's chart.
 */
'use strict';

const axios = require('axios');
const { repairYahooChartResult, describeReport, isRepairEnabled: isPriceUnitRepairEnabled } = require('./price-unit-repair');
const staleFillRepair = require('./stale-fill-repair');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const COOKIE_URL = 'https://fc.yahoo.com';
const CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
const QUOTE_BATCH_MAX = 50;
const DEFAULT_TIMEOUT_MS = 45000;
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Yahoo's v8 chart answer for one symbol, as Yahoo sent it. Throws what axios throws (an answer
 * other than 2xx, a timeout).
 * @param {string} symbol
 * @param {object} params   period1, period2, interval, range, includeAdjustedClose: as Yahoo takes them
 * @param {{timeout?: number}} [options]
 */
async function fetchChart(symbol, params, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await axios.get(CHART_URL + encodeURIComponent(symbol), {
    params,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    },
    timeout
  });
  return response.data;
}

/** The one-day chart (interval=1d&range=1d): meta.regularMarketPrice is the live price. */
function fetchQuoteChart(symbol, options) {
  return fetchChart(symbol, { interval: '1d', range: '1d' }, options);
}

// One log line per symbol per process for each repair, whoever asked
const unitRepairsLogged = new Set();
const staleFillsLogged = new Set();

/**
 * Daily bars for one symbol as the CSV GET /yahoo/history serves (Date,Open,High,Low,Close,
 * Adj Close,Volume). The scanner and the high-conviction manager read the very same text in
 * process. Resolves to null when Yahoo has no bars for the symbol.
 *
 * Both repairs run here, so every history reader gets the same bars. Each is detect-only until the
 * owner turns it on (PRICE_UNIT_REPAIR=true, STALE_FILL_REPAIR=true): applying it changes which
 * stocks clear the scanner's >75% win-rate bar.
 *
 * @param {string} symbol
 * @param {{period1?: number|string, period2?: number|string, interval?: string}} [range]  default: the last year, daily
 * @param {{timeout?: number}} [options]
 * @returns {Promise<{csv: string, priceUnitRepair: string|null, staleFillRepair: string|null}|null>}
 *   priceUnitRepair and staleFillRepair are the one-line reports (GET /yahoo/history sends them as
 *   the X-Price-Unit-Repair and X-Stale-Fill-Repair headers), null for a clean series
 */
async function fetchHistoryCsv(symbol, { period1, period2, interval } = {}, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const jsonData = await fetchChart(symbol, {
    period1: period1 || Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60),
    period2: period2 || Math.floor(Date.now() / 1000),
    interval: interval || '1d',
    includeAdjustedClose: true
  }, { timeout });

  if (!jsonData.chart || !jsonData.chart.result || jsonData.chart.result.length === 0) {
    return null;
  }

  const result = jsonData.chart.result[0];
  const timestamps = result.timestamp || [];
  let quotes = result.indicators.quote[0] || {};
  let adjclose = result.indicators.adjclose ? result.indicators.adjclose[0].adjclose : null;
  let priceUnitReport = null;
  let staleFillReport = null;
  // The series in ONE unit, whether or not that repair is the one being served
  let unitView = null;

  // Yahoo steps some lines (mostly London) between pence and pounds inside one series,
  // which a backtest reads as -99% / +9900% days. Every history reader - the scanner, the
  // high-conviction book, the Simulator, the Positions chart - gets these bars, so this is
  // the one place to repair them.
  // Detect-only until PRICE_UNIT_REPAIR=true: applying it changes which stocks clear
  // the scanner's >75% win-rate bar, and that is the owner's call.
  try {
    const unitRepair = repairYahooChartResult(result);
    if (unitRepair.report.status !== 'clean') {
      const enabled = isPriceUnitRepairEnabled();
      const applied = enabled && unitRepair.report.status === 'repaired';
      if (unitRepair.report.status === 'repaired') {
        unitView = { quote: unitRepair.quote, adjclose: unitRepair.adjclose, served: applied };
      }
      if (applied) {
        quotes = unitRepair.quote;
        adjclose = unitRepair.adjclose;
      }
      const summary = `${describeReport(unitRepair.report)}; applied=${applied}`;
      priceUnitReport = summary;
      if (!unitRepairsLogged.has(symbol)) {
        unitRepairsLogged.add(symbol);
        console.log(`[yahoo/history] ${symbol} price units: ${summary}`);
      }
    }
  } catch (repairError) {
    console.warn(`[yahoo/history] ${symbol} price-unit repair failed, serving raw data: ${repairError.message}`);
  }

  // A rarer artefact the unit repair cannot see: no-trade days filled with a price no
  // trade ever printed (HOME.L shows its 38.05p suspension price between trades at 10p).
  // It is judged on the one-unit view so the two repairs never claim the same bar, which
  // also means it can only be served on top of that view. Detect-only until
  // STALE_FILL_REPAIR=true, for the same reason: it changes what the scanner selects.
  try {
    const staleFills = staleFillRepair.repairYahooChartStaleFills(result, unitView);
    if (staleFills.report.status !== 'clean') {
      const onServedView = !unitView || unitView.served;
      const applied = staleFillRepair.isRepairEnabled() && staleFills.report.status === 'repaired' && onServedView;
      if (applied) {
        quotes = staleFills.quote;
        adjclose = staleFills.adjclose;
      }
      const summary = `${staleFillRepair.describeReport(staleFills.report)}; applied=${applied}`;
      staleFillReport = summary;
      if (!staleFillsLogged.has(symbol)) {
        staleFillsLogged.add(symbol);
        console.log(`[yahoo/history] ${symbol} stale fills: ${summary}`);
      }
    }
  } catch (repairError) {
    console.warn(`[yahoo/history] ${symbol} stale-fill repair failed, serving data without it: ${repairError.message}`);
  }

  let csvData = 'Date,Open,High,Low,Close,Adj Close,Volume\n';

  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    const open = quotes.open ? quotes.open[i] || '' : '';
    const high = quotes.high ? quotes.high[i] || '' : '';
    const low = quotes.low ? quotes.low[i] || '' : '';
    const close = quotes.close ? quotes.close[i] || '' : '';
    const adjClose = adjclose ? adjclose[i] || close : close;
    const volume = quotes.volume ? quotes.volume[i] || '' : '';

    csvData += `${date},${open},${high},${low},${close},${adjClose},${volume}\n`;
  }

  return { csv: csvData, priceUnitRepair: priceUnitReport, staleFillRepair: staleFillReport };
}

let session = null;                         // {cookie, crumb, expires}

/**
 * The cookie and crumb Yahoo's quoteSummary and v7 quote endpoints require, kept for 30 minutes.
 * The conviction engine's fundamental pillar and the market-cap refresh share this one session
 * (it lived in ml/conviction-engine.js until 2026-09). Throws when Yahoo hands out no cookie or no
 * crumb.
 */
async function getSession() {
  if (session && session.expires > Date.now()) return session;
  const probe = await axios.get(COOKIE_URL, {
    headers: { 'User-Agent': USER_AGENT },
    validateStatus: () => true,
    timeout: 15000
  });
  const setCookie = probe.headers['set-cookie'] || [];
  const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('No Yahoo cookie');
  const crumbRes = await axios.get(CRUMB_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie },
    timeout: 15000
  });
  const crumb = typeof crumbRes.data === 'string' ? crumbRes.data.trim() : '';
  if (!crumb || crumb.includes('<')) throw new Error('No Yahoo crumb');
  session = { cookie, crumb, expires: Date.now() + SESSION_TTL_MS };
  return session;
}

/** Forget the session: the next getSession() asks Yahoo for a new cookie and crumb. */
function invalidateSession() {
  session = null;
}

const isUnauthorized = error => Boolean(error && error.response && error.response.status === 401);

/**
 * Yahoo's v7 quote for 1 to 50 symbols: resolves to the quote objects of Yahoo's answer (symbol,
 * currency, marketCap, regularMarketPrice, ...). A symbol Yahoo does not know is simply missing.
 * The endpoint needs the session: a 401 (a crumb Yahoo no longer accepts) gets one new session and
 * one retry; any other failure is thrown as it came.
 * @param {string[]} symbols
 * @param {{timeout?: number}} [options]
 * @returns {Promise<object[]>}
 */
async function fetchQuotes(symbols, { timeout = 20000 } = {}) {
  if (!Array.isArray(symbols) || symbols.length === 0 || symbols.length > QUOTE_BATCH_MAX) {
    throw new Error(`fetchQuotes takes 1 to ${QUOTE_BATCH_MAX} symbols`);
  }
  const request = async () => {
    const { cookie, crumb } = await getSession();
    const response = await axios.get(QUOTE_URL, {
      params: { symbols: symbols.join(','), crumb },
      headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie, 'Accept': 'application/json' },
      timeout
    });
    const result = response.data && response.data.quoteResponse && response.data.quoteResponse.result;
    if (!Array.isArray(result)) throw new Error('Yahoo\'s quote answer has no quoteResponse.result');
    return result;
  };
  try {
    return await request();
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    invalidateSession();
    return request();
  }
}

module.exports = {
  fetchChart,
  fetchQuoteChart,
  fetchHistoryCsv,
  getSession,
  invalidateSession,
  fetchQuotes,
  QUOTE_BATCH_MAX,
  USER_AGENT
};
