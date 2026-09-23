/**
 * Process-level rails for the one Node process that is SignalForge.
 *
 * - unhandledRejection: logged and reported to the owner (throttled), and the process keeps
 *   running. Node's default crashes it: Render restarts the server mid-job, and because
 *   sessions live in memory, every user is signed out.
 * - uncaughtException: logged, reported (with a bounded wait) and the process exits 1. After a
 *   synchronous throw its state is unknown; Render starts a fresh one.
 * - SIGTERM (Render sends it on every deploy) and SIGINT: stop taking requests, let the open ones
 *   finish, and exit 0 within a grace period. Before this, the only SIGTERM listener (the admin
 *   SSE handler) closed its streams without exiting, so the replaced instance kept running its
 *   cron work - a monthly sweep included - until Render killed it.
 *
 * installProcessGuards() is idempotent per process object and takes its collaborators as
 * arguments, so tests drive it with a fake process and server.
 */

const REJECTION_REPORT_GAP_MS = 15 * 60 * 1000;   // at most one owner report per 15 minutes
const EXCEPTION_REPORT_WAIT_MS = 3000;             // how long a crash waits for its report
const SHUTDOWN_GRACE_MS = 20000;                   // Render allows 30 s before SIGKILL

function describe(reason) {
    if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
    try { return typeof reason === 'string' ? reason : JSON.stringify(reason); } catch (e) { return String(reason); }
}

function firstStackFrame(reason) {
    const stack = reason instanceof Error && typeof reason.stack === 'string' ? reason.stack.split('\n') : [];
    const frame = stack.find(line => line.trim().startsWith('at '));
    return frame ? frame.trim() : null;
}

/**
 * @param {object} deps
 * @param {object} [deps.server]       the http.Server from app.listen (closed on shutdown)
 * @param {function} deps.notifyOwner  async (text) => boolean; must not throw (guarded anyway)
 * @param {object} [deps.proc]         process (tests pass a fake)
 * @param {function} [deps.exit]       process.exit (tests pass a spy)
 * @param {function} [deps.now]        Date.now
 * @param {object} [deps.options]      { rejectionGapMs, exceptionWaitMs, shutdownGraceMs }
 * @returns {{ shutdown: function }}
 */
function installProcessGuards({ server = null, notifyOwner, proc = process, exit = code => process.exit(code), now = Date.now, options = {} } = {}) {
    if (proc.__signalforgeGuards) return proc.__signalforgeGuards;
    const gapMs = options.rejectionGapMs ?? REJECTION_REPORT_GAP_MS;
    const waitMs = options.exceptionWaitMs ?? EXCEPTION_REPORT_WAIT_MS;
    const graceMs = options.shutdownGraceMs ?? SHUTDOWN_GRACE_MS;

    const report = async text => {
        try { return Boolean(await notifyOwner(text)); } catch (e) { return false; }
    };

    // ---- unhandled rejections: log every one, report the first and then one per gap
    let lastReportAt = -Infinity;
    let suppressed = 0;
    proc.on('unhandledRejection', reason => {
        const what = describe(reason);
        const where = firstStackFrame(reason);
        console.error(`❌ [PROCESS] Unhandled promise rejection: ${what}${where ? ` (${where})` : ''}`);
        if (now() - lastReportAt < gapMs) { suppressed++; return; }
        lastReportAt = now();
        const also = suppressed ? `\n(${suppressed} more since the last report)` : '';
        suppressed = 0;
        report(`⚠️ Unhandled promise rejection on the server - it keeps running.\n${what}${where ? `\n${where}` : ''}${also}`);
    });

    // ---- uncaught exceptions: report with a bounded wait, then exit 1
    let crashing = false;
    proc.on('uncaughtException', error => {
        console.error('❌ [PROCESS] Uncaught exception - exiting:', error && error.stack ? error.stack : error);
        if (crashing) return;
        crashing = true;
        const timer = setTimeout(() => exit(1), waitMs);
        report(`🛑 The server crashed on an uncaught exception and is restarting.\n${describe(error)}`)
            .finally(() => { clearTimeout(timer); exit(1); });
    });

    // ---- shutdown: stop taking requests, finish the open ones, exit 0 within the grace period
    let stopping = false;
    function shutdown(signal) {
        if (stopping) return;
        stopping = true;
        console.log(`🛑 [PROCESS] ${signal}: closing the HTTP server (up to ${Math.round(graceMs / 1000)} s), then exiting`);
        const timer = setTimeout(() => {
            console.log('🛑 [PROCESS] Grace period over - exiting');
            exit(0);
        }, graceMs);
        if (typeof timer.unref === 'function') timer.unref();
        if (!server) { clearTimeout(timer); exit(0); return; }
        server.close(() => {
            clearTimeout(timer);
            console.log('🛑 [PROCESS] HTTP server closed - exiting');
            exit(0);
        });
        // Keep-alive sockets with no request in flight would hold close() open until they time out
        if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
    }
    proc.on('SIGTERM', () => shutdown('SIGTERM'));
    proc.on('SIGINT', () => shutdown('SIGINT'));

    proc.__signalforgeGuards = { shutdown };
    return proc.__signalforgeGuards;
}

module.exports = { installProcessGuards, REJECTION_REPORT_GAP_MS, EXCEPTION_REPORT_WAIT_MS, SHUTDOWN_GRACE_MS };
