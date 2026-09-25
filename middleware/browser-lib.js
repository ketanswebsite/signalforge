/**
 * /lib: the few lib/ files the pages load, and nothing else.
 *
 * lib/ is server source - the scanner, the trade executor, the exit monitor, the Telegram
 * bot. A handful of files under lib/shared are ALSO loaded by pages, so the browser
 * backtests with the very code the server trades with. Mounting the directory would
 * publish all of it; this serves only the files named below, by exact URL.
 *
 * The file sent comes from the table, never from the request, so "..", %2e%2e, doubled
 * slashes and case variants cannot reach anything else. Every other request under the
 * mount is a 404 here: a static mount added further down later cannot re-open lib/.
 *
 * server.js puts ensureAuthenticated in front of this - every page that loads these
 * files is itself signed-in only.
 *
 * Adding a file: it must be written for the browser (exports to `window`, requires no
 * server module, reads no process.env). tests/unit/browser-lib.test.js checks that, and
 * fails when a page loads a lib/ script that is not on the list.
 */

// Relative to lib/. strategy-params.js holds the strategy's numbers, which the engines
// below and the pages' own scripts read. backtest-stop.js and trailing-stop.js come with
// the trailing-stop work, whose versions of trades.html and portfolio-backtest.html load
// them; until it lands they are a 404.
const BROWSER_LIB_FILES = Object.freeze([
  'shared/strategy-params.js',
  'shared/stock-data.js',
  'shared/dti-calculator.js',
  'shared/backtest-calculator.js',
  'shared/backtest-stop.js',
  'shared/trailing-stop.js'
]);

function browserLib(libRoot, files = BROWSER_LIB_FILES) {
  const served = new Map(files.map(file => ['/' + file, file]));

  return function browserLibMiddleware(req, res, next) {
    const notFound = () => res.status(404).json({ error: 'Not Found', path: req.baseUrl + req.path });

    const file = (req.method === 'GET' || req.method === 'HEAD') && served.get(req.path);
    if (!file) return notFound();

    // A relative name plus `root`: send checks only the listed name for dotfiles,
    // not every directory above lib/ as it would for an absolute path.
    res.sendFile(file, { root: libRoot }, err => {
      if (!err || err.code === 'ECONNABORTED' || res.headersSent) return;
      if (err.status === 404) return notFound();
      next(err);
    });
  };
}

module.exports = { browserLib, BROWSER_LIB_FILES };
