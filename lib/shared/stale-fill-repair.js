/**
 * Stale-fill repair for Yahoo daily history.
 *
 * On a day with no trades Yahoo still emits a bar (volume 0) and fills it with a price.
 * Usually that price is sound - the last trade carried forward, or a closing quote -
 * but on a few London lines it comes from a feed that is simply wrong: HOME.L's
 * no-trade days show 38.05p, the price it was SUSPENDED at in January 2023, while the
 * days that trade print 4p-13p; ZAIM.L's show exactly a tenth of the traded price.
 * Consecutive closes then zig-zag 3-10x, and a backtest books the zig-zag as trades.
 *
 * This module finds zero-volume bars whose price NO TRADE EVER CONFIRMED - out from
 * the last traded close, and straight back at the next one - and carries the last
 * traded close forward over them. It is pure: no I/O, inputs never mutated, bars
 * never dropped or reordered, volume never touched.
 *
 * It is deliberately narrow, because most zero-volume bars are NOT noise. Measured
 * over 756 UK symbols: 29% of them carry a price other than the last traded close,
 * and the next trade lands closer to that price than to the old one 55% of the time -
 * a closing quote that moved ahead of the tape. So:
 *  - a traded bar is never altered, whatever it says;
 *  - a zero-volume move that the next trade CONFIRMS is left alone;
 *  - a zero-volume bar with no trade before it, or none after it, is left alone:
 *    there is nothing to judge it by (GRIT.L: four traded days in five years, and
 *    there the long flat level is the stale one and the "spikes" are the real quotes).
 *
 * Run it on the output of price-unit-repair.js. A x100 forward-fill on a no-trade day
 * is also an unconfirmed excursion; that module handles it better, by exactly 100.
 */

// Both legs of the excursion - out from the last trade, back to the next - must be
// larger than this. After the unit repair, 3 of 756 UK symbols have such bars at 2x
// (5 at 1.5x: the extra two are single bars that could be real quotes on thin lines).
const EXCURSION_FACTOR = 2;

const PRICE_FIELDS = ['open', 'high', 'low', 'close'];

const isPrice = v => typeof v === 'number' && isFinite(v) && v > 0;

/** A bar that printed: a usable close AND volume behind it */
function isTraded(series, i) {
  return isPrice(series.close[i]) && Array.isArray(series.volume) && series.volume[i] > 0;
}

/** Everything the policy below is allowed to look at */
function describeExcursion(series, index, anchorIndex, nextIndex) {
  const close = series.close[index];
  const anchor = series.close[anchorIndex];
  const next = series.close[nextIndex];
  return {
    index,
    anchorIndex,
    nextIndex,
    // the fill against the last traded close: 9.5 = the fill is 9.5x higher
    outRatio: close / anchor,
    // the next traded close against the fill: 0.21 = the tape came back down to 21% of it
    backRatio: next / close,
    // the next traded close against the last one: how far the REAL price moved meanwhile
    bracketRatio: next / anchor,
    // zero-volume bars between the two trades
    gapBars: nextIndex - anchorIndex - 1
  };
}

/**
 * THE JUDGEMENT CALL. Is this zero-volume bar a price nobody could have traded at?
 *
 * Default: yes when it sits more than EXCURSION_FACTOR away from BOTH trades either
 * side of it, on the same side of both, and those two trades agree with each other
 * better than either agrees with it.
 *
 * The last clause is what keeps it honest. HOME.L 4.00 -> [38.05] -> 8.00: the real
 * price doubled across the gap, but both trades are still far closer to each other
 * than to 38.05. GV1O.L 0.86 -> [0.35] -> 33.0: the trades disagree by 38x (pounds vs
 * pence), so there is no telling which side the fill belongs to - leave it.
 *
 * Tuning it is a trade-off, not a free win. A lower factor also catches TM1.L's lone
 * bar at exactly half price, but starts flattening quotes that may be real on wild
 * thin lines (ACG.L 380 -> [200] -> 425). A higher one misses stale fills once the
 * real price has drifted towards the stale one.
 *
 * @param {Object} excursion - see describeExcursion()
 * @returns {boolean} true = no trade confirmed this price (carry the last trade forward)
 */
function isUnconfirmedExcursion(excursion) {
  const { outRatio, backRatio, bracketRatio } = excursion;
  const above = outRatio > EXCURSION_FACTOR && backRatio < 1 / EXCURSION_FACTOR;
  const below = outRatio < 1 / EXCURSION_FACTOR && backRatio > EXCURSION_FACTOR;
  if (!above && !below) return false;
  const tradesApart = Math.abs(Math.log(bracketRatio));
  return tradesApart < Math.min(Math.abs(Math.log(outRatio)), Math.abs(Math.log(backRatio)));
}

/**
 * Carry the last traded close forward over zero-volume bars no trade confirmed.
 *
 * @param {Object} series - column arrays of equal length: { open, high, low, close,
 *   adjclose?, volume }. Entries may be null / NaN / 0 for missing bars. Without a
 *   volume column there are no traded bars, so nothing can be judged or changed.
 * @returns {{series: Object, report: Object}} new arrays (same length, same order)
 *   and a report saying what was done.
 */
function repairStaleFills(series) {
  const report = {
    status: 'clean',      // 'clean' | 'repaired' | 'skipped'
    reason: null,         // why suspect bars were left alone
    bars: 0,              // zero-volume bars carried forward
    runs: [],             // [{ start, end, anchorIndex }] - consecutive repaired bars
    worstFactor: null,    // largest leg of any repaired excursion, e.g. 9.5
    unjudgedTailBars: 0   // suspect bars at the end of the series with no later trade
  };
  if (!series || !Array.isArray(series.close) || series.close.length === 0) {
    return { series, report };
  }

  const length = series.close.length;
  // nextTraded[i] = the first traded bar after i
  const nextTraded = new Array(length).fill(-1);
  for (let i = length - 1, upcoming = -1; i >= 0; i--) {
    nextTraded[i] = upcoming;
    if (isTraded(series, i)) upcoming = i;
  }

  const stale = [];
  let anchorIndex = -1;
  for (let i = 0; i < length; i++) {
    if (isTraded(series, i)) {
      anchorIndex = i;
      continue;
    }
    if (!isPrice(series.close[i]) || anchorIndex < 0) continue;

    if (nextTraded[i] < 0) {
      // Nothing after it to confirm or contradict it. Counted, never changed.
      const ratio = series.close[i] / series.close[anchorIndex];
      if (ratio > EXCURSION_FACTOR || ratio < 1 / EXCURSION_FACTOR) report.unjudgedTailBars++;
      continue;
    }
    const excursion = describeExcursion(series, i, anchorIndex, nextTraded[i]);
    if (isUnconfirmedExcursion(excursion)) stale.push(excursion);
  }

  if (stale.length === 0) {
    if (report.unjudgedTailBars > 0) {
      report.status = 'skipped';
      report.reason = 'tail-has-no-later-trade';
    }
    return { series, report };
  }

  const repaired = { ...series };
  for (const field of [...PRICE_FIELDS, 'adjclose']) {
    if (Array.isArray(series[field])) repaired[field] = series[field].slice();
  }

  let open = null;
  for (const excursion of stale) {
    const { index, anchorIndex: anchor } = excursion;
    for (const field of PRICE_FIELDS) {
      if (repaired[field]) repaired[field][index] = series.close[anchor];
    }
    if (repaired.adjclose && isPrice(series.adjclose[anchor])) {
      repaired.adjclose[index] = series.adjclose[anchor];
    }

    const factor = Math.max(
      excursion.outRatio, 1 / excursion.outRatio, excursion.backRatio, 1 / excursion.backRatio
    );
    if (report.worstFactor === null || factor > report.worstFactor) report.worstFactor = factor;

    if (open && open.end === index - 1 && open.anchorIndex === anchor) open.end = index;
    else {
      open = { start: index, end: index, anchorIndex: anchor };
      report.runs.push(open);
    }
  }
  report.bars = stale.length;
  report.status = 'repaired';
  return { series: repaired, report };
}

/**
 * Repair one `chart.result[0]` from Yahoo's v8 chart API. Nothing is mutated.
 *
 * @param {Object} result - Yahoo chart result: { timestamp, indicators, meta }
 * @param {Object} [unitView] - { quote, adjclose } as returned by price-unit-repair's
 *   repairYahooChartResult(). Pass it whenever that repair changed the series, so
 *   this one judges - and carries forward - prices that are already in one unit.
 * @returns {{quote: Object, adjclose: Array|null, report: Object}}
 */
function repairYahooChartStaleFills(result, unitView) {
  const rawQuote = (result && result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const rawAdjclose = result && result.indicators && result.indicators.adjclose && result.indicators.adjclose[0]
    ? result.indicators.adjclose[0].adjclose
    : null;
  const quote = (unitView && unitView.quote) || rawQuote;
  const adjclose = unitView && unitView.quote ? unitView.adjclose : rawAdjclose;

  // Volume is never rescaled by the unit repair, but take it from the raw quote anyway:
  // it is the one column this rule cannot work without.
  const series = { open: quote.open, high: quote.high, low: quote.low, close: quote.close, volume: rawQuote.volume };
  if (adjclose) series.adjclose = adjclose;

  const { series: repaired, report } = repairStaleFills(series);
  return {
    quote: { ...quote, open: repaired.open, high: repaired.high, low: repaired.low, close: repaired.close },
    adjclose: adjclose ? repaired.adjclose : null,
    report
  };
}

/**
 * The owner's switch. STALE_FILL_REPAIR=true applies the repair; anything else means
 * detect and report only. Applying it changes which stocks clear the scanner's bar.
 */
function isRepairEnabled(env = process.env) {
  return String(env.STALE_FILL_REPAIR || '').trim().toLowerCase() === 'true';
}

/** One line for a log or a response header, e.g. "repaired; bars=322; runs=12; worst=34.2x" */
function describeReport(report) {
  const parts = [report.status];
  if (report.reason) parts.push(`reason=${report.reason}`);
  if (report.status === 'repaired') {
    parts.push(`bars=${report.bars}`, `runs=${report.runs.length}`, `worst=${report.worstFactor.toFixed(1)}x`);
  }
  if (report.unjudgedTailBars > 0) parts.push(`tail=${report.unjudgedTailBars}`);
  return parts.join('; ');
}

module.exports = {
  repairStaleFills,
  repairYahooChartStaleFills,
  isRepairEnabled,
  describeReport,
  isUnconfirmedExcursion,
  EXCURSION_FACTOR
};
