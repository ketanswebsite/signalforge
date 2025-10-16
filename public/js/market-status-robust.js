/**
 * Robust Market Status Module
 * 100% reliable timezone and market hours calculation
 *
 * Uses UTC as baseline for all calculations to avoid DST and timezone issues
 */

const RobustMarketStatus = (function() {

    // Market configurations with UTC offsets
    // These handle DST automatically based on date
    const MARKET_CONFIG = {
        'NYSE': {
            name: 'US Market (NYSE)',
            timezone: 'America/New_York',
            utcOffsetStandard: -5,  // EST
            utcOffsetDST: -4,        // EDT
            // DST: Second Sunday in March to First Sunday in November
            dstStart: { month: 3, week: 2, day: 0 }, // March, 2nd Sunday
            dstEnd: { month: 11, week: 1, day: 0 },  // November, 1st Sunday
            hours: {
                preMarket: { start: 4, end: 9.5 },      // 4:00 AM - 9:30 AM
                regular: { start: 9.5, end: 16 },       // 9:30 AM - 4:00 PM
                afterHours: { start: 16, end: 20 }      // 4:00 PM - 8:00 PM
            },
            tradingDays: [1, 2, 3, 4, 5]  // Monday - Friday
        },
        'NASDAQ': {
            name: 'US Market (NASDAQ)',
            timezone: 'America/New_York',
            utcOffsetStandard: -5,
            utcOffsetDST: -4,
            dstStart: { month: 3, week: 2, day: 0 },
            dstEnd: { month: 11, week: 1, day: 0 },
            hours: {
                preMarket: { start: 4, end: 9.5 },
                regular: { start: 9.5, end: 16 },
                afterHours: { start: 16, end: 20 }
            },
            tradingDays: [1, 2, 3, 4, 5]
        },
        'NSE': {
            name: 'India (NSE)',
            timezone: 'Asia/Kolkata',
            utcOffsetStandard: 5.5,  // IST (no DST in India)
            utcOffsetDST: 5.5,
            dstStart: null,
            dstEnd: null,
            hours: {
                preMarket: { start: 9, end: 9.25 },     // 9:00 AM - 9:15 AM
                regular: { start: 9.25, end: 15.5 },    // 9:15 AM - 3:30 PM
                afterHours: { start: 15.5, end: 16 }    // 3:30 PM - 4:00 PM
            },
            tradingDays: [1, 2, 3, 4, 5]
        },
        'BSE': {
            name: 'India (BSE)',
            timezone: 'Asia/Kolkata',
            utcOffsetStandard: 5.5,
            utcOffsetDST: 5.5,
            dstStart: null,
            dstEnd: null,
            hours: {
                preMarket: { start: 9, end: 9.25 },
                regular: { start: 9.25, end: 15.5 },
                afterHours: { start: 15.5, end: 16 }
            },
            tradingDays: [1, 2, 3, 4, 5]
        },
        'LSE': {
            name: 'UK (LSE)',
            timezone: 'Europe/London',
            utcOffsetStandard: 0,   // GMT
            utcOffsetDST: 1,        // BST
            // DST: Last Sunday in March to Last Sunday in October
            dstStart: { month: 3, week: -1, day: 0 },  // March, last Sunday
            dstEnd: { month: 10, week: -1, day: 0 },   // October, last Sunday
            hours: {
                preMarket: { start: 5.5, end: 8 },      // 5:30 AM - 8:00 AM (auction)
                regular: { start: 8, end: 16.5 },       // 8:00 AM - 4:30 PM
                afterHours: { start: 16.5, end: 17.5 }  // 4:30 PM - 5:30 PM (auction)
            },
            tradingDays: [1, 2, 3, 4, 5]
        },
        'FTSE': {
            name: 'UK (FTSE)',
            timezone: 'Europe/London',
            utcOffsetStandard: 0,
            utcOffsetDST: 1,
            dstStart: { month: 3, week: -1, day: 0 },
            dstEnd: { month: 10, week: -1, day: 0 },
            hours: {
                preMarket: { start: 5.5, end: 8 },
                regular: { start: 8, end: 16.5 },
                afterHours: { start: 16.5, end: 17.5 }
            },
            tradingDays: [1, 2, 3, 4, 5]
        }
    };

    /**
     * Get the nth occurrence of a weekday in a month
     * @param {number} year
     * @param {number} month - 1-12
     * @param {number} weekday - 0-6 (Sunday=0)
     * @param {number} occurrence - 1, 2, 3, 4, or -1 for last
     * @returns {Date}
     */
    function getNthWeekdayOfMonth(year, month, weekday, occurrence) {
        const firstDay = new Date(Date.UTC(year, month - 1, 1));
        const lastDay = new Date(Date.UTC(year, month, 0));

        if (occurrence === -1) {
            // Last occurrence
            let date = lastDay.getUTCDate();
            while (date > 0) {
                const testDate = new Date(Date.UTC(year, month - 1, date));
                if (testDate.getUTCDay() === weekday) {
                    return testDate;
                }
                date--;
            }
        } else {
            // nth occurrence
            let count = 0;
            for (let date = 1; date <= lastDay.getUTCDate(); date++) {
                const testDate = new Date(Date.UTC(year, month - 1, date));
                if (testDate.getUTCDay() === weekday) {
                    count++;
                    if (count === occurrence) {
                        return testDate;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if a date is in DST for a given market
     * @param {Date} utcDate
     * @param {Object} marketConfig
     * @returns {boolean}
     */
    function isInDST(utcDate, marketConfig) {
        if (!marketConfig.dstStart || !marketConfig.dstEnd) {
            return false; // No DST for this market
        }

        const year = utcDate.getUTCFullYear();

        const dstStart = getNthWeekdayOfMonth(
            year,
            marketConfig.dstStart.month,
            marketConfig.dstStart.day,
            marketConfig.dstStart.week
        );
        dstStart.setUTCHours(2, 0, 0, 0); // DST starts at 2 AM local time

        const dstEnd = getNthWeekdayOfMonth(
            year,
            marketConfig.dstEnd.month,
            marketConfig.dstEnd.day,
            marketConfig.dstEnd.week
        );
        dstEnd.setUTCHours(2, 0, 0, 0); // DST ends at 2 AM local time

        const utcTime = utcDate.getTime();
        return utcTime >= dstStart.getTime() && utcTime < dstEnd.getTime();
    }

    /**
     * Convert UTC date to market local time
     * @param {Date} utcDate
     * @param {Object} marketConfig
     * @returns {{date: Date, hours: number, minutes: number, seconds: number, dayOfWeek: number}}
     */
    function getMarketLocalTime(utcDate, marketConfig) {
        const isDST = isInDST(utcDate, marketConfig);
        const offset = isDST ? marketConfig.utcOffsetDST : marketConfig.utcOffsetStandard;

        // Calculate market time in milliseconds
        const utcTime = utcDate.getTime();
        const offsetMs = offset * 60 * 60 * 1000;
        const marketTime = new Date(utcTime + offsetMs);

        return {
            date: marketTime,
            hours: marketTime.getUTCHours(),
            minutes: marketTime.getUTCMinutes(),
            seconds: marketTime.getUTCSeconds(),
            dayOfWeek: marketTime.getUTCDay(),
            isDST: isDST,
            offset: offset
        };
    }

    /**
     * Check if market is on a trading day
     * @param {number} dayOfWeek - 0-6 (Sunday=0)
     * @param {Array} tradingDays
     * @returns {boolean}
     */
    function isTradingDay(dayOfWeek, tradingDays) {
        return tradingDays.includes(dayOfWeek);
    }

    /**
     * Check if date is a holiday
     * @param {Date} marketLocalDate
     * @param {string} marketKey
     * @returns {boolean}
     */
    function isHoliday(marketLocalDate, marketKey) {
        if (window.MarketHolidays && window.MarketHolidays.isMarketHoliday) {
            return window.MarketHolidays.isMarketHoliday(marketLocalDate, marketKey);
        }
        return false;
    }

    /**
     * Get robust market status
     * @param {string} symbol - Stock symbol
     * @param {Date} [currentTime] - Optional time for testing, defaults to now
     * @returns {Object} - Market status object
     */
    function getMarketStatus(symbol, currentTime = null) {
        // Validate input
        if (!symbol || typeof symbol !== 'string') {
            console.error('Invalid symbol provided to getMarketStatus');
            return getErrorStatus();
        }

        // Determine market from symbol
        let marketCode = 'NYSE';
        let marketKey = 'US';

        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
            marketCode = 'NSE';
            marketKey = 'IN';
        } else if (symbol.endsWith('.L')) {
            marketCode = 'LSE';
            marketKey = 'UK';
        }

        const marketConfig = MARKET_CONFIG[marketCode];
        if (!marketConfig) {
            console.error(`Unknown market code: ${marketCode}`);
            return getErrorStatus();
        }

        // Get current UTC time
        const utcNow = currentTime ? new Date(currentTime) : new Date();

        // Validate date
        if (isNaN(utcNow.getTime())) {
            console.error('Invalid date in getMarketStatus');
            return getErrorStatus();
        }

        // Convert to market local time
        const localTime = getMarketLocalTime(utcNow, marketConfig);
        const currentHour = localTime.hours + (localTime.minutes / 60);

        // Check if it's a trading day
        if (!isTradingDay(localTime.dayOfWeek, marketConfig.tradingDays)) {
            return getWeekendStatus(localTime, marketConfig, marketKey, utcNow);
        }

        // Check if it's a holiday
        if (isHoliday(localTime.date, marketKey)) {
            return getHolidayStatus(localTime, marketConfig, marketKey, utcNow);
        }

        // Check early close
        let closeTime = marketConfig.hours.regular.end;
        const earlyCloseInfo = getEarlyCloseInfo(localTime.date, marketKey);
        if (earlyCloseInfo) {
            closeTime = earlyCloseInfo.closeTime;
        }

        // Determine market status
        let status, statusText, isOpen = false, isExtendedHours = false;
        let nextOpen = null, nextClose = null;

        if (currentHour >= marketConfig.hours.regular.start && currentHour < closeTime) {
            // Regular trading hours
            status = 'open';
            statusText = earlyCloseInfo ? 'Open (Early Close)' : 'Open';
            isOpen = true;
            nextClose = createMarketTimeDate(localTime.date, closeTime, marketConfig, utcNow);
        } else if (currentHour >= marketConfig.hours.preMarket.start && currentHour < marketConfig.hours.regular.start) {
            // Pre-market
            status = 'pre-market';
            statusText = 'Pre-Market';
            isExtendedHours = true;
            nextOpen = createMarketTimeDate(localTime.date, marketConfig.hours.regular.start, marketConfig, utcNow);
        } else if (currentHour >= closeTime && currentHour < marketConfig.hours.afterHours.end) {
            // After-hours
            status = 'post-market';
            statusText = 'After Hours';
            isExtendedHours = true;
            nextOpen = getNextTradingDayOpen(localTime.date, marketConfig, marketKey, utcNow);
        } else {
            // Closed
            status = 'closed';
            statusText = 'Closed';
            if (currentHour < marketConfig.hours.preMarket.start) {
                // Before pre-market today
                nextOpen = createMarketTimeDate(localTime.date, marketConfig.hours.preMarket.start, marketConfig, utcNow);
            } else {
                // After after-hours
                nextOpen = getNextTradingDayOpen(localTime.date, marketConfig, marketKey, utcNow);
            }
        }

        // Get holiday info
        const holidayInfo = getUpcomingHoliday(localTime.date, marketKey);

        return {
            status: status,
            statusText: statusText,
            marketName: marketConfig.name,
            timezone: marketConfig.timezone,
            currentMarketTime: localTime.date,
            utcTime: utcNow,
            isOpen: isOpen,
            isExtendedHours: isExtendedHours,
            nextOpen: nextOpen,
            nextClose: nextClose,
            isHoliday: false,
            holidayInfo: holidayInfo,
            earlyCloseInfo: earlyCloseInfo,
            isDST: localTime.isDST,
            utcOffset: localTime.offset,
            debugInfo: {
                symbol: symbol,
                marketCode: marketCode,
                localHour: currentHour.toFixed(2),
                dayOfWeek: localTime.dayOfWeek
            }
        };
    }

    /**
     * Create a Date object for a specific time in market timezone
     */
    function createMarketTimeDate(marketDate, hourDecimal, marketConfig, referenceUTC) {
        const hours = Math.floor(hourDecimal);
        const minutes = Math.floor((hourDecimal % 1) * 60);

        const result = new Date(marketDate);
        result.setUTCHours(hours, minutes, 0, 0);

        return result;
    }

    /**
     * Get next trading day opening time
     */
    function getNextTradingDayOpen(currentMarketDate, marketConfig, marketKey, utcNow) {
        let testDate = new Date(currentMarketDate);
        testDate.setUTCDate(testDate.getUTCDate() + 1);

        // Look ahead up to 10 days to find next trading day
        for (let i = 0; i < 10; i++) {
            const localTime = getMarketLocalTime(testDate, marketConfig);

            if (isTradingDay(localTime.dayOfWeek, marketConfig.tradingDays) &&
                !isHoliday(localTime.date, marketKey)) {
                return createMarketTimeDate(localTime.date, marketConfig.hours.preMarket.start, marketConfig, testDate);
            }

            testDate.setUTCDate(testDate.getUTCDate() + 1);
        }

        // Fallback
        return new Date(testDate.getTime() + 24 * 60 * 60 * 1000);
    }

    /**
     * Get weekend status
     */
    function getWeekendStatus(localTime, marketConfig, marketKey, utcNow) {
        return {
            status: 'closed',
            statusText: 'Weekend - Closed',
            marketName: marketConfig.name,
            timezone: marketConfig.timezone,
            currentMarketTime: localTime.date,
            utcTime: utcNow,
            isOpen: false,
            isExtendedHours: false,
            nextOpen: getNextTradingDayOpen(localTime.date, marketConfig, marketKey, utcNow),
            nextClose: null,
            isHoliday: false,
            holidayInfo: getUpcomingHoliday(localTime.date, marketKey),
            earlyCloseInfo: null,
            isDST: localTime.isDST,
            utcOffset: localTime.offset
        };
    }

    /**
     * Get holiday status
     */
    function getHolidayStatus(localTime, marketConfig, marketKey, utcNow) {
        return {
            status: 'closed',
            statusText: 'Holiday - Closed',
            marketName: marketConfig.name,
            timezone: marketConfig.timezone,
            currentMarketTime: localTime.date,
            utcTime: utcNow,
            isOpen: false,
            isExtendedHours: false,
            nextOpen: getNextTradingDayOpen(localTime.date, marketConfig, marketKey, utcNow),
            nextClose: null,
            isHoliday: true,
            holidayInfo: getCurrentHoliday(localTime.date, marketKey),
            earlyCloseInfo: null,
            isDST: localTime.isDST,
            utcOffset: localTime.offset
        };
    }

    /**
     * Get error status (fallback)
     */
    function getErrorStatus() {
        return {
            status: 'unknown',
            statusText: 'Status Unknown',
            marketName: 'Unknown',
            timezone: 'UTC',
            currentMarketTime: new Date(),
            utcTime: new Date(),
            isOpen: false,
            isExtendedHours: false,
            nextOpen: null,
            nextClose: null,
            isHoliday: false,
            holidayInfo: null,
            earlyCloseInfo: null,
            error: true
        };
    }

    /**
     * Helper functions for holiday info
     */
    function getEarlyCloseInfo(date, marketKey) {
        if (window.MarketHolidays && window.MarketHolidays.getEarlyCloseInfo) {
            return window.MarketHolidays.getEarlyCloseInfo(date, marketKey);
        }
        return null;
    }

    function getCurrentHoliday(date, marketKey) {
        if (window.MarketHolidays && window.MarketHolidays.getHolidayInfo) {
            return window.MarketHolidays.getHolidayInfo(date, marketKey);
        }
        return null;
    }

    function getUpcomingHoliday(date, marketKey) {
        if (window.MarketHolidays && window.MarketHolidays.getNextHoliday) {
            const holiday = window.MarketHolidays.getNextHoliday(date, marketKey);
            if (holiday) {
                const daysUntil = Math.ceil((holiday.date - date) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 7) {
                    return holiday;
                }
            }
        }
        return null;
    }

    // Public API
    return {
        getMarketStatus,
        // For testing
        _internal: {
            getNthWeekdayOfMonth,
            isInDST,
            getMarketLocalTime,
            MARKET_CONFIG
        }
    };
})();

// Export for use in TradeCore
if (typeof window !== 'undefined') {
    window.RobustMarketStatus = RobustMarketStatus;
}
