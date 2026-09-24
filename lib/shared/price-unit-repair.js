/**
 * Price-unit repair for Yahoo daily history.
 *
 * Yahoo quotes many London lines in the minor unit (pence, `GBp`) but fills some
 * bars - mostly no-trade days, sometimes whole stretches - from a feed in the major
 * unit (pounds). The series then steps by exactly x100 or /100 between consecutive
 * bars, often dozens of times. A backtest reads each step as a -99% or +9900% day,
 * and the DTI's EMAs stay wrecked for months afterwards.
 *
 * This module finds those steps and rescales the off-unit stretches by exactly 100
 * so the series is continuous in ONE unit. It is pure: no I/O, inputs never mutated,
 * bars never dropped or reordered, volume never rescaled.
 *
 * What it must NOT do is "fix" a genuine move. Three things protect those:
 *  - only steps inside a band around 100x qualify (a -60%, -90% or even -97% day is
 *    nowhere near it);
 *  - the rescale is by exactly 100, never by the observed ratio, so a real move that
 *    happens to sit on a flip bar survives underneath it;
 *  - a series is only touched when it looks like ONE instrument quoted in TWO units.
 *    Anything else is refused and reported, never guessed at.
 */

const UNIT_FACTOR = 100;

// A unit step is close[i] / close[i-1] = 100 (or 1/100) give or take one real day's
// move. Across 756 UK symbols every observed flip sat in 82..139x; genuine moves
// topped out near 7x, and nothing at all landed in 50..70x or 143..200x.
const STEP_BAND = 2;

// On a unit step the whole bar moves: open, high, low and close all land in the new
// unit. A bar whose own fields are >5x apart straddles two price levels instead,
// which is what a genuine intraday collapse looks like.
const MAX_INTRABAR_SPREAD = 5;

// The live quote counts as "the same unit as the last bar" within this factor.
const SAME_UNIT_BAND = 3;

// Only trust the live quote as a reference when the series runs up to the present.
const ANCHOR_MAX_AGE_DAYS = 7;

const PRICE_FIELDS = ['open', 'high', 'low', 'close', 'adjclose'];

const isPrice = v => typeof v === 'number' && isFinite(v) && v > 0;

/** +1 for a ~x100 step, -1 for a ~/100 step, 0 for anything else */
function stepDirection(ratio) {
  if (ratio >= UNIT_FACTOR / STEP_BAND && ratio <= UNIT_FACTOR * STEP_BAND) return 1;
  if (ratio >= 1 / (UNIT_FACTOR * STEP_BAND) && ratio <= STEP_BAND / UNIT_FACTOR) return -1;
  return 0;
}

/** The price that says which unit a bar is in: its close, or whatever it has */
function levelPrice(series, i) {
  for (const field of ['close', 'high', 'low', 'open']) {
    const v = series[field] ? series[field][i] : null;
    if (isPrice(v)) return v;
  }
  return null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Everything the ambiguous-case policy below is allowed to look at */
function describeStep(series, index, previousIndex, ratio, direction) {
  const fields = ['open', 'high', 'low', 'close']
    .map(f => (series[f] ? series[f][index] : null))
    .filter(isPrice);
  const recentVolumes = [];
  for (let j = index - 1; j >= 0 && recentVolumes.length < 20; j--) {
    const v = series.volume ? series.volume[j] : null;
    if (isPrice(v)) recentVolumes.push(v);
  }
  const volume = series.volume ? series.volume[index] : null;
  const typicalVolume = median(recentVolumes);
  return {
    index,
    previousIndex,
    direction,
    ratio,
    // how far the step is from exactly 100x - 0 for a forward-filled bar
    deviation: Math.abs(ratio / Math.pow(UNIT_FACTOR, direction) - 1),
    // highest / lowest of the step bar's own open-high-low-close
    intrabarSpread: Math.max(...fields) / Math.min(...fields),
    volume: isPrice(volume) ? volume : 0,
    // step-bar volume as a multiple of the prior 20 traded days; null when unknown
    volumeSpike: typicalVolume && isPrice(volume) ? volume / typicalVolume : null
  };
}

/**
 * THE JUDGEMENT CALL. Reached only by a series with exactly ONE step, downwards,
 * that never reverses, whose tail agrees with the live quote (or has none to check).
 * Price alone cannot tell "Yahoo switched this line from pence to pounds" from "the
 * share really lost 99% overnight and stayed there".
 *
 * Every other shape is already decided: a step that later reverses, or a lone step
 * UP, cannot be a real move; a lone step down that the live quote contradicts is a
 * flipped tail.
 *
 * Default: call it a unit change when the step bar looks like an ordinary trading
 * day. A unit change is a normal session relabelled - narrow range, normal volume
 * (BCG.L 2026-08-24: spread 1.05, volume 0.7x typical). A real collapse trades DOWN
 * through the day on a volume spike (AMGO.L 2023-03-23: spread 7.5, open 2.8x close).
 *
 * @param {Object} step - see describeStep()
 * @returns {boolean} true = unit change (repair it), false = possibly genuine (leave it)
 */
function isLoneDownStepAUnitChange(step) {
  const calmBar = step.intrabarSpread <= 1.5;
  const normalVolume = step.volumeSpike === null || step.volumeSpike <= 5;
  return calmBar && normalVolume;
}

/** Walk the series once, giving every bar a unit level relative to the first bar */
function assignLevels(series) {
  const length = series.close.length;
  const levels = new Array(length).fill(0);
  const steps = [];
  let level = 0;
  let previousIndex = -1;
  let previousPrice = null;

  for (let i = 0; i < length; i++) {
    const price = levelPrice(series, i);
    if (price !== null) {
      if (previousPrice !== null) {
        const direction = stepDirection(price / previousPrice);
        if (direction !== 0) {
          level += direction;
          steps.push(describeStep(series, i, previousIndex, price / previousPrice, direction));
        }
      }
      previousIndex = i;
      previousPrice = price;
    }
    // A bar with no prices at all inherits the running level; there is nothing in it to rescale
    levels[i] = level;
  }
  return { levels, steps, lastIndex: previousIndex, lastPrice: previousPrice };
}

/** Which of the two levels is the one to keep */
function pickReferenceLevel(levels, walk, series, anchorPrice) {
  const tailLevel = levels[walk.lastIndex];
  const visited = new Set(levels);

  // 1. The live quote: the unit fills and exits are booked in
  if (isPrice(anchorPrice)) {
    const ratio = anchorPrice / walk.lastPrice;
    let anchorLevel = null;
    if (ratio >= 1 / SAME_UNIT_BAND && ratio <= SAME_UNIT_BAND) anchorLevel = tailLevel;
    else if (stepDirection(ratio) !== 0) anchorLevel = tailLevel + stepDirection(ratio);
    if (anchorLevel !== null && visited.has(anchorLevel)) {
      return { level: anchorLevel, basis: 'live-quote' };
    }
  }

  // 2. No usable quote (a window that ends in the past): keep the unit most bars are in.
  //    A backtest is scale-free, so either choice gives identical trades.
  const counts = new Map();
  for (let i = 0; i < levels.length; i++) {
    if (levelPrice(series, i) !== null) counts.set(levels[i], (counts.get(levels[i]) || 0) + 1);
  }
  const [otherLevel] = [...counts.keys()].filter(level => level !== tailLevel);
  const tailBars = counts.get(tailLevel);
  const otherBars = counts.get(otherLevel) || 0;
  if (otherBars > tailBars) return { level: otherLevel, basis: 'majority' };
  // A dead heat goes to the most recent unit
  return { level: tailLevel, basis: tailBars > otherBars ? 'majority' : 'latest' };
}

function rescale(value, exponent) {
  if (!isPrice(value) || exponent === 0) return value;
  // Divide rather than multiply by 0.01: 44.2 / 100 is exact where 44.2 * 0.01 is not
  return exponent > 0 ? value * Math.pow(UNIT_FACTOR, exponent) : value / Math.pow(UNIT_FACTOR, -exponent);
}

/**
 * Make a price series continuous in one unit.
 *
 * @param {Object} series - column arrays of equal length: { open, high, low, close,
 *   adjclose?, volume? }. Entries may be null / NaN / 0 for missing bars.
 * @param {Object} [context]
 * @param {number} [context.anchorPrice] - a live quote CONTEMPORANEOUS with the last
 *   bar. Pass it only when the series runs up to the present.
 * @returns {{series: Object, report: Object}} new arrays (same length, same order)
 *   and a report saying what was done and why.
 */
function repairPriceUnits(series, context = {}) {
  const report = {
    status: 'clean',      // 'clean' | 'repaired' | 'skipped'
    reason: null,         // why a series with steps was left alone
    steps: 0,
    barsRescaled: 0,
    referenceBasis: null, // 'live-quote' | 'majority' | 'latest'
    segments: []          // [{ start, end, factor }] - the stretches that were rescaled
  };
  if (!series || !Array.isArray(series.close) || series.close.length === 0) {
    return { series, report };
  }

  const walk = assignLevels(series);
  report.steps = walk.steps.length;
  if (walk.steps.length === 0) return { series, report };

  const skip = reason => {
    report.status = 'skipped';
    report.reason = reason;
    return { series, report };
  };

  // One instrument in two units visits exactly two adjacent levels
  const visited = [...new Set(walk.levels)];
  if (visited.length !== 2) return skip('more-than-two-price-levels');

  // On a unit step the whole bar moves together
  if (walk.steps.some(s => s.intrabarSpread > MAX_INTRABAR_SPREAD)) {
    return skip('step-bar-fields-disagree');
  }

  const reference = pickReferenceLevel(walk.levels, walk, series, context.anchorPrice);

  // A lone step down is the only shape a genuine move can take
  if (walk.steps.length === 1 && walk.steps[0].direction === -1) {
    const liveQuoteContradictsTail = reference.basis === 'live-quote'
      && reference.level !== walk.levels[walk.lastIndex];
    if (!liveQuoteContradictsTail && !isLoneDownStepAUnitChange(walk.steps[0])) {
      return skip('possible-genuine-collapse');
    }
  }

  const repaired = { ...series };
  for (const field of PRICE_FIELDS) {
    if (Array.isArray(series[field])) repaired[field] = series[field].slice();
  }

  let open = null;
  for (let i = 0; i < walk.levels.length; i++) {
    const exponent = reference.level - walk.levels[i];
    if (exponent !== 0) {
      let touched = false;
      for (const field of PRICE_FIELDS) {
        if (repaired[field] && isPrice(repaired[field][i])) {
          repaired[field][i] = rescale(repaired[field][i], exponent);
          touched = true;
        }
      }
      if (touched) report.barsRescaled++;
      if (open && open.exponent === exponent) open.end = i;
      else {
        open = { start: i, end: i, exponent };
        report.segments.push(open);
      }
    } else {
      open = null;
    }
  }
  report.segments = report.segments.map(s => ({
    start: s.start,
    end: s.end,
    factor: s.exponent > 0 ? Math.pow(UNIT_FACTOR, s.exponent) : 1 / Math.pow(UNIT_FACTOR, -s.exponent)
  }));
  report.status = 'repaired';
  report.referenceBasis = reference.basis;
  return { series: repaired, report };
}

/**
 * Repair one `chart.result[0]` from Yahoo's v8 chart API. Nothing is mutated.
 *
 * @param {Object} result - Yahoo chart result: { timestamp, indicators, meta }
 * @returns {{quote: Object, adjclose: Array|null, report: Object}}
 */
function repairYahooChartResult(result) {
  const quote = (result && result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const adjclose = result && result.indicators && result.indicators.adjclose && result.indicators.adjclose[0]
    ? result.indicators.adjclose[0].adjclose
    : null;
  const timestamps = (result && result.timestamp) || [];
  const meta = (result && result.meta) || {};

  const series = { open: quote.open, high: quote.high, low: quote.low, close: quote.close, volume: quote.volume };
  if (adjclose) series.adjclose = adjclose;

  // The live quote says which unit the LAST bar should be in - but only if the window
  // runs up to the quote. A Simulator window ending in 2023 must not be anchored to a
  // 2026 price. The test is one-sided on purpose: regularMarketTime is the last TRADE,
  // so on an illiquid line the quote is routinely older than the newest (forward-filled)
  // bar - and that frozen quote is still what the one-day chart hands to the trade executor.
  let anchorPrice;
  if (isPrice(meta.regularMarketPrice) && isPrice(meta.regularMarketTime) && Array.isArray(quote.close)) {
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (levelPrice(series, i) === null) continue;
      const quoteAheadDays = (meta.regularMarketTime - timestamps[i]) / 86400;
      if (quoteAheadDays <= ANCHOR_MAX_AGE_DAYS) anchorPrice = meta.regularMarketPrice;
      break;
    }
  }

  const { series: repaired, report } = repairPriceUnits(series, { anchorPrice });
  return {
    quote: { ...quote, open: repaired.open, high: repaired.high, low: repaired.low, close: repaired.close },
    adjclose: adjclose ? repaired.adjclose : null,
    report
  };
}

/**
 * Bring a run of prices into the unit of the live quote.
 *
 * For a caller that sets a bar against the QUOTE - a day move - rather than bars against
 * each other. repairPriceUnits() makes the bars agree with one another, but a short window
 * can be continuous and still sit wholly in the other unit: GVMH.L's 5-day window was four
 * forward-filled bars at 0.006 (pounds) under a 0.6 (pence) quote. There is no step in
 * those bars to find, and 0.6 / 0.006 read as a +9900% day.
 *
 * The newest bar and the quote describe the same moment (or the quote is the older of the
 * two, on a line that has not traded since), so a ~100x gap between them is not a day move:
 * a real collapse is already inside the newest bar, where the repair has judged it.
 *
 * That holds while the newest bar HAS a close. When today's bar is still empty the newest
 * close is yesterday's, and a genuine -99% day would look the same. It is treated as a unit
 * gap regardless, because the alternative is wrong far more often - lines like VTA.L flip
 * constantly AND leave today's close empty. Fine for a display; anything that books a trade
 * must not lean on it.
 *
 * @param {Array} prices - e.g. repaired closes. null / NaN / 0 entries pass through.
 * @param {number} quotePrice - the live quote those prices are about to be set against
 * @returns {{prices: Array, factor: number}} the very same array, and factor 1, when
 *   there is nothing to do
 */
function alignToQuoteUnit(prices, quotePrice) {
  if (!Array.isArray(prices) || !isPrice(quotePrice)) return { prices, factor: 1 };
  let newest = null;
  for (let i = prices.length - 1; i >= 0 && newest === null; i--) {
    if (isPrice(prices[i])) newest = prices[i];
  }
  const exponent = newest === null ? 0 : stepDirection(quotePrice / newest);
  if (exponent === 0) return { prices, factor: 1 };
  return {
    prices: prices.map(price => rescale(price, exponent)),
    factor: exponent > 0 ? UNIT_FACTOR : 1 / UNIT_FACTOR
  };
}

/**
 * The owner's switch. PRICE_UNIT_REPAIR=true applies the repair wherever applying it
 * changes what gets selected or traded; anything else means detect and report only.
 */
function isRepairEnabled(env = process.env) {
  return String(env.PRICE_UNIT_REPAIR || '').trim().toLowerCase() === 'true';
}

/** One line for a log or a response header, e.g. "repaired; steps=20; bars=66; unit=live-quote" */
function describeReport(report) {
  const parts = [report.status];
  if (report.reason) parts.push(`reason=${report.reason}`);
  parts.push(`steps=${report.steps}`);
  if (report.status === 'repaired') parts.push(`bars=${report.barsRescaled}`, `unit=${report.referenceBasis}`);
  return parts.join('; ');
}

module.exports = {
  repairPriceUnits,
  repairYahooChartResult,
  alignToQuoteUnit,
  isRepairEnabled,
  describeReport,
  isLoneDownStepAUnitChange,
  UNIT_FACTOR,
  STEP_BAND
};
