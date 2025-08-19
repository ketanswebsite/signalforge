/**
 * Shared DTI Calculator Module
 * Contains DTI and 7-Day DTI calculation logic
 * Used by both backend scanner and frontend DTI interface
 */

/**
 * Calculate Exponential Moving Average (EMA)
 * @param {Array} data - Input data array
 * @param {number} period - EMA period
 * @returns {Array} - EMA values
 */
function EMA(data, period) {
    if (!data || !data.length || period <= 0) {
        console.error('Invalid inputs for EMA calculation');
        return [];
    }
    
    const k = 2 / (period + 1);
    let emaData = [data[0]]; // Initialize with first value
    
    for (let i = 1; i < data.length; i++) {
        // EMA formula: Current EMA = (Price - Previous EMA) * K + Previous EMA
        emaData.push(data[i] * k + emaData[i-1] * (1-k));
    }
    
    return emaData;
}

/**
 * Calculate Directional Trend Index (DTI) based on William Blau's method
 * @param {Array} high - High prices
 * @param {Array} low - Low prices
 * @param {number} r - First EMA period
 * @param {number} s - Second EMA period
 * @param {number} u - Third EMA period
 * @returns {Array} - DTI values
 */
function calculateDTI(high, low, r, s, u) {
    // Validate inputs
    if (!high || !low || high.length !== low.length || high.length === 0) {
        console.error('Invalid price data for DTI calculation');
        return [];
    }
    
    if (r <= 0 || s <= 0 || u <= 0) {
        console.error('Invalid EMA periods for DTI calculation');
        return []; 
    }
    
    const xHMU = [];  // Higher momentum up
    const xLMD = [];  // Lower momentum down
    const xPrice = []; // Price momentum = xHMU - xLMD
    const xPriceAbs = []; // Absolute value of xPrice
    
    // First point has no previous value, so we'll set it to 0
    xHMU.push(0);
    xLMD.push(0);
    xPrice.push(0);
    xPriceAbs.push(0);
    
    // Calculate xHMU, xLMD, xPrice, and xPriceAbs for each data point
    for (let i = 1; i < high.length; i++) {
        // Calculate xHMU: if high is greater than previous high, take the difference, otherwise 0
        if (high[i] - high[i-1] > 0) {
            xHMU.push(high[i] - high[i-1]);
        } else {
            xHMU.push(0);
        }
        
        // Calculate xLMD: if low is less than previous low, take the negative of the difference, otherwise 0
        if (low[i] - low[i-1] < 0) {
            xLMD.push(-(low[i] - low[i-1]));
        } else {
            xLMD.push(0);
        }
        
        // Calculate xPrice: xHMU - xLMD
        xPrice.push(xHMU[i] - xLMD[i]);
        
        // Calculate xPriceAbs: absolute value of xPrice
        xPriceAbs.push(Math.abs(xPrice[i]));
    }
    
    // Apply triple EMA to xPrice with periods r, s, and u
    const ema1 = EMA(xPrice, r);
    const ema2 = EMA(ema1, s);
    const xuXA = EMA(ema2, u);
    
    // Apply triple EMA to xPriceAbs with periods r, s, and u
    const emaAbs1 = EMA(xPriceAbs, r);
    const emaAbs2 = EMA(emaAbs1, s);
    const xuXAAbs = EMA(emaAbs2, u);
    
    // Calculate DTI: if xuXAAbs is not 0, then 100 * xuXA / xuXAAbs, otherwise 0
    const dti = [];
    for (let i = 0; i < xuXA.length; i++) {
        const val1 = 100 * xuXA[i];
        const val2 = xuXAAbs[i];
        
        if (val2 !== 0) {
            dti.push(val1 / val2);
        } else {
            dti.push(0);
        }
    }
    
    return dti;
}

/**
 * Aggregate daily data to 7-day periods
 * @param {Array} dates - Array of date strings
 * @param {Array} high - High prices
 * @param {Array} low - Low prices
 * @returns {Array} - Array of 7-day period objects
 */
function aggregateTo7Day(dates, high, low) {
    // Validate inputs
    if (!dates || !high || !low || dates.length !== high.length || dates.length !== low.length) {
        console.error('Invalid inputs for 7-day aggregation');
        return [];
    }
    
    const sevenDayData = [];
    let currentPeriodHigh = -Infinity;
    let currentPeriodLow = Infinity;
    let periodStartIndex = 0;
    
    // Initialize 7-day data structure
    for (let i = 0; i < dates.length; i++) {
        // Check if we need to start a new 7-day period
        // We start a new period every 7 days
        if (i % 7 === 0 && i > 0) {
            // Save the previous period's data
            sevenDayData.push({
                startDate: dates[periodStartIndex],
                endDate: dates[i - 1],
                startIndex: periodStartIndex,
                endIndex: i - 1,
                high: currentPeriodHigh,
                low: currentPeriodLow
            });
            
            // Start a new period
            periodStartIndex = i;
            currentPeriodHigh = high[i];
            currentPeriodLow = low[i];
        } else {
            // Update period's high and low
            currentPeriodHigh = Math.max(currentPeriodHigh, high[i]);
            currentPeriodLow = Math.min(currentPeriodLow, low[i]);
        }
    }
    
    // Add the last period
    if (periodStartIndex < dates.length) {
        sevenDayData.push({
            startDate: dates[periodStartIndex],
            endDate: dates[dates.length - 1],
            startIndex: periodStartIndex,
            endIndex: dates.length - 1,
            high: currentPeriodHigh,
            low: currentPeriodLow
        });
    }
    
    return sevenDayData;
}

/**
 * Calculate 7-day DTI and map to daily data
 * @param {Array} dates - Array of date strings
 * @param {Array} high - High prices
 * @param {Array} low - Low prices
 * @param {number} r - First EMA period
 * @param {number} s - Second EMA period
 * @param {number} u - Third EMA period
 * @returns {Object} - Object containing 7-day DTI data
 */
function calculate7DayDTI(dates, high, low, r, s, u) {
    // Aggregate daily data to 7-day periods
    const sevenDayData = aggregateTo7Day(dates, high, low);
    
    // Extract 7-day high and low arrays
    const sevenDayHigh = sevenDayData.map(period => period.high);
    const sevenDayLow = sevenDayData.map(period => period.low);
    
    // Calculate DTI on 7-day data
    const sevenDayDTI = calculateDTI(sevenDayHigh, sevenDayLow, r, s, u);
    
    // Map 7-day DTI back to daily data
    const daily7DayDTI = new Array(dates.length).fill(null);
    
    for (let i = 0; i < sevenDayData.length; i++) {
        const startIdx = sevenDayData[i].startIndex;
        const endIdx = sevenDayData[i].endIndex;
        
        // Assign 7-day DTI value to all days in this period
        const dtiValue = sevenDayDTI[i] || 0;
        for (let j = startIdx; j <= endIdx; j++) {
            daily7DayDTI[j] = dtiValue;
        }
    }
    
    return {
        sevenDayData: sevenDayData,
        sevenDayDTI: sevenDayDTI,
        daily7DayDTI: daily7DayDTI,
        periods: sevenDayData.map((period, index) => ({
            startDate: period.startDate,
            endDate: period.endDate,
            high: period.high,
            low: period.low,
            dti: sevenDayDTI[index] || 0
        }))
    };
}

/**
 * Detect trade signals based on DTI and 7-Day DTI
 * @param {Array} dti - DTI values
 * @param {Array} daily7DayDTI - 7-day DTI values mapped to daily
 * @param {number} entryThreshold - DTI threshold for trade entry
 * @returns {Array} - Array of signal objects
 */
function detectTradeSignals(dti, daily7DayDTI, entryThreshold = -40) {
    const signals = [];
    
    if (!dti || !daily7DayDTI || dti.length !== daily7DayDTI.length) {
        console.error('Invalid inputs for signal detection');
        return signals;
    }
    
    for (let i = 1; i < dti.length; i++) {
        const currentDTI = dti[i];
        const current7DayDTI = daily7DayDTI[i];
        const prevDTI = dti[i - 1];
        const prev7DayDTI = daily7DayDTI[i - 1];
        
        // Entry signal: DTI below threshold, trending upward, AND 7-day DTI trending upward (matches frontend)
        const sevenDayConditionMet = prev7DayDTI !== null ? current7DayDTI > prev7DayDTI : true;
        if (currentDTI < entryThreshold && currentDTI > prevDTI && sevenDayConditionMet) {
            signals.push({
                index: i,
                type: 'entry',
                dti: currentDTI,
                sevenDayDTI: current7DayDTI,
                signal: 'BUY'
            });
        }
        
        // Exit signal: 7-day DTI turns negative
        if (prev7DayDTI > 0 && current7DayDTI <= 0) {
            signals.push({
                index: i,
                type: 'exit',
                dti: currentDTI,
                sevenDayDTI: current7DayDTI,
                signal: 'SELL'
            });
        }
    }
    
    return signals;
}

/**
 * Analyze stock data for trading opportunities
 * @param {Object} stockData - Stock data object with dates, high, low, close
 * @param {Object} params - Parameters object
 * @returns {Object} - Analysis results
 */
function analyzeStock(stockData, params = {}) {
    const {
        r = 14,
        s = 10,
        u = 5,
        entryThreshold = -40
    } = params;
    
    if (!stockData || !stockData.dates || !stockData.high || !stockData.low || !stockData.close) {
        console.error('Invalid stock data for analysis');
        return null;
    }
    
    const { dates, high, low, close } = stockData;
    
    // Calculate DTI
    const dti = calculateDTI(high, low, r, s, u);
    
    // Calculate 7-Day DTI
    const sevenDayDTIData = calculate7DayDTI(dates, high, low, r, s, u);
    
    // Detect signals
    const signals = detectTradeSignals(dti, sevenDayDTIData.daily7DayDTI, entryThreshold);
    
    // Get latest values
    const latestIndex = dti.length - 1;
    const currentDTI = dti[latestIndex];
    const current7DayDTI = sevenDayDTIData.daily7DayDTI[latestIndex];
    const currentPrice = close[latestIndex];
    
    // Determine current opportunity (matches frontend logic)
    // Frontend uses: currentDTI < entryThreshold && currentDTI > previousDTI && sevenDayConditionMet
    const previousDTI = latestIndex > 0 ? dti[latestIndex - 1] : currentDTI;
    const previous7DayDTI = latestIndex > 0 ? sevenDayDTIData.daily7DayDTI[latestIndex - 1] : null;
    const sevenDayConditionMet = previous7DayDTI !== null ? current7DayDTI > previous7DayDTI : true;
    const isOpportunity = currentDTI < entryThreshold && currentDTI > previousDTI && sevenDayConditionMet;
    
    return {
        symbol: stockData.symbol || 'UNKNOWN',
        currentPrice,
        currentDTI,
        current7DayDTI,
        isOpportunity,
        signals,
        dti,
        sevenDayDTI: sevenDayDTIData,
        dates,
        high,
        low,
        close,
        analysis: {
            totalSignals: signals.length,
            entrySignals: signals.filter(s => s.type === 'entry').length,
            exitSignals: signals.filter(s => s.type === 'exit').length,
            lastSignal: signals[signals.length - 1] || null
        }
    };
}

// Export functions
const DTICalculator = {
    EMA,
    calculateDTI,
    aggregateTo7Day,
    calculate7DayDTI,
    detectTradeSignals,
    analyzeStock
};

// Export for Node.js (backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DTICalculator;
}

// Export for Browser (frontend)
if (typeof window !== 'undefined') {
    window.DTICalculator = DTICalculator;
}