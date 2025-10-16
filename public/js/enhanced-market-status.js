/**
 * Enhanced getMarketStatus function with holiday support
 * This will replace the existing function in trade-core.js
 */

/**
 * Helper function to create a Date object for a specific time in a specific timezone
 * @param {Date} baseDate - Base date to use (will extract year/month/day in target timezone)
 * @param {number} hour - Hour in 24h format (can be decimal, e.g., 9.25 for 9:15)
 * @param {string} timezone - IANA timezone string
 * @returns {Date} Date object representing the specified time in the timezone
 */
function setTimeInTimezone(baseDate, hour, timezone) {
    // Get date components in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(baseDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;

    const hourInt = Math.floor(hour);
    const minute = Math.round((hour % 1) * 60);

    // Create ISO string representing the target time
    const targetStr = `${year}-${month}-${day}T${String(hourInt).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

    // Create a date and format it back in the target timezone to verify
    const testDate = new Date(targetStr);
    const testParts = formatter.formatToParts(testDate);
    const testHour = parseInt(testParts.find(p => p.type === 'hour').value);
    const testMinute = parseInt(testParts.find(p => p.type === 'minute').value);

    // Calculate the difference between what we want and what we got
    const targetMinutes = hourInt * 60 + minute;
    const testMinutes = testHour * 60 + testMinute;
    const diff = targetMinutes - testMinutes;

    // Adjust by the difference
    const result = new Date(testDate.getTime() + diff * 60 * 1000);

    return result;
}

function getMarketStatus(symbol) {
    // Determine market from symbol
    let marketKey = 'US';
    let marketName = 'US Market';
    let timezone = 'America/New_York';
    let marketCode = 'NYSE';

    if (symbol.endsWith('.NS')) {
        marketKey = 'IN';
        marketName = 'India (NSE)';
        timezone = 'Asia/Kolkata';
        marketCode = 'NSE';
    } else if (symbol.endsWith('.L')) {
        marketKey = 'UK';
        marketName = 'UK (LSE)';
        timezone = 'Europe/London';
        marketCode = 'LSE';
    }
    
    // Get current time in market timezone
    const now = new Date();
    let marketTime = now; // Keep as actual Date object for calculations
    let hours, minutes, day;
    
    try {
        // Get the time components in the market timezone
        const marketTimeStr = now.toLocaleString("en-US", {
            timeZone: timezone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        
        // Parse the components
        const [date, time] = marketTimeStr.split(', ');
        const [month, dayStr, year] = date.split('/');
        const [hourStr, minuteStr, secondStr] = time.split(':');
        
        hours = parseInt(hourStr, 10);
        minutes = parseInt(minuteStr, 10);
        day = new Date(year, month - 1, dayStr).getDay(); // 0 = Sunday, 6 = Saturday
    } catch (e) {
        // Fallback to local time
        hours = now.getHours();
        minutes = now.getMinutes();
        day = now.getDay();
    }
    
    // Market hours in local market time
    const marketHours = {
        'NYSE': { open: 9.5, close: 16, preOpen: 4, postClose: 20, days: [1,2,3,4,5] }, // 9:30 AM - 4:00 PM EST
        'NASDAQ': { open: 9.5, close: 16, preOpen: 4, postClose: 20, days: [1,2,3,4,5] },
        'NSE': { open: 9.25, close: 15.5, preOpen: 9, postClose: 16, days: [1,2,3,4,5] }, // 9:15 AM - 3:30 PM IST
        'BSE': { open: 9.25, close: 15.5, preOpen: 9, postClose: 16, days: [1,2,3,4,5] },
        'LSE': { open: 8, close: 16.5, preOpen: 5.5, postClose: 17.5, days: [1,2,3,4,5] }, // 8:00 AM - 4:30 PM GMT
        'FTSE': { open: 8, close: 16.5, preOpen: 5.5, postClose: 17.5, days: [1,2,3,4,5] }
    };
    
    const schedule = marketHours[marketCode] || { open: 9, close: 17, preOpen: 8, postClose: 18, days: [1,2,3,4,5] };
    
    // Check for early close days
    let earlyCloseInfo = null;
    if (window.MarketHolidays && window.MarketHolidays.getEarlyCloseInfo) {
        earlyCloseInfo = window.MarketHolidays.getEarlyCloseInfo(marketTime, marketKey);
        if (earlyCloseInfo) {
            schedule.close = earlyCloseInfo.closeTime;
        }
    }
    
    const currentTime = hours + (minutes / 60);
    
    let status = 'closed';
    let statusText = 'Closed';
    let isOpen = false;
    let isExtendedHours = false;
    let nextOpen = null;
    let nextClose = null;
    let holidayInfo = null;
    
    // Check if today is a holiday
    const isHoliday = window.MarketHolidays && window.MarketHolidays.isMarketHoliday 
        ? window.MarketHolidays.isMarketHoliday(marketTime, marketKey) 
        : false;
    
    if (isHoliday) {
        statusText = 'Holiday - Closed';
        // Get next holiday info if available
        if (window.MarketHolidays && window.MarketHolidays.getNextHoliday) {
            const nextHoliday = window.MarketHolidays.getNextHoliday(marketTime, marketKey);
            if (nextHoliday) {
                holidayInfo = nextHoliday;
            }
        }
        
        // Calculate next trading day
        if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
            const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
            nextOpen = setTimeInTimezone(new Date(nextTradingDay), schedule.open, timezone);
        } else {
            // Fallback to simple next day calculation
            const tomorrow = new Date(marketTime.getTime() + 24 * 60 * 60 * 1000);
            nextOpen = setTimeInTimezone(tomorrow, schedule.open, timezone);
        }
    } else if (!schedule.days.includes(day)) {
        // Weekend
        statusText = 'Weekend - Closed';

        // Calculate next trading day (considering holidays)
        if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
            const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
            nextOpen = setTimeInTimezone(new Date(nextTradingDay), schedule.open, timezone);
        } else {
            // Fallback to next Monday
            const daysUntilMonday = (8 - day) % 7 || 7;
            const nextMonday = new Date(marketTime.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
            nextOpen = setTimeInTimezone(nextMonday, schedule.open, timezone);
        }
    } else {
        // It's a weekday and not a holiday
        if (currentTime >= schedule.open && currentTime < schedule.close) {
            status = 'open';
            statusText = earlyCloseInfo ? 'Open (Early Close)' : 'Open';
            isOpen = true;
            // Calculate next close time
            nextClose = setTimeInTimezone(marketTime, schedule.close, timezone);
        } else if (currentTime >= schedule.preOpen && currentTime < schedule.open) {
            status = 'pre-market';
            statusText = 'Pre-Market';
            isExtendedHours = true;
            // Calculate next open time
            nextOpen = setTimeInTimezone(marketTime, schedule.open, timezone);
        } else if (currentTime >= schedule.close && currentTime < schedule.postClose) {
            status = 'post-market';
            statusText = 'After Hours';
            isExtendedHours = true;

            // Calculate next open time (next trading day)
            if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                nextOpen = setTimeInTimezone(new Date(nextTradingDay), schedule.open, timezone);
            } else {
                // Fallback to tomorrow
                const tomorrow = new Date(marketTime.getTime() + 24 * 60 * 60 * 1000);
                nextOpen = setTimeInTimezone(tomorrow, schedule.open, timezone);
            }
        } else {
            // Outside all trading hours
            statusText = 'Closed';
            if (currentTime < schedule.preOpen) {
                // Before pre-market today
                nextOpen = setTimeInTimezone(marketTime, schedule.preOpen, timezone);
            } else {
                // After post-market, next open is next trading day
                if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                    const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                    nextOpen = setTimeInTimezone(new Date(nextTradingDay), schedule.preOpen, timezone);
                } else {
                    // Fallback to tomorrow
                    const tomorrow = new Date(marketTime.getTime() + 24 * 60 * 60 * 1000);
                    nextOpen = setTimeInTimezone(tomorrow, schedule.preOpen, timezone);
                }
            }
        }
    }
    
    // Get upcoming holiday info
    if (!holidayInfo && window.MarketHolidays && window.MarketHolidays.getNextHoliday) {
        const upcomingHoliday = window.MarketHolidays.getNextHoliday(marketTime, marketKey);
        if (upcomingHoliday) {
            // Only show if within next 7 days
            const daysUntil = Math.ceil((upcomingHoliday.date - marketTime) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 7) {
                holidayInfo = upcomingHoliday;
            }
        }
    }
    
    return {
        status: status,
        statusText: statusText,
        marketName: marketName,
        timezone: timezone,
        currentMarketTime: now, // Return the actual Date object, not the parsed one
        isOpen: isOpen,
        isExtendedHours: isExtendedHours,
        nextOpen: nextOpen,
        nextClose: nextClose,
        isHoliday: isHoliday,
        holidayInfo: holidayInfo,
        earlyCloseInfo: earlyCloseInfo
    };
}