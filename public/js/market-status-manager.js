/**
 * Market Status Manager - Robust time calculation and display
 */

(function() {
    'use strict';

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

        switch (status.status) {
            case 'closed':
                if (enhanced.timeToOpen) {
                    enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Opens');
                }
                break;
                
            case 'pre-market':
                if (enhanced.timeToOpen) {
                    enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Market opens');
                }
                break;
                
            case 'open':
                if (enhanced.timeToClose) {
                    enhanced.nextActionText = formatTimeDifference(enhanced.timeToClose, 'Closes');
                }
                break;
                
            case 'post-market':
                if (enhanced.timeToClose) {
                    enhanced.nextActionText = formatTimeDifference(enhanced.timeToClose, 'After-hours ends');
                } else if (enhanced.timeToOpen) {
                    enhanced.nextActionText = formatTimeDifference(enhanced.timeToOpen, 'Opens');
                }
                break;
        }

        // Add holiday information to display
        if (status.isHoliday && status.holidayInfo) {
            enhanced.displayText = `Holiday - ${status.holidayInfo.name}`;
        }

        // Add early close information
        if (status.earlyCloseInfo) {
            enhanced.displayText += ' (Early Close)';
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
        
        // Current market time
        const marketTime = document.createElement('div');
        marketTime.className = 'market-current-time';
        const timeStr = marketStatus.currentMarketTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: marketStatus.timezone
        });
        marketTime.textContent = `${timeStr}`;
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
            
            let message = `${marketStatus.marketName}: ${marketTimeStr} (${marketStatus.timezone.split('/')[1]})`;
            
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
                console.log(message);
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