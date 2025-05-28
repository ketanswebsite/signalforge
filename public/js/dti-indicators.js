/**
 * DTI Backtester - Technical Indicators Module
 * Handles all indicator calculations including DTI and 7-Day DTI
 */

// Create DTIIndicators module
const DTIIndicators = (function() {
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
            for (let j = startIdx; j <= endIdx; j++) {
                daily7DayDTI[j] = sevenDayDTI[i];
            }
        }
        
        return {
            sevenDayData: sevenDayData,
            sevenDayDTI: sevenDayDTI,
            daily7DayDTI: daily7DayDTI
        };
    }

    /**
     * Calculate Rate of Change (ROC) indicator
     * @param {Array} data - Input price data
     * @param {number} period - Period for ROC calculation
     * @returns {Array} - ROC values
     */
    function calculateROC(data, period) {
        // Validate inputs
        if (!data || data.length < period || period <= 0) {
            console.error('Invalid inputs for ROC calculation');
            return [];
        }
        
        const roc = new Array(period).fill(null); // First 'period' values will be null
        
        for (let i = period; i < data.length; i++) {
            // ROC = ((Current Price - Price 'period' ago) / Price 'period' ago) * 100
            roc.push(((data[i] - data[i - period]) / data[i - period]) * 100);
        }
        
        return roc;
    }

    /**
     * Calculate Average Directional Index (ADX)
     * This is a supplementary indicator that can be used alongside DTI
     * @param {Array} high - High prices
     * @param {Array} low - Low prices
     * @param {Array} close - Close prices
     * @param {number} period - Period for ADX calculation
     * @returns {Object} - Object containing ADX, +DI, and -DI
     */
    function calculateADX(high, low, close, period = 14) {
        // Validate inputs
        if (!high || !low || !close || 
            high.length !== low.length || 
            high.length !== close.length || 
            high.length < period * 2) {
            console.error('Invalid inputs for ADX calculation');
            return {
                adx: [],
                plusDI: [],
                minusDI: []
            };
        }
        
        const trueRange = [];
        const plusDM = [];
        const minusDM = [];
        
        // Initialize first values
        trueRange.push(high[0] - low[0]);
        plusDM.push(0);
        minusDM.push(0);
        
        // Calculate True Range, +DM, and -DM
        for (let i = 1; i < high.length; i++) {
            // True Range = max(high - low, |high - prevClose|, |low - prevClose|)
            const tr = Math.max(
                high[i] - low[i],
                Math.abs(high[i] - close[i-1]),
                Math.abs(low[i] - close[i-1])
            );
            
            trueRange.push(tr);
            
            // +DM = current high - previous high, if positive, otherwise 0
            // -DM = previous low - current low, if positive, otherwise 0
            const highDiff = high[i] - high[i-1];
            const lowDiff = low[i-1] - low[i];
            
            if (highDiff > lowDiff && highDiff > 0) {
                plusDM.push(highDiff);
                minusDM.push(0);
            } else if (lowDiff > highDiff && lowDiff > 0) {
                plusDM.push(0);
                minusDM.push(lowDiff);
            } else {
                plusDM.push(0);
                minusDM.push(0);
            }
        }
        
        // Calculate smoothed values
        const smoothedTR = calculateSmoothed(trueRange, period);
        const smoothedPlusDM = calculateSmoothed(plusDM, period);
        const smoothedMinusDM = calculateSmoothed(minusDM, period);
        
        // Calculate +DI and -DI
        const plusDI = [];
        const minusDI = [];
        
        for (let i = 0; i < smoothedTR.length; i++) {
            if (smoothedTR[i] !== 0) {
                plusDI.push((smoothedPlusDM[i] / smoothedTR[i]) * 100);
                minusDI.push((smoothedMinusDM[i] / smoothedTR[i]) * 100);
            } else {
                plusDI.push(0);
                minusDI.push(0);
            }
        }
        
        // Calculate DX
        const dx = [];
        
        for (let i = 0; i < plusDI.length; i++) {
            const diff = Math.abs(plusDI[i] - minusDI[i]);
            const sum = plusDI[i] + minusDI[i];
            
            if (sum !== 0) {
                dx.push((diff / sum) * 100);
            } else {
                dx.push(0);
            }
        }
        
        // Calculate ADX (EMA of DX)
        const adx = EMA(dx, period);
        
        return {
            adx: adx,
            plusDI: plusDI,
            minusDI: minusDI
        };
    }

    /**
     * Helper function to calculate smoothed values (Wilder's smoothing)
     * @param {Array} data - Input data
     * @param {number} period - Smoothing period
     * @returns {Array} - Smoothed values
     */
    function calculateSmoothed(data, period) {
        // First value is the sum of first 'period' values
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        
        const smoothed = [sum];
        
        // Subsequent values use Wilder's smoothing formula
        for (let i = period; i < data.length; i++) {
            const value = smoothed[smoothed.length - 1] - (smoothed[smoothed.length - 1] / period) + data[i];
            smoothed.push(value);
        }
        
        return smoothed;
    }

    /**
     * Calculate Bollinger Bands
     * @param {Array} data - Price data
     * @param {number} period - Period for SMA calculation
     * @param {number} stdDev - Number of standard deviations
     * @returns {Object} - Object containing upper band, middle band, and lower band
     */
    function calculateBollingerBands(data, period = 20, stdDev = 2) {
        // Validate inputs
        if (!data || data.length < period || period <= 0) {
            console.error('Invalid inputs for Bollinger Bands calculation');
            return {
                upper: [],
                middle: [],
                lower: []
            };
        }
        
        const upper = [];
        const middle = [];
        const lower = [];
        
        // Initialize first 'period-1' values as null
        for (let i = 0; i < period - 1; i++) {
            upper.push(null);
            middle.push(null);
            lower.push(null);
        }
        
        // Calculate Bollinger Bands for each window of 'period' values
        for (let i = period - 1; i < data.length; i++) {
            // Get the window of 'period' values
            const window = data.slice(i - period + 1, i + 1);
            
            // Calculate SMA
            const sma = window.reduce((sum, val) => sum + val, 0) / period;
            
            // Calculate standard deviation
            const squaredDiffs = window.map(val => Math.pow(val - sma, 2));
            const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
            const stdDevValue = Math.sqrt(variance);
            
            // Calculate upper and lower bands
            upper.push(sma + (stdDev * stdDevValue));
            middle.push(sma);
            lower.push(sma - (stdDev * stdDevValue));
        }
        
        return {
            upper: upper,
            middle: middle,
            lower: lower
        };
    }

    // Return public API
    return {
        EMA,
        calculateDTI,
        aggregateTo7Day,
        calculate7DayDTI,
        calculateROC,
        calculateADX,
        calculateBollingerBands
    };
})();

// Make DTIIndicators available globally
window.DTIIndicators = DTIIndicators;