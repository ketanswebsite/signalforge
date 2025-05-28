/**
 * Market Holiday Management
 * Handles holiday schedules for different stock markets
 */

// Market holidays for major exchanges (2024-2025)
const marketHolidays = {
    'US': [
        // 2024
        '2024-01-01', // New Year's Day
        '2024-01-15', // Martin Luther King Jr. Day
        '2024-02-19', // Presidents' Day
        '2024-03-29', // Good Friday
        '2024-05-27', // Memorial Day
        '2024-06-19', // Juneteenth
        '2024-07-04', // Independence Day
        '2024-09-02', // Labor Day
        '2024-11-28', // Thanksgiving
        '2024-12-25', // Christmas
        
        // 2025
        '2025-01-01', // New Year's Day
        '2025-01-20', // Martin Luther King Jr. Day
        '2025-02-17', // Presidents' Day
        '2025-04-18', // Good Friday
        '2025-05-26', // Memorial Day
        '2025-06-19', // Juneteenth
        '2025-07-04', // Independence Day
        '2025-09-01', // Labor Day
        '2025-11-27', // Thanksgiving
        '2025-12-25', // Christmas
    ],
    
    'IN': [
        // 2024
        '2024-01-26', // Republic Day
        '2024-03-08', // Mahashivratri
        '2024-03-25', // Holi
        '2024-03-29', // Good Friday
        '2024-04-11', // Id-Ul-Fitr
        '2024-04-14', // Dr. Ambedkar Jayanti
        '2024-04-17', // Ram Navami
        '2024-04-21', // Mahavir Jayanti
        '2024-05-01', // Maharashtra Day
        '2024-05-23', // Buddha Purnima
        '2024-06-17', // Bakri Id
        '2024-08-15', // Independence Day
        '2024-08-19', // Parsi New Year
        '2024-09-07', // Ganesh Chaturthi
        '2024-10-02', // Gandhi Jayanti
        '2024-10-12', // Dussehra
        '2024-11-01', // Diwali (Laxmi Pujan)
        '2024-11-02', // Diwali (Balipratipada)
        '2024-11-15', // Guru Nanak Jayanti
        
        // 2025
        '2025-01-14', // Makar Sankranti
        '2025-01-26', // Republic Day
        '2025-02-26', // Mahashivratri
        '2025-03-14', // Holi
        '2025-03-31', // Id-Ul-Fitr
        '2025-04-10', // Mahavir Jayanti
        '2025-04-14', // Dr. Ambedkar Jayanti
        '2025-04-18', // Good Friday
        '2025-05-01', // Maharashtra Day
        '2025-05-12', // Buddha Purnima
        '2025-06-07', // Bakri Id
        '2025-08-15', // Independence Day
        '2025-08-16', // Parsi New Year
        '2025-08-27', // Ganesh Chaturthi
        '2025-10-02', // Gandhi Jayanti
        '2025-10-21', // Diwali (Laxmi Pujan)
        '2025-11-05', // Guru Nanak Jayanti
    ],
    
    'UK': [
        // 2024
        '2024-01-01', // New Year's Day
        '2024-03-29', // Good Friday
        '2024-04-01', // Easter Monday
        '2024-05-06', // Early May Bank Holiday
        '2024-05-27', // Spring Bank Holiday
        '2024-08-26', // Summer Bank Holiday
        '2024-12-25', // Christmas Day
        '2024-12-26', // Boxing Day
        
        // 2025
        '2025-01-01', // New Year's Day
        '2025-04-18', // Good Friday
        '2025-04-21', // Easter Monday
        '2025-05-05', // Early May Bank Holiday
        '2025-05-26', // Spring Bank Holiday
        '2025-08-25', // Summer Bank Holiday
        '2025-12-25', // Christmas Day
        '2025-12-26', // Boxing Day
    ]
};

// Early close days (market closes early)
const earlyCloseDays = {
    'US': [
        { date: '2024-07-03', closeTime: 13 }, // Day before Independence Day (1 PM)
        { date: '2024-11-29', closeTime: 13 }, // Day after Thanksgiving (1 PM)
        { date: '2024-12-24', closeTime: 13 }, // Christmas Eve (1 PM)
        { date: '2025-07-03', closeTime: 13 }, // Day before Independence Day (1 PM)
        { date: '2025-11-28', closeTime: 13 }, // Day after Thanksgiving (1 PM)
        { date: '2025-12-24', closeTime: 13 }, // Christmas Eve (1 PM)
    ],
    'UK': [
        { date: '2024-12-24', closeTime: 12.5 }, // Christmas Eve (12:30 PM)
        { date: '2024-12-31', closeTime: 12.5 }, // New Year's Eve (12:30 PM)
        { date: '2025-12-24', closeTime: 12.5 }, // Christmas Eve (12:30 PM)
        { date: '2025-12-31', closeTime: 12.5 }, // New Year's Eve (12:30 PM)
    ]
};

/**
 * Check if a given date is a market holiday
 * @param {Date} date - The date to check
 * @param {string} marketKey - The market identifier ('US', 'IN', 'UK')
 * @returns {boolean} True if the date is a holiday
 */
function isMarketHoliday(date, marketKey) {
    const dateStr = date.toISOString().split('T')[0];
    const holidays = marketHolidays[marketKey] || [];
    return holidays.includes(dateStr);
}

/**
 * Get the next market holiday
 * @param {Date} fromDate - The date to start checking from
 * @param {string} marketKey - The market identifier
 * @returns {Object|null} Holiday information or null
 */
function getNextHoliday(fromDate, marketKey) {
    const holidays = marketHolidays[marketKey] || [];
    const fromDateStr = fromDate.toISOString().split('T')[0];
    
    for (const holiday of holidays) {
        if (holiday > fromDateStr) {
            return {
                date: new Date(holiday),
                dateStr: holiday,
                name: getHolidayName(holiday, marketKey)
            };
        }
    }
    return null;
}

/**
 * Check if market has early close on a given date
 * @param {Date} date - The date to check
 * @param {string} marketKey - The market identifier
 * @returns {Object|null} Early close info or null
 */
function getEarlyCloseInfo(date, marketKey) {
    const dateStr = date.toISOString().split('T')[0];
    const earlyCloses = earlyCloseDays[marketKey] || [];
    
    const earlyClose = earlyCloses.find(ec => ec.date === dateStr);
    return earlyClose || null;
}

/**
 * Get holiday name (simplified version - can be expanded)
 * @param {string} dateStr - The date string
 * @param {string} marketKey - The market identifier
 * @returns {string} Holiday name
 */
function getHolidayName(dateStr, marketKey) {
    // This is a simplified version. In a real app, you'd have a mapping of dates to holiday names
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Some common holidays
    if (month === 1 && day === 1) return "New Year's Day";
    if (month === 12 && day === 25) return "Christmas Day";
    if (month === 7 && day === 4 && marketKey === 'US') return "Independence Day";
    if (month === 8 && day === 15 && marketKey === 'IN') return "Independence Day";
    if (month === 1 && day === 26 && marketKey === 'IN') return "Republic Day";
    
    return "Market Holiday";
}

/**
 * Get the next trading day (skipping weekends and holidays)
 * @param {Date} fromDate - The date to start from
 * @param {string} marketKey - The market identifier
 * @returns {Date} The next trading day
 */
function getNextTradingDay(fromDate, marketKey) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);
    
    while (true) {
        const dayOfWeek = date.getDay();
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            date.setDate(date.getDate() + 1);
            continue;
        }
        
        // Skip holidays
        if (isMarketHoliday(date, marketKey)) {
            date.setDate(date.getDate() + 1);
            continue;
        }
        
        break;
    }
    
    return date;
}

/**
 * Calculate business days between two dates (excluding weekends and holidays)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} marketKey - The market identifier
 * @returns {number} Number of business days
 */
function getBusinessDaysBetween(startDate, endDate, marketKey) {
    let count = 0;
    const date = new Date(startDate);
    
    while (date <= endDate) {
        const dayOfWeek = date.getDay();
        
        // Count only weekdays that are not holidays
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isMarketHoliday(date, marketKey)) {
            count++;
        }
        
        date.setDate(date.getDate() + 1);
    }
    
    return count;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isMarketHoliday,
        getNextHoliday,
        getEarlyCloseInfo,
        getNextTradingDay,
        getBusinessDaysBetween,
        marketHolidays,
        earlyCloseDays
    };
} else {
    // For browser use
    window.MarketHolidays = {
        isMarketHoliday,
        getNextHoliday,
        getEarlyCloseInfo,
        getNextTradingDay,
        getBusinessDaysBetween,
        marketHolidays,
        earlyCloseDays
    };
}