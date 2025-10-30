/**
 * DTI Backtester - Core UI Module
 * Handles initialization and core UI functionality
 */

// Create TradeUI module for global access
window.TradeUI = (function() {
    // Store module references
    let modules = {
        trades: null,
        dialogs: null,
        charts: null,
        export: null,
        metrics: null
    };

    /**
     * Initialize the trade UI
     */
    function init() {
        
        // Only initialize if we're on the trades page
        if (!isTradesPage()) {
            return;
        }
        
        // Initialize all submodules if they exist
        for (const key in modules) {
            if (window.TradeUIModules && window.TradeUIModules[key] && typeof window.TradeUIModules[key].init === 'function') {
                modules[key] = window.TradeUIModules[key];
                modules[key].init();
            }
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Render initial UI
        renderTrades();
        updateStatistics();
        updateMarketStatus();
        
        // Initialize analytics components
        initializeAnalytics();
        
        // Add page load animations
        addPageLoadAnimations();
        
        // Update market status every minute (60000ms) for accurate time display
        setInterval(updateMarketStatus, 60000);
        
        // Start real-time price and statistics updates every second
        startRealTimeUpdates();
        
    }
    
    /**
     * Check if current page is the trades page
     * @returns {boolean} - True if on trades page
     */
    function isTradesPage() {
        return document.getElementById('active-trades-container') !== null;
    }
    
    /**
     * Initialize analytics UI components
     */
    function initializeAnalytics() {
        // Render new metric cards
        if (window.TradeUIMetricCards && window.TradeCore) {
            const trades = window.TradeCore.getTrades();
            window.TradeUIMetricCards.renderMetricCards(trades);
            window.TradeUIMetricCards.renderCompactCalendar(trades);
        }

        if (modules.charts) {
            modules.charts.renderAllCharts();
        }

        if (modules.metrics) {
            modules.metrics.renderAdvancedMetricsCards();
        }
    }
    
    /**
     * Setup core event listeners
     */
    function setupEventListeners() {
        // Setup tab switching for trade history
        setupTabSwitching();
        
        // Use other modules' setup methods if available
        if (modules.dialogs) {
            modules.dialogs.setupAllDialogs();
        }
        
        if (modules.export) {
            modules.export.setupExportButtons();
        }
        
        // Listen for trade events from TradeCore
        setupTradeEventListeners();
        
        // Analytics time period switcher
        setupAnalyticsTimeFilter();
        
        // Setup tabs for analytics
        setupAnalyticsTabs();
    }
    
    /**
     * Setup analytics time period filter
     */
    function setupAnalyticsTimeFilter() {
        const timeFilterSelect = document.getElementById('analytics-time-filter');
        if (timeFilterSelect) {
            timeFilterSelect.addEventListener('change', function() {
                // Refresh all charts with the new time period
                refreshAllCharts();
            });
        }
    }
    
    /**
     * Setup tabs for analytics
     */
    function setupAnalyticsTabs() {
        const tabs = document.querySelectorAll('.analytics-tab');
        const tabContents = document.querySelectorAll('.analytics-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Hide all tab contents
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show the selected tab content
                const tabId = this.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                    
                    // Trigger resize event to fix Chart.js responsive issues
                    window.dispatchEvent(new Event('resize'));
                    
                    // Render content specific to each tab
                    if (tabId === 'patterns-tab') {
                        // Render exit reason analysis when patterns tab is shown
                        if (modules.metrics && modules.metrics.renderExitReasonAnalysis) {
                            modules.metrics.renderExitReasonAnalysis();
                        }
                    } else if (tabId === 'metrics-tab') {
                        // Render advanced metrics when metrics tab is shown
                        if (modules.metrics && modules.metrics.renderAdvancedMetricsCards) {
                            modules.metrics.renderAdvancedMetricsCards();
                        }
                    }
                }
            });
        });
    }
    
    /**
     * Refresh all charts and visualizations
     */
    function refreshAllCharts() {
        // Refresh metric cards
        if (window.TradeUIMetricCards && window.TradeCore) {
            const trades = window.TradeCore.getTrades();
            window.TradeUIMetricCards.renderMetricCards(trades);
            window.TradeUIMetricCards.renderCompactCalendar(trades);
        }

        if (modules.charts) {
            modules.charts.renderAllCharts();
        }
    }
    
    /**
     * Setup tab switching for trade history
     */
    function setupTabSwitching() {
        const tabs = document.querySelectorAll('.trade-tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Hide all tab contents
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show the selected tab content
                const tabId = this.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    /**
     * Listen for trade events from TradeCore
     */
    function setupTradeEventListeners() {
        // Listen for trade events from TradeCore
        document.addEventListener('tradeAdded', function(e) {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
            updateMarketStatus();
            // Restart monitoring as we may have new market trades
            if (TradeCore.restartMarketMonitoring) {
                TradeCore.restartMarketMonitoring();
            }
        });
        
        document.addEventListener('tradeClosed', function(e) {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
            updateMarketStatus();
            // Restart monitoring as active trades changed
            if (TradeCore.restartMarketMonitoring) {
                TradeCore.restartMarketMonitoring();
            }
        });
        
        document.addEventListener('tradeEdited', function(e) {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
        });
        
        document.addEventListener('tradeDeleted', function(e) {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
            updateMarketStatus();
            // Restart monitoring as active trades may have changed
            if (TradeCore.restartMarketMonitoring) {
                TradeCore.restartMarketMonitoring();
            }
        });
        
        document.addEventListener('historyCleared', function() {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
        });
        
        // Throttle updates for 1-second price refreshes
        let updateTimeout = null;
        let lastFullUpdate = 0;
        
        document.addEventListener('tradesUpdated', function(e) {
            
            const now = Date.now();
            const isSilent = e.detail && e.detail.silent;
            
            // For silent updates (price only), update prices and stats only
            if (isSilent) {
                // Update prices in the DOM without full re-render
                updatePricesOnly();
                // Update market status indicators
                updateMarketStatus();
                
                // Don't refresh trades or charts on price updates
            } else {
                // For non-silent updates, do full update immediately
                renderTrades();
                updateStatistics();
                refreshAllCharts();
                updateMarketStatus();
                lastFullUpdate = now;
            }
        });
        
        // Listen for import event 
        document.addEventListener('tradesImported', function(e) {
            renderTrades();
            updateStatistics();
            refreshAllCharts();
        });
        
        // Listen for market status changes
        document.addEventListener('marketStatusChanged', function() {
            updateMarketStatus();
        });
    }
    
    /**
     * Add page load animations
     */
    function addPageLoadAnimations() {
        // Animate statistics cards
        const statCards = document.querySelectorAll('.statistic-card');
        if (statCards.length > 0) {
            statCards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 100 + (index * 50));
            });
        }
        
        // Animate card elements
        const cards = document.querySelectorAll('.card');
        if (cards.length > 0) {
            cards.forEach((card, index) => {
                if (index > 0) { // Skip the first card (statistics) as it's handled separately
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 300 + (index * 100));
                }
            });
        }
        
        // Animate chart containers
        const chartContainers = document.querySelectorAll('.chart-container');
        if (chartContainers.length > 0) {
            chartContainers.forEach((container, index) => {
                container.style.opacity = '0';
                container.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    container.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    container.style.opacity = '1';
                    container.style.transform = 'translateY(0)';
                }, 400 + (index * 80));
            });
        }
    }
    
    /**
     * Start real-time price and statistics updates
     */
    function startRealTimeUpdates() {
        // Update prices and open P&L every second
        setInterval(() => {
            // Temporary: simulate price changes for testing animations
            if (window.simulatePriceChanges) {
                simulatePriceChangesForTesting();
            }
            
            updatePricesOnly();
            updateOpenPLOnly();
        }, 1000);
        
        // Statistics will update only on actual trade events (add, close, edit, delete)
        // This prevents the jarring 5-second refresh
    }
    
    /**
     * Temporary function to simulate price changes for testing animations
     */
    function simulatePriceChangesForTesting() {
        const activeTrades = TradeCore.getTrades('active');
        activeTrades.forEach(trade => {
            // Simulate small random price changes
            const changePercent = (Math.random() - 0.5) * 0.5; // -0.25% to +0.25%
            const priceChange = trade.currentPrice * (changePercent / 100);
            trade.currentPrice = Math.max(0.01, trade.currentPrice + priceChange);
        });
    }
    
    /**
     * Update only the Open P&L % in Signal Performance with subtle glow animation
     */
    function updateOpenPLOnly() {
        // First sync trade prices from DOM to TradeCore
        const activeTrades = TradeCore.getTrades('active');
        activeTrades.forEach(trade => {
            const tradeCard = document.querySelector(`[data-trade-id="${trade.id}"]`);
            if (tradeCard) {
                const currentPriceEl = tradeCard.querySelector('.current-price');
                if (currentPriceEl) {
                    const priceText = currentPriceEl.textContent;
                    const currentPrice = parseFloat(priceText.replace(/[^0-9.-]/g, ''));
                    if (!isNaN(currentPrice) && currentPrice > 0) {
                        trade.currentPrice = currentPrice;
                        trade.currentValue = currentPrice * trade.shares;
                        trade.unrealizedPL = (currentPrice - trade.entryPrice) * trade.shares;
                    }
                }
            }
        });
        
        // Get current statistics with updated prices
        const stats = TradeCore.getTradeStatisticsByCurrency();
        
        // Update the main open P&L element if it exists
        const openPLElement = document.getElementById('open-pl');
        if (openPLElement) {
            const newValue = stats.overall.openPLPercent;
            const oldValue = parseFloat(openPLElement.textContent) || 0;
            
            // Update the display
            openPLElement.textContent = `${newValue.toFixed(2)}%`;
            
            // Update color classes
            openPLElement.classList.remove('positive', 'negative');
            openPLElement.classList.add(newValue >= 0 ? 'positive' : 'negative');
            
            // Add glow effect and animation if value changed
            if (Math.abs(newValue - oldValue) > 0.01) {
                if (newValue > oldValue) {
                    openPLElement.classList.add('value-increase');
                    setTimeout(() => openPLElement.classList.remove('value-increase'), 800);
                } else if (newValue < oldValue) {
                    openPLElement.classList.add('value-decrease');
                    setTimeout(() => openPLElement.classList.remove('value-decrease'), 800);
                }
            }
            
            // Update card styling
            const plCard = openPLElement.closest('.statistic-card');
            if (plCard) {
                plCard.className = `statistic-card ${newValue > 0 ? 'success' : (newValue < 0 ? 'danger' : '')}`;
            }
        }
        
        // Also update currency-specific open P&L values if they exist
        const currencyOpenPLElements = document.querySelectorAll('[data-stat="openPL"]');
        currencyOpenPLElements.forEach(element => {
            const currencyCard = element.closest('.currency-stat-card');
            if (currencyCard) {
                const currency = currencyCard.getAttribute('data-currency');
                if (stats.currencies[currency]) {
                    const newValue = stats.currencies[currency].openPLPercent;
                    const oldValue = parseFloat(element.textContent) || 0;
                    
                    // Update the display
                    element.textContent = `${newValue.toFixed(2)}%`;
                    
                    // Update color classes
                    element.classList.remove('positive', 'negative');
                    element.classList.add(newValue >= 0 ? 'positive' : 'negative');
                    
                    // Add glow effect and animation if value changed
                    if (Math.abs(newValue - oldValue) > 0.01) {
                        if (newValue > oldValue) {
                            element.classList.add('value-increase');
                            setTimeout(() => element.classList.remove('value-increase'), 800);
                        } else if (newValue < oldValue) {
                            element.classList.add('value-decrease');
                            setTimeout(() => element.classList.remove('value-decrease'), 800);
                        }
                    }
                    
                    // Update card styling
                    const plCard = element.closest('.statistic-card');
                    if (plCard) {
                        plCard.className = `statistic-card ${newValue > 0 ? 'success' : (newValue < 0 ? 'danger' : '')}`;
                    }
                }
            }
        });
    }
    
    /**
     * Animate a numeric value change
     */
    function animateValue(element, start, end, duration, formatter) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const current = start + (end - start) * easeOut;
            element.textContent = formatter ? formatter(current) : current.toFixed(2);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Update only prices in the DOM without full re-render
     * Optimized for 1-second updates with animations
     */
    function updatePricesOnly() {
        // Update active trade prices directly in the DOM
        const activeTrades = TradeCore.getTrades('active');
        
        // Only update trades in open markets
        const tradesToUpdate = activeTrades.filter(trade => {
            const marketStatus = TradeCore.getMarketStatus(trade.symbol);
            return marketStatus.isOpen || marketStatus.isExtendedHours;
        });
        
        tradesToUpdate.forEach(trade => {
            const tradeCard = document.querySelector(`[data-trade-id="${trade.id}"]`);
            if (!tradeCard) return;
            
            // Store previous values for comparison
            const prevPrice = parseFloat(tradeCard.dataset.prevPrice) || trade.entryPrice;
            const prevPL = parseFloat(tradeCard.dataset.prevPL) || 0;
            
            // Update current price with animation
            const priceElement = tradeCard.querySelector('.current-price');
            if (priceElement) {
                const newPrice = trade.currentPrice;
                
                if (Math.abs(newPrice - prevPrice) > 0.01) {
                    // Add price direction classes
                    const priceContainer = priceElement.parentElement;
                    priceContainer.classList.add('price-updating');
                    
                    if (newPrice > prevPrice) {
                        priceElement.classList.add('price-up');
                        priceElement.classList.remove('price-down');
                        
                        // Add arrow indicator
                        showPriceArrow(priceElement, true);
                    } else if (newPrice < prevPrice) {
                        priceElement.classList.add('price-down');
                        priceElement.classList.remove('price-up');
                        
                        // Add arrow indicator
                        showPriceArrow(priceElement, false);
                    }
                    
                    // Animate the price change
                    animateValue(priceElement, prevPrice, newPrice, 500, (val) => `${trade.currencySymbol || TradeCore.getCurrencySymbol()}${val.toFixed(2)}`);
                    
                    // Store new price for next comparison
                    tradeCard.dataset.prevPrice = newPrice;
                    
                    // Remove animation classes after completion
                    setTimeout(() => {
                        priceContainer.classList.remove('price-updating');
                        priceElement.classList.remove('price-up', 'price-down');
                    }, 600);
                }
            }
            
            // Update current value with animation
            const currentValueElement = tradeCard.querySelector('.current-value');
            if (currentValueElement) {
                const oldValue = parseFloat(currentValueElement.textContent.replace(/[^0-9.-]/g, '')) || 0;
                const currentValue = trade.currentPrice * trade.shares;
                
                if (Math.abs(currentValue - oldValue) > 0.01) {
                    animateValue(currentValueElement, oldValue, currentValue, 500, (val) => `${trade.currencySymbol || TradeCore.getCurrencySymbol()}${val.toFixed(2)}`);
                }
            }
            
            // Update P&L percentage with animation
            const plElement = tradeCard.querySelector('.current-pl');
            if (plElement) {
                const plPercent = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                const oldPLPercent = parseFloat(plElement.textContent) || 0;
                
                if (Math.abs(plPercent - oldPLPercent) > 0.01) {
                    // Add animation to parent container as well
                    const plContainer = plElement.parentElement;
                    if (plContainer) {
                        plContainer.classList.add('price-updating');
                    }
                    
                    // Add animation classes
                    if (plPercent > oldPLPercent) {
                        plElement.classList.add('price-up');
                        plElement.classList.remove('price-down');
                        
                        // Add arrow indicator for P&L
                        showPriceArrow(plElement, true);
                    } else if (plPercent < oldPLPercent) {
                        plElement.classList.add('price-down');
                        plElement.classList.remove('price-up');
                        
                        // Add arrow indicator for P&L
                        showPriceArrow(plElement, false);
                    }
                    
                    // Animate the P&L change
                    animateValue(plElement, oldPLPercent, plPercent, 500, (val) => `${val.toFixed(2)}%`);
                    
                    // Show floating P&L change indicator for significant changes
                    const change = plPercent - oldPLPercent;
                    if (Math.abs(change) > 0.1) {
                        showPLChangeIndicator(plElement, change);
                    }
                    
                    // Add significant change pulse for larger movements
                    if (Math.abs(change) > 1) {
                        if (plContainer) {
                            plContainer.classList.add('significant-change');
                        }
                    }
                    
                    // Remove animation classes after completion
                    setTimeout(() => {
                        plElement.classList.remove('price-up', 'price-down');
                        if (plContainer) {
                            plContainer.classList.remove('price-updating', 'significant-change');
                        }
                    }, 600);
                }
                
                // Update classes for color coding
                if (plPercent > 0) {
                    plElement.classList.add('positive');
                    plElement.classList.remove('negative');
                    tradeCard.classList.add('profit');
                    tradeCard.classList.remove('loss', 'active');
                } else if (plPercent < 0) {
                    plElement.classList.add('negative');
                    plElement.classList.remove('positive');
                    tradeCard.classList.add('loss');
                    tradeCard.classList.remove('profit', 'active');
                } else {
                    plElement.classList.remove('positive', 'negative');
                    tradeCard.classList.add('active');
                    tradeCard.classList.remove('profit', 'loss');
                }
                
                // Store new P&L for next comparison
                tradeCard.dataset.prevPL = plPercent;
            }
            
            // Update price movement badge
            if (trade.currentPrice !== prevPrice) {
                updatePriceMovementBadge(tradeCard, trade.currentPrice > prevPrice);
            }
            
            // Update status badge
            const statusElement = tradeCard.querySelector('.trade-status');
            if (statusElement) {
                const marketStatus = TradeCore.getMarketStatus(trade.symbol);
                const plPercent = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                
                // Add market closed indicator if needed
                if (!marketStatus.isOpen && !marketStatus.isExtendedHours) {
                    if (plPercent > 0) {
                        statusElement.className = 'trade-status status-profit';
                        statusElement.textContent = 'Profit (Closed)';
                    } else if (plPercent < 0) {
                        statusElement.className = 'trade-status status-loss';
                        statusElement.textContent = 'Loss (Closed)';
                    } else {
                        statusElement.className = 'trade-status status-active';
                        statusElement.textContent = 'Active (Closed)';
                    }
                } else {
                    if (plPercent > 0) {
                        statusElement.className = 'trade-status status-profit';
                        statusElement.textContent = 'Profit';
                    } else if (plPercent < 0) {
                        statusElement.className = 'trade-status status-loss';
                        statusElement.textContent = 'Loss';
                    } else {
                        statusElement.className = 'trade-status status-active';
                        statusElement.textContent = 'Active';
                    }
                }
            }
            
            // Update days remaining
            const daysRemainingElement = tradeCard.querySelector('.days-remaining');
            if (daysRemainingElement && trade.squareOffDate) {
                const daysRemaining = Math.max(0, Math.floor((trade.squareOffDate - new Date()) / (1000 * 60 * 60 * 24)));
                daysRemainingElement.textContent = daysRemaining;
            }
        });
        
        // No need to update summary statistics on every price update
        // This will be done in the full refresh every 5 seconds
    }
    
    /**
     * Update market status indicators
     */
    function updateMarketStatus() {
        const container = document.getElementById('market-status-container');
        if (!container) {
            return;
        }
        
        // Get unique markets from active trades
        const activeTrades = TradeCore.getTrades('active');
        const markets = new Map();
        
        // Group trades by market
        activeTrades.forEach(trade => {
            let marketKey = 'US';
            if (trade.symbol.endsWith('.NS')) {
                marketKey = 'IN';
            } else if (trade.symbol.endsWith('.L')) {
                marketKey = 'UK';
            }
            
            if (!markets.has(marketKey)) {
                markets.set(marketKey, []);
            }
            markets.get(marketKey).push(trade);
        });
        
        // Store existing badges for smooth updates
        const existingBadges = container.querySelectorAll('.market-status-badge');
        const shouldAnimate = existingBadges.length === 0;
        
        // Clear existing badges with fade out if needed
        if (!shouldAnimate && existingBadges.length > 0) {
            existingBadges.forEach(badge => {
                badge.style.opacity = '0.5';
                badge.style.transform = 'scale(0.98)';
            });
        }
        
        // Clear container after brief delay for smooth transition
        setTimeout(() => {
            container.innerHTML = '';
            
            // Calculate total number of badges to display
            const totalBadges = markets.size > 0 ? markets.size : 3; // Default to 3 if no active trades
            
            // Add class to container based on number of badges
            container.classList.remove('badges-1', 'badges-2', 'badges-3');
            container.classList.add(`badges-${Math.min(totalBadges, 3)}`);
            
            // Create status badges for each market
            markets.forEach((trades, marketKey) => {
            // Use the first trade's symbol as representative
            const symbol = trades[0].symbol;
            
            // Use enhanced market status if available, fallback to regular
            let status;
            if (window.getEnhancedMarketStatus) {
                status = window.getEnhancedMarketStatus(symbol);
            } else {
                status = TradeCore.getMarketStatus(symbol);
            }
            
            
            // Use the new badge creator if available
            let badge;
            if (window.createMarketStatusBadge) {
                badge = window.createMarketStatusBadge(status, trades.length);
            } else {
                // Fallback to old badge creation
                badge = document.createElement('div');
                badge.className = `market-status-badge ${status.status}${status.isHoliday ? ' holiday' : ''}`;
                
                // Add trade count to show how many trades are in this market
                const tradeCount = trades.length;
                const tradePlural = tradeCount === 1 ? 'trade' : 'trades';
            
            // Add holiday info if available
            let holidayText = '';
            if (status.isHoliday && status.holidayInfo) {
                holidayText = `<span class="market-holiday-info">${status.holidayInfo.name}</span>`;
            } else if (status.holidayInfo && !status.isHoliday) {
                const daysUntil = Math.ceil((status.holidayInfo.date - new Date()) / (1000 * 60 * 60 * 24));
                holidayText = `<span class="market-upcoming-holiday">Next holiday: ${status.holidayInfo.name} (${daysUntil}d)</span>`;
            }
            
            badge.innerHTML = `
                <span class="market-status-indicator"></span>
                <div>
                    <span class="market-name">${status.marketName} (${tradeCount} ${tradePlural})</span>
                    <span class="market-time">${status.statusText}</span>
                    ${status.nextActionText ? `<span class="market-next-action">${status.nextActionText}</span>` : ''}
                    ${holidayText}
                </div>
            `;
            
            // Add click handler to show more details
            badge.addEventListener('click', function() {
                const marketTimeStr = status.currentMarketTime.toLocaleTimeString('en-US', {
                    timeZone: status.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
                
                let message = `${status.marketName}: ${marketTimeStr} (${status.timezone.split('/')[1]})`;
                
                if (status.earlyCloseInfo) {
                    message += `\nEarly close today at ${status.earlyCloseInfo.closeTime}:00`;
                }
                
                if (status.holidayInfo) {
                    const daysUntil = Math.ceil((status.holidayInfo.date - new Date()) / (1000 * 60 * 60 * 24));
                    message += `\n${status.isHoliday ? 'Today' : `In ${daysUntil} days`}: ${status.holidayInfo.name}`;
                }
                
                TradeCore.showNotification(message, 'info');
            });
            }
            
            container.appendChild(badge);
        });
        
        // If no active trades, show a general market status
        if (markets.size === 0) {
            const defaultMarkets = [
                { key: 'US', symbol: 'DUMMY' },
                { key: 'IN', symbol: 'DUMMY.NS' },
                { key: 'UK', symbol: 'DUMMY.L' }
            ];
            
            defaultMarkets.forEach(market => {
                // Use enhanced market status if available
                let status;
                if (window.getEnhancedMarketStatus) {
                    status = window.getEnhancedMarketStatus(market.symbol);
                } else {
                    status = TradeCore.getMarketStatus(market.symbol);
                }
                
                // Use the new badge creator if available
                if (window.createMarketStatusBadge) {
                    const badge = window.createMarketStatusBadge(status, 0);
                    container.appendChild(badge);
                } else {
                    // Fallback implementation is below
                    let nextActionText = '';
                    if (status.status === 'closed' && status.nextOpen) {
                        const timeDiff = status.nextOpen - new Date();
                        if (timeDiff > 0) {
                            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (hours > 24) {
                                const days = Math.floor(hours / 24);
                                nextActionText = `Opens in ${days}d ${hours % 24}h`;
                            } else if (hours > 0) {
                                nextActionText = `Opens in ${hours}h ${minutes}m`;
                            } else if (minutes > 0) {
                                nextActionText = `Opens in ${minutes}m`;
                            } else {
                                nextActionText = 'Opening soon';
                            }
                        }
                    } else if (status.status === 'pre-market' && status.nextOpen) {
                        const timeDiff = status.nextOpen - new Date();
                        if (timeDiff > 0) {
                            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (hours > 0) {
                                nextActionText = `Market opens in ${hours}h ${minutes}m`;
                            } else if (minutes > 0) {
                                nextActionText = `Market opens in ${minutes}m`;
                            } else {
                                nextActionText = 'Market opening soon';
                            }
                        }
                    } else if ((status.status === 'open' || status.status === 'post-market') && status.nextClose) {
                        const timeDiff = status.nextClose - new Date();
                        if (timeDiff > 0) {
                            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                            
                        if (hours > 0) {
                            nextActionText = `Closes in ${hours}h ${minutes}m`;
                        } else if (minutes > 0) {
                            nextActionText = `Closes in ${minutes}m`;
                        } else {
                            nextActionText = 'Closing soon';
                        }
                    }
                }
                
                // Add holiday info if available
                let holidayText = '';
                if (status.isHoliday && status.holidayInfo) {
                    holidayText = `<span class="market-holiday-info">${status.holidayInfo.name}</span>`;
                } else if (status.holidayInfo && !status.isHoliday) {
                    const daysUntil = Math.ceil((status.holidayInfo.date - new Date()) / (1000 * 60 * 60 * 24));
                    holidayText = `<span class="market-upcoming-holiday">Next holiday: ${status.holidayInfo.name} (${daysUntil}d)</span>`;
                }
                
                const badge = document.createElement('div');
                badge.className = `market-status-badge ${status.status}${status.isHoliday ? ' holiday' : ''}`;
                badge.style.opacity = '0.7'; // Dimmed since no active trades
                
                badge.innerHTML = `
                    <span class="market-status-indicator"></span>
                    <div>
                        <span class="market-name">${status.marketName}</span>
                        <span class="market-time">${status.statusText}</span>
                        ${nextActionText ? `<span class="market-next-action">${nextActionText}</span>` : ''}
                        ${holidayText}
                    </div>
                `;
                
                // Add click handler to show more details
                badge.addEventListener('click', function() {
                    const marketTimeStr = status.currentMarketTime.toLocaleTimeString('en-US', {
                        timeZone: status.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    let message = `${status.marketName}: ${marketTimeStr} (${status.timezone.split('/')[1]})`;
                    
                    if (status.earlyCloseInfo) {
                        message += `\nEarly close today at ${status.earlyCloseInfo.closeTime}:00`;
                    }
                    
                    if (status.holidayInfo) {
                        const daysUntil = Math.ceil((status.holidayInfo.date - new Date()) / (1000 * 60 * 60 * 24));
                        message += `\n${status.isHoliday ? 'Today' : `In ${daysUntil} days`}: ${status.holidayInfo.name}`;
                    }
                    
                    TradeCore.showNotification(message, 'info');
                });
                
                container.appendChild(badge);
                }
            });
        }
        }, shouldAnimate ? 0 : 100); // Delay only if updating existing badges
    }
    
    /**
     * Render active trades and trade history using Trades module
     */
    function renderTrades() {
        if (modules.trades) {
            modules.trades.renderActiveTrades();
            modules.trades.renderTradeHistory();
        }
    }
    
    /**
     * Update trading statistics using Trades module
     */
    function updateStatistics() {
        if (modules.trades) {
            modules.trades.updateStatistics();
        }
    }
    
    /**
     * Show arrow indicator next to price
     */
    function showPriceArrow(element, isUp) {
        // Remove any existing arrow
        const existingArrow = element.querySelector('.price-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }
        
        const arrow = document.createElement('span');
        arrow.className = 'price-arrow';
        arrow.textContent = isUp ? '↑' : '↓';
        arrow.style.color = isUp ? 'var(--success-color)' : 'var(--danger-color)';
        
        element.appendChild(arrow);
    }
    
    /**
     * Show floating P&L change indicator
     */
    function showPLChangeIndicator(element, change) {
        const indicator = document.createElement('div');
        indicator.className = 'pnl-change-indicator';
        indicator.innerHTML = `
            <span class="${change >= 0 ? 'positive' : 'negative'}">
                ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
            </span>
        `;
        
        // Position near the P&L display
        const rect = element.getBoundingClientRect();
        indicator.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top - 20}px;
            animation: floatUp 2s ease-out forwards;
            z-index: 1000;
        `;
        
        document.body.appendChild(indicator);
        setTimeout(() => indicator.remove(), 2000);
    }
    
    /**
     * Update price movement badge
     */
    function updatePriceMovementBadge(tradeCard, isPositive) {
        const badge = tradeCard.querySelector('.price-movement-badge');
        if (badge) {
            badge.className = `price-movement-badge ${isPositive ? 'positive' : 'negative'}`;
            badge.style.opacity = '1';
            setTimeout(() => {
                badge.style.opacity = '0';
            }, 3000);
        }
    }

    // Public API - backwards compatible with the original
    return {
        init,
        renderActiveTrades: function() {
            if (modules.trades) modules.trades.renderActiveTrades();
        },
        renderTradeHistory: function() {
            if (modules.trades) modules.trades.renderTradeHistory();
        },
        updateStatistics: function() {
            if (modules.trades) modules.trades.updateStatistics();
        },
        openCloseTradeDialog: function(tradeId) {
            if (modules.dialogs) modules.dialogs.openCloseTradeDialog(tradeId);
        },
        openEditTradeDialog: function(tradeId) {
            if (modules.dialogs) modules.dialogs.openEditTradeDialog(tradeId);
        },
        openDeleteTradeDialog: function(tradeId) {
            if (modules.dialogs) modules.dialogs.openDeleteTradeDialog(tradeId);
        },
        openImportDialog: function() {
            if (modules.dialogs) modules.dialogs.openImportDialog();
        },
        
        // Analytics methods - delegated to Charts module
        renderEquityCurve: function() {
            if (modules.charts) modules.charts.renderEquityCurve();
        },
        renderDrawdownChart: function() {
            if (modules.charts) modules.charts.renderDrawdownChart();
        },
        renderPLDistribution: function() {
            if (modules.charts) modules.charts.renderPLDistribution();
        },
        renderWinLossPieChart: function() {
            if (modules.charts) modules.charts.renderWinLossPieChart();
        },
        renderMonthlyPerformance: function() {
            if (modules.charts) modules.charts.renderMonthlyPerformance();
        },
        renderMarketComparison: function() {
            if (modules.charts) modules.charts.renderMarketComparison();
        },
        renderTradeSizeVsReturn: function() {
            if (modules.charts) modules.charts.renderTradeSizeVsReturn();
        },
        renderHoldingPeriodAnalysis: function() {
            if (modules.charts) modules.charts.renderHoldingPeriodAnalysis();
        },
        renderAdvancedMetricsCards: function() {
            if (modules.metrics) modules.metrics.renderAdvancedMetricsCards();
        },
        renderExitReasonAnalysis: function() {
            if (modules.metrics) modules.metrics.renderExitReasonAnalysis();
        },
        refreshAllCharts
    };
})();

// Initialize the trade UI
document.addEventListener('DOMContentLoaded', function() {
    // Create the modules namespace if it doesn't exist
    window.TradeUIModules = window.TradeUIModules || {};
    
    // Initialize UI
    TradeUI.init();
});