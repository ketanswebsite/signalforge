/**
 * Market Status Manager - Robust time calculation and display
 */

(function() {
    'use strict';

    /**
     * Get timezone abbreviation (ET, IST, GMT, etc.)
     * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
     * @param {Date} date - Date to check for DST
     * @returns {string} Timezone abbreviation
     */
    function getTimezoneAbbreviation(timezone, date = new Date()) {
        // Map of common timezones to their abbreviations
        const timezoneMap = {
            'America/New_York': isDST(date, 'America/New_York') ? 'EDT' : 'EST',
            'America/Chicago': isDST(date, 'America/Chicago') ? 'CDT' : 'CST',
            'America/Denver': isDST(date, 'America/Denver') ? 'MDT' : 'MST',
            'America/Los_Angeles': isDST(date, 'America/Los_Angeles') ? 'PDT' : 'PST',
            'Asia/Kolkata': 'IST',
            'Asia/Calcutta': 'IST',
            'Europe/London': isDST(date, 'Europe/London') ? 'BST' : 'GMT',
            'Europe/Paris': isDST(date, 'Europe/Paris') ? 'CEST' : 'CET',
            'Asia/Tokyo': 'JST',
            'Asia/Hong_Kong': 'HKT',
            'Asia/Singapore': 'SGT',
            'Australia/Sydney': isDST(date, 'Australia/Sydney') ? 'AEDT' : 'AEST'
        };

        return timezoneMap[timezone] || timezone.split('/')[1] || 'UTC';
    }

    /**
     * Check if a date is in daylight saving time for a timezone
     * @param {Date} date - Date to check
     * @param {string} timezone - IANA timezone
     * @returns {boolean} True if DST is active
     */
    function isDST(date, timezone) {
        const jan = new Date(date.getFullYear(), 0, 1);
        const jul = new Date(date.getFullYear(), 6, 1);

        const janOffset = parseFloat(jan.toLocaleString('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
        }).split('GMT')[1]);

        const julOffset = parseFloat(jul.toLocaleString('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
        }).split('GMT')[1]);

        const currentOffset = parseFloat(date.toLocaleString('en-US', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
        }).split('GMT')[1]);

        const stdOffset = Math.max(janOffset, julOffset);

        return currentOffset < stdOffset;
    }

    /**
     * Calculate time difference with timezone awareness
     * @param {Date} targetTime - The target time (open/close)
     * @param {Date} currentTime - The current time in market timezone
     * @returns {Object} Time difference object with days, hours, minutes, seconds
     */
    function calculateTimeDifference(targetTime, currentTime) {
        if (!targetTime || !currentTime) {
            return null;
        }

        // Calculate difference in milliseconds
        const diff = targetTime.getTime() - currentTime.getTime();
        
        if (diff <= 0) {
            return null;
        }

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
            totalMilliseconds: diff,
            days: days,
            hours: hours % 24,
            minutes: minutes % 60,
            seconds: seconds % 60,
            totalHours: hours,
            totalMinutes: minutes
        };
    }

    /**
     * Format time difference for display
     * @param {Object} timeDiff - Time difference object
     * @param {string} action - 'opens' or 'closes'
     * @returns {string} Formatted time string
     */
    function formatTimeDifference(timeDiff, action) {
        if (!timeDiff || timeDiff.totalMilliseconds <= 0) {
            return '';
        }

        const { days, hours, minutes, totalMinutes } = timeDiff;

        // Very short time (less than 1 minute)
        if (totalMinutes < 1) {
            return `${action} in less than 1m`;
        }

        // Less than 1 hour
        if (totalMinutes < 60) {
            return `${action} in ${minutes}m`;
        }

        // Less than 24 hours
        if (days === 0) {
            if (minutes === 0) {
                return `${action} in ${hours}h`;
            }
            return `${action} in ${hours}h ${minutes}m`;
        }

        // More than 24 hours
        if (hours === 0) {
            return `${action} in ${days}d`;
        }
        return `${action} in ${days}d ${hours}h`;
    }

    /**
     * Get enhanced market status with reliable time calculations
     * @param {string} symbol - Stock symbol
     * @returns {Object} Enhanced market status
     */
    window.getEnhancedMarketStatus = function(symbol) {
        // Get base market status
        const status = getMarketStatus(symbol);
        
        if (!status) {
            return null;
        }

        // Enhanced status object
        const enhanced = Object.assign({}, status);
        
        // Use the current market time from the status
        const currentMarketTime = status.currentMarketTime;
        
        // Calculate time differences
        if (status.nextOpen) {
            enhanced.timeToOpen = calculateTimeDifference(status.nextOpen, currentMarketTime);
        }
        
        if (status.nextClose) {
            enhanced.timeToClose = calculateTimeDifference(status.nextClose, currentMarketTime);
        }

        // Generate display text based on status
        enhanced.displayText = status.statusText;
        enhanced.nextActionText = '';
        enhanced.reasonText = '';

        // Add holiday information to display (highest priority)
        if (status.isHoliday && status.holidayInfo) {
            enhanced.displayText = `${status.holidayInfo.name}`;
            enhanced.reasonText = 'Market Holiday';
            if (enhanced.timeToOpen) {
                enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Opens');
            } else {
                enhanced.nextActionText = 'Reopens next trading day';
            }
        }
        // Add early close information
        else if (status.earlyCloseInfo) {
            enhanced.displayText = 'Open (Early Close)';
            if (enhanced.timeToClose) {
                const closeTimeStr = status.earlyCloseInfo.closeTime;
                enhanced.nextActionText = `Closes early at ${closeTimeStr}:00`;
                enhanced.reasonText = formatTimeDifference(enhanced.timeToClose, 'Closes');
            }
        }
        // Regular status display with comprehensive info
        else {
            switch (status.status) {
                case 'closed':
                    // Determine specific reason for closure
                    const currentDate = new Date();
                    const dayOfWeek = currentDate.getDay();

                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        enhanced.displayText = 'Weekend';
                        enhanced.reasonText = 'Market Closed';
                    } else {
                        enhanced.displayText = 'Market Closed';
                        enhanced.reasonText = 'Outside Trading Hours';
                    }

                    // Always provide next open time
                    if (enhanced.timeToOpen) {
                        enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Opens');
                    } else if (status.nextOpen) {
                        const nextOpenDate = status.nextOpen.toLocaleDateString('en-US', {
                            timeZone: status.timezone,
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        });
                        const nextOpenTime = status.nextOpen.toLocaleTimeString('en-US', {
                            timeZone: status.timezone,
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        enhanced.nextActionText = `Opens ${nextOpenDate} at ${nextOpenTime}`;
                    }
                    break;

                case 'pre-market':
                    enhanced.displayText = 'Pre-Market';
                    enhanced.reasonText = 'Extended Trading Hours';

                    if (enhanced.timeToOpen) {
                        enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Market opens');
                    } else if (status.nextOpen) {
                        const openTime = status.nextOpen.toLocaleTimeString('en-US', {
                            timeZone: status.timezone,
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        enhanced.nextActionText = `Market opens at ${openTime}`;
                    }
                    break;

                case 'open':
                    enhanced.displayText = 'Market Open';
                    enhanced.reasonText = 'Regular Trading Hours';

                    if (enhanced.timeToClose) {
                        enhanced.nextActionText = formatTimeDifference(enhanced.timeToClose, 'Closes');
                    } else if (status.nextClose) {
                        const closeTime = status.nextClose.toLocaleTimeString('en-US', {
                            timeZone: status.timezone,
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        enhanced.nextActionText = `Closes at ${closeTime}`;
                    }
                    break;

                case 'post-market':
                    enhanced.displayText = 'After Hours';
                    enhanced.reasonText = 'Extended Trading Hours';

                    if (enhanced.timeToOpen) {
                        enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Market opens');
                    } else if (status.nextOpen) {
                        const nextOpenDate = status.nextOpen.toLocaleDateString('en-US', {
                            timeZone: status.timezone,
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        });
                        const nextOpenTime = status.nextOpen.toLocaleTimeString('en-US', {
                            timeZone: status.timezone,
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        enhanced.nextActionText = `Opens ${nextOpenDate} at ${nextOpenTime}`;
                    }
                    break;
            }
        }

        return enhanced;
    };

    /**
     * Create market status badge element
     * @param {Object} marketStatus - Enhanced market status
     * @param {number} tradeCount - Number of trades in this market
     * @returns {HTMLElement} Badge element
     */
    window.createMarketStatusBadge = function(marketStatus, tradeCount = 0) {
        const badge = document.createElement('div');
        badge.className = `market-status-badge ${marketStatus.status}${marketStatus.isHoliday ? ' holiday' : ''}`;
        
        // Add status indicator
        const indicator = document.createElement('span');
        indicator.className = 'market-status-indicator';
        badge.appendChild(indicator);
        
        // Create badge content
        const content = document.createElement('div');
        content.className = 'market-badge-content';
        
        // Market name and status
        const header = document.createElement('div');
        header.className = 'market-badge-header';
        
        const marketNameSpan = document.createElement('span');
        marketNameSpan.className = 'market-name';
        marketNameSpan.textContent = marketStatus.marketName;
        header.appendChild(marketNameSpan);
        
        const marketStatusSpan = document.createElement('span');
        marketStatusSpan.className = 'market-status';
        marketStatusSpan.textContent = marketStatus.displayText;
        header.appendChild(marketStatusSpan);

        content.appendChild(header);

        // Reason text (if available)
        if (marketStatus.reasonText) {
            const reasonDiv = document.createElement('div');
            reasonDiv.className = 'market-reason-text';
            reasonDiv.textContent = marketStatus.reasonText;
            content.appendChild(reasonDiv);
        }

        // Next action time with smooth updates
        if (marketStatus.nextActionText) {
            const nextAction = document.createElement('div');
            nextAction.className = 'market-next-action';
            nextAction.textContent = marketStatus.nextActionText;
            nextAction.style.transition = 'opacity 0.3s ease';
            content.appendChild(nextAction);
        }
        
        // Trade count if provided
        if (tradeCount > 0) {
            const trades = document.createElement('div');
            trades.className = 'market-trade-count';
            trades.textContent = `${tradeCount} ${tradeCount === 1 ? 'trade' : 'trades'}`;
            content.appendChild(trades);
        }
        
        // Current market time with timezone
        const marketTime = document.createElement('div');
        marketTime.className = 'market-current-time';
        const timeStr = marketStatus.currentMarketTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: marketStatus.timezone
        });

        // Get timezone abbreviation
        const timezoneAbbr = getTimezoneAbbreviation(marketStatus.timezone, marketStatus.currentMarketTime);
        marketTime.textContent = `${timeStr} ${timezoneAbbr}`;
        content.appendChild(marketTime);
        
        badge.appendChild(content);
        
        // Add click handler for interactive feedback
        badge.addEventListener('click', function() {
            // Add click animation
            badge.style.transform = 'scale(0.98)';
            setTimeout(() => {
                badge.style.transform = '';
            }, 150);
            
            // Show detailed market information
            const marketTimeStr = marketStatus.currentMarketTime.toLocaleTimeString('en-US', {
                timeZone: marketStatus.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const timezoneAbbr = getTimezoneAbbreviation(marketStatus.timezone, marketStatus.currentMarketTime);
            const fullDate = marketStatus.currentMarketTime.toLocaleDateString('en-US', {
                timeZone: marketStatus.timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            let message = `${marketStatus.marketName}: ${marketTimeStr} ${timezoneAbbr}\n${fullDate}`;

            if (marketStatus.earlyCloseInfo) {
                message += `\nEarly close today at ${marketStatus.earlyCloseInfo.closeTime}:00`;
            }
            
            if (marketStatus.holidayInfo) {
                const daysUntil = Math.ceil((marketStatus.holidayInfo.date - new Date()) / (1000 * 60 * 60 * 24));
                message += `\n${marketStatus.isHoliday ? 'Today' : `In ${daysUntil} days`}: ${marketStatus.holidayInfo.name}`;
            }
            
            // Use TradeCore notification if available
            if (window.TradeCore && window.TradeCore.showNotification) {
                window.TradeCore.showNotification(message, 'info');
            } else {
            }
        });
        
        // Add hover effect
        badge.addEventListener('mouseenter', function() {
            badge.style.cursor = 'pointer';
        });
        
        // Add data attributes for debugging
        badge.setAttribute('data-market-status', marketStatus.status);
        badge.setAttribute('data-market-timezone', marketStatus.timezone);
        if (marketStatus.nextOpen) {
            badge.setAttribute('data-next-open', marketStatus.nextOpen.toISOString());
        }
        if (marketStatus.nextClose) {
            badge.setAttribute('data-next-close', marketStatus.nextClose.toISOString());
        }
        
        // Add entrance animation
        badge.style.opacity = '0';
        badge.style.transform = 'translateY(10px)';
        setTimeout(() => {
            badge.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            badge.style.opacity = '1';
            badge.style.transform = 'translateY(0)';
        }, 50);
        
        return badge;
    };

    /**
     * Test market status calculations
     * Run this in console to verify calculations
     */
    window.testMarketStatus = function() {
        const testSymbols = ['AAPL', 'RELIANCE.NS', 'BP.L'];
        const results = [];
        
        testSymbols.forEach(symbol => {
            const status = window.getEnhancedMarketStatus(symbol);
            results.push({
                symbol: symbol,
                market: status.marketName,
                status: status.status,
                currentMarketTime: status.currentMarketTime.toLocaleString(),
                nextOpen: status.nextOpen ? status.nextOpen.toLocaleString() : 'N/A',
                nextClose: status.nextClose ? status.nextClose.toLocaleString() : 'N/A',
                displayText: status.displayText,
                nextActionText: status.nextActionText,
                timeToOpen: status.timeToOpen,
                timeToClose: status.timeToClose
            });
        });
        
        console.table(results);
        return results;
    };

})();