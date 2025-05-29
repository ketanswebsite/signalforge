/**
 * Backtest Alerts Module
 * Sends high-conviction trading signals via Telegram
 */

const BacktestAlerts = (function() {
    
    /**
     * Check if a date is within the last 5 trading days
     * Handles weekends properly (Mon includes Thu/Fri from previous week)
     */
    function isWithinTradingDays(signalDate, currentDate = new Date()) {
        const signal = new Date(signalDate);
        const today = new Date(currentDate);
        
        // Reset time to start of day for accurate comparison
        signal.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const todayDay = today.getDay();
        
        // Calculate valid trading days based on current day
        const validDates = [];
        let tempDate = new Date(today);
        
        // Add today first
        validDates.push(new Date(tempDate));
        
        // Go back 5 trading days
        let tradingDaysCount = 0;
        let daysBack = 0;
        
        while (tradingDaysCount < 5 && daysBack < 10) { // safety limit
            daysBack++;
            tempDate.setDate(tempDate.getDate() - 1);
            const dayOfWeek = tempDate.getDay();
            
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                validDates.push(new Date(tempDate));
                tradingDaysCount++;
            }
        }
        
        // Check if signal date matches any valid date
        return validDates.some(validDate => {
            validDate.setHours(0, 0, 0, 0);
            return signal.getTime() === validDate.getTime();
        });
    }
    
    /**
     * Filter opportunities for high conviction only
     */
    function getHighConvictionOpportunities(opportunities, allTrades) {
        if (!opportunities || opportunities.length === 0) return [];
        
        // For opportunity scans (no completed trades), use existing opportunities as-is
        if (allTrades.length === 0) {
            console.log('🔍 Using existing buying opportunities from scan...');
            console.log(`🔍 Total opportunities: ${opportunities.length}`);
            
            // Debug: Show what stocks are actually in the opportunities
            if (opportunities.length > 0) {
                console.log('🔍 First 10 opportunity symbols:', opportunities.slice(0, 10).map(opp => opp.stock?.symbol));
                
                // Show sample of different stock types
                const indianStocks = opportunities.filter(opp => opp.stock?.symbol?.includes('.NS')).slice(0, 3);
                const usStocks = opportunities.filter(opp => opp.stock?.symbol && !opp.stock.symbol.includes('.NS') && !opp.stock.symbol.includes('.L')).slice(0, 3);
                const ukStocks = opportunities.filter(opp => opp.stock?.symbol?.includes('.L')).slice(0, 3);
                
                console.log('🔍 Sample Indian stocks:', indianStocks.map(opp => opp.stock?.symbol));
                console.log('🔍 Sample US stocks:', usStocks.map(opp => opp.stock?.symbol));
                console.log('🔍 Sample UK stocks:', ukStocks.map(opp => opp.stock?.symbol));
                
                // Check the correct scan type selector
                const scanTypeSelector = document.getElementById('scan-type-selector');
                const currentScanType = scanTypeSelector ? scanTypeSelector.value : 'current';
                console.log('🔍 Current scan type selector value:', currentScanType);
                
                // Check if opportunities match current scan type
                const hasIndianStocks = opportunities.some(opp => opp.stock?.symbol?.includes('.NS'));
                const hasUSStocks = opportunities.some(opp => opp.stock?.symbol && !opp.stock.symbol.includes('.NS') && !opp.stock.symbol.includes('.L'));
                const hasUKStocks = opportunities.some(opp => opp.stock?.symbol?.includes('.L'));
                
                console.log('🔍 Opportunity mix - Indian:', hasIndianStocks, 'US:', hasUSStocks, 'UK:', hasUKStocks);
                
                // If user selected "all" but opportunities are only Indian stocks, it's stale data
                if (currentScanType === 'all' && hasIndianStocks && !hasUSStocks && !hasUKStocks) {
                    console.log('❌ MISMATCH: User selected global scan but opportunities contain only Indian stocks - skipping alerts');
                    return [];
                }
            }
            
            // Just take first 5 opportunities and fix the property access
            const alertOpportunities = opportunities.slice(0, 5).map(opp => {
                opp.date = new Date().toISOString().split('T')[0];
                opp.dailyDTI = opp.trade?.entryDTI; // Fix property path
                return opp;
            });
            
            return alertOpportunities;
        }
        
        // Original logic for when we have historical trades
        const stockStats = {};
        
        allTrades.forEach(trade => {
            const symbol = trade.stock;
            if (!stockStats[symbol]) {
                stockStats[symbol] = { wins: 0, total: 0 };
            }
            stockStats[symbol].total++;
            if (trade.profitLossPercent > 0) {
                stockStats[symbol].wins++;
            }
        });
        
        // Filter for high conviction (>75% win rate) and recent signals (last 5 trading days)
        const highConviction = opportunities.filter(opp => {
            const stats = stockStats[opp.stock.symbol];
            if (!stats || stats.total < 5) return false; // Need at least 5 trades
            
            const winRate = (stats.wins / stats.total) * 100;
            const isHighConviction = winRate > 75;
            const isRecent = isWithinTradingDays(opp.date);
            
            if (isHighConviction && isRecent) {
                opp.winRate = winRate;
                opp.totalTrades = stats.total;
                return true;
            }
            return false;
        });
        
        return highConviction;
    }
    
    /**
     * Send backtest alerts via the API
     */
    async function sendBacktestAlerts(opportunities, backtestResults) {
        try {
            console.log('🔄 Fetching alert preferences...');
            
            // Get alert preferences
            const prefsResponse = await fetch('/api/alerts/preferences');
            if (!prefsResponse.ok) {
                console.log('❌ Failed to fetch alert preferences:', prefsResponse.status);
                return;
            }
            
            const prefs = await prefsResponse.json();
            console.log('⚙️ Alert preferences:', prefs);
            
            if (!prefs.telegram_enabled) {
                console.log('❌ Telegram alerts are disabled in preferences');
                return;
            }
            
            if (!prefs.telegram_chat_id) {
                console.log('❌ No Telegram chat ID configured');
                return;
            }
            
            console.log(`✅ Telegram enabled, Chat ID: ${prefs.telegram_chat_id}`);
            
            // Send summary if any opportunities found
            if (opportunities.length > 0) {
                const summaryMessage = formatBacktestSummary(opportunities, backtestResults);
                await sendTelegramMessage(prefs.telegram_chat_id, summaryMessage);
                
                // Send individual opportunities
                for (const opp of opportunities) {
                    const oppMessage = formatOpportunityMessage(opp);
                    await sendTelegramMessage(prefs.telegram_chat_id, oppMessage);
                    
                    // Small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('Failed to send backtest alerts:', error);
        }
    }
    
    /**
     * Format backtest summary message
     */
    function formatBacktestSummary(opportunities, results) {
        const totalReturn = results.totalReturn || 0;
        const winRate = results.winRate || 0;
        const totalTrades = results.trades?.length || 0;
        
        // Different message for opportunity scans vs backtests
        if (totalTrades === 0) {
            return {
                type: 'opportunity_scan',
                title: '🎯 OPPORTUNITY SCAN COMPLETE',
                text: `Found ${opportunities.length} Strong Buy Signals`,
                fields: [
                    { label: 'Total Opportunities Scanned', value: DTIBacktester.activeTradeOpportunities?.length || 0 },
                    { label: 'Strong Signals Found', value: opportunities.length },
                    { label: 'Signal Strength', value: 'DTI < -40 (Strong Oversold)' },
                    { label: 'Scan Date', value: new Date().toLocaleDateString() }
                ]
            };
        }
        
        return {
            type: 'backtest_complete',
            title: '📊 BACKTEST COMPLETE',
            text: `Found ${opportunities.length} High-Conviction Opportunities`,
            fields: [
                { label: 'Backtest Performance', value: `${totalReturn.toFixed(2)}%` },
                { label: 'Overall Win Rate', value: `${winRate.toFixed(1)}%` },
                { label: 'Total Trades Analyzed', value: totalTrades },
                { label: 'High Conviction Signals', value: opportunities.length }
            ]
        };
    }
    
    /**
     * Format individual opportunity message
     */
    function formatOpportunityMessage(opportunity) {
        const symbol = opportunity.stock.symbol;
        const price = opportunity.trade?.currentPrice || opportunity.stock?.currentPrice;
        const signal = opportunity.dailyDTI || opportunity.trade?.entryDTI;
        const winRate = opportunity.winRate;
        const totalTrades = opportunity.totalTrades;
        
        // Get currency symbol based on the stock symbol
        const currencySymbol = symbol.includes('.NS') ? '₹' : 
                              symbol.includes('.L') ? '£' : '$';
        
        const convictionLevel = signal < -50 ? '⭐⭐⭐ VERY HIGH' : 
                               signal < -40 ? '⭐⭐⭐ HIGH' : 
                               '⭐⭐ MODERATE';
        
        return {
            type: 'buy_opportunity',
            title: '🎯 STRONG BUY SIGNAL',
            stock: symbol,
            fields: [
                { label: 'DTI Signal', value: signal.toFixed(2) },
                { label: 'Current Price', value: `${currencySymbol}${price.toFixed(2)}` },
                { label: 'Signal Strength', value: convictionLevel },
                { label: 'Signal Date', value: new Date(opportunity.date).toLocaleDateString() },
                { label: 'Market', value: symbol.includes('.NS') ? 'Indian' : symbol.includes('.L') ? 'UK' : 'US' }
            ],
            action: 'Consider adding to portfolio for tracking'
        };
    }
    
    /**
     * Send telegram message via API
     */
    async function sendTelegramMessage(chatId, messageData) {
        try {
            console.log(`📤 Sending message to ${chatId}:`, messageData);
            
            const response = await fetch('/api/alerts/send-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatId,
                    message: messageData
                })
            });
            
            if (response.ok) {
                console.log('✅ Message sent successfully');
            } else {
                console.error('❌ Failed to send telegram message:', response.status);
                const errorText = await response.text();
                console.error('Error details:', errorText);
            }
        } catch (error) {
            console.error('❌ Error sending telegram message:', error);
        }
    }
    
    /**
     * Process backtest results and send alerts
     */
    function processBacktestResults(backtestData) {
        console.log('🔍 Processing backtest results for alerts...');
        console.log('📊 Backtest data:', backtestData);
        
        // Get all trades and opportunities
        const allTrades = backtestData.trades || [];
        const opportunities = DTIBacktester.activeTradeOpportunities || [];
        
        console.log(`📈 Total trades: ${allTrades.length}`);
        console.log(`🎯 Total opportunities: ${opportunities.length}`);
        
        // Check scan type selector to see what user actually selected
        const scanTypeSelector = document.getElementById('scan-type-selector');
        const currentScanType = scanTypeSelector ? scanTypeSelector.value : 'current';
        console.log('🔍 User selected scan type:', currentScanType);
        
        // Filter for high conviction opportunities
        const highConvictionOpps = getHighConvictionOpportunities(opportunities, allTrades);
        
        console.log(`⭐ High-conviction opportunities: ${highConvictionOpps.length}`);
        
        if (highConvictionOpps.length > 0) {
            console.log('📤 Sending backtest alerts...');
            sendBacktestAlerts(highConvictionOpps, backtestData);
        } else {
            console.log('❌ No high-conviction opportunities found to alert about');
            
            // Debug why no opportunities
            if (opportunities.length === 0) {
                console.log('🔍 No opportunities found at all');
            } else {
                console.log('🔍 Opportunities failed high-conviction filter:');
                opportunities.forEach((opp, i) => {
                    const stats = {};
                    allTrades.forEach(trade => {
                        const symbol = trade.stock;
                        if (!stats[symbol]) stats[symbol] = { wins: 0, total: 0 };
                        stats[symbol].total++;
                        if (trade.profitLossPercent > 0) stats[symbol].wins++;
                    });
                    
                    const oppStats = stats[opp.stock.symbol];
                    const winRate = oppStats ? (oppStats.wins / oppStats.total) * 100 : 0;
                    const isRecent = isWithinTradingDays(opp.date);
                    
                    console.log(`  ${i+1}. ${opp.stock.symbol}: ${winRate.toFixed(1)}% win rate, Recent: ${isRecent}, Date: ${opp.date}`);
                });
            }
        }
    }
    
    // Public API
    return {
        processBacktestResults,
        isWithinTradingDays,
        getHighConvictionOpportunities
    };
})();

// Make it globally available
window.BacktestAlerts = BacktestAlerts;