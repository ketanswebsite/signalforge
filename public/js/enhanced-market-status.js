/**
 * Enhanced getMarketStatus function with holiday support
 * This will replace the existing function in trade-core.js
 */

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
    let marketTime;
    let hours, minutes, day;
    
    try {
        // This method might not work in all browsers
        const marketTimeStr = now.toLocaleString("en-US", {timeZone: timezone});
        marketTime = new Date(marketTimeStr);
        hours = marketTime.getHours();
        minutes = marketTime.getMinutes();
        day = marketTime.getDay(); // 0 = Sunday, 6 = Saturday
    } catch (e) {
        console.warn(`Timezone conversion failed for ${timezone}, using local time`, e);
        // Fallback to local time
        marketTime = now;
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
            nextOpen = new Date(nextTradingDay);
            nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
        } else {
            // Fallback to simple next day calculation
            nextOpen = new Date(marketTime);
            nextOpen.setDate(nextOpen.getDate() + 1);
            nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
        }
    } else if (!schedule.days.includes(day)) {
        // Weekend
        statusText = 'Weekend - Closed';
        
        // Calculate next trading day (considering holidays)
        if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
            const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
            nextOpen = new Date(nextTradingDay);
            nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
        } else {
            // Fallback to next Monday
            const daysUntilMonday = (8 - day) % 7 || 7;
            nextOpen = new Date(marketTime);
            nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
            nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
        }
    } else {
        // It's a weekday and not a holiday
        if (currentTime >= schedule.open && currentTime < schedule.close) {
            status = 'open';
            statusText = earlyCloseInfo ? 'Open (Early Close)' : 'Open';
            isOpen = true;
            // Calculate next close time
            nextClose = new Date(marketTime);
            nextClose.setHours(Math.floor(schedule.close), (schedule.close % 1) * 60, 0, 0);
        } else if (currentTime >= schedule.preOpen && currentTime < schedule.open) {
            status = 'pre-market';
            statusText = 'Pre-Market';
            isExtendedHours = true;
            // Calculate next open time
            nextOpen = new Date(marketTime);
            nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
        } else if (currentTime >= schedule.close && currentTime < schedule.postClose) {
            status = 'post-market';
            statusText = 'After Hours';
            isExtendedHours = true;
            
            // Calculate next open time (next trading day)
            if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                nextOpen = new Date(nextTradingDay);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            } else {
                // Fallback to tomorrow
                nextOpen = new Date(marketTime);
                nextOpen.setDate(nextOpen.getDate() + 1);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            }
        } else {
            // Outside all trading hours
            statusText = 'Closed';
            if (currentTime < schedule.preOpen) {
                // Before pre-market today
                nextOpen = new Date(marketTime);
                nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
            } else {
                // After post-market, next open is next trading day
                if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                    const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                    nextOpen = new Date(nextTradingDay);
                    nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
                } else {
                    // Fallback to tomorrow
                    nextOpen = new Date(marketTime);
                    nextOpen.setDate(nextOpen.getDate() + 1);
                    nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
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
        currentMarketTime: marketTime,
        isOpen: isOpen,
        isExtendedHours: isExtendedHours,
        nextOpen: nextOpen,
        nextClose: nextClose,
        isHoliday: isHoliday,
        holidayInfo: holidayInfo,
        earlyCloseInfo: earlyCloseInfo
    };
}