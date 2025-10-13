/**
 * Real-Time Price Updates Service
 * Handles WebSocket connections and price animations
 */

class RealTimePriceService {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.subscriptions = new Set();
        this.priceListeners = new Map();
        this.lastPrices = new Map();
        this.sparklineCharts = new Map();
        this.isConnected = false;
        
        // Fallback to polling if WebSocket fails
        this.pollingInterval = null;
        this.pollDelay = 5000; // 5 seconds for updates during market hours (reduced from 1s to prevent rate limiting)
        this.closedMarketPollDelay = 60000; // 60 seconds when markets are closed
        this.marketStatusCache = new Map(); // Cache market status by symbol
        this.marketStatusCheckInterval = null; // Separate interval for checking market status changes
        
        this.init();
    }

    init() {
        // Try WebSocket first, fallback to polling
        this.connect();
        
        // Listen for visibility change to pause/resume updates
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }

    connect() {
        try {
            // For now, we'll use polling since we need a real WebSocket endpoint
            // In production, replace with actual WebSocket URL
            this.startPolling();
            
            /* WebSocket implementation for future use:
            this.ws = new WebSocket('wss://stream.marketdata.com/v1/stocks');
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.resubscribeAll();
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.processPriceUpdate(data);
            };

            this.ws.onerror = (error) => {
                this.handleDisconnect();
            };

            this.ws.onclose = () => {
                this.handleDisconnect();
            };
            */
        } catch (error) {
            this.startPolling();
        }
    }

    startPolling() {
        if (this.pollingInterval) return;

        // Initial fetch
        this.fetchPrices();

        // Set up polling with current delay
        this.updatePollingInterval();

        // Check for market status changes every 5 minutes and update interval if needed
        this.marketStatusCheckInterval = setInterval(() => {
            const currentDelay = this.calculatePollDelay();
            const activeDelay = this.currentPollDelay;

            // Only update interval if delay has changed significantly
            if (currentDelay !== activeDelay) {
                this.updatePollingInterval();
            }
        }, 300000); // Check every 5 minutes
    }

    updatePollingInterval() {
        // Clear existing interval
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Determine poll delay based on market status
        const pollDelay = this.calculatePollDelay();
        this.currentPollDelay = pollDelay; // Track current delay

        // Create new interval WITHOUT recursive calls
        this.pollingInterval = setInterval(() => {
            if (!document.hidden) {
                this.fetchPrices();
            }
        }, pollDelay);

    }
    
    calculatePollDelay() {
        // Check if any subscribed symbol has an open market
        let hasOpenMarket = false;
        
        for (const symbol of this.subscriptions) {
            const marketStatus = this.getMarketStatusForSymbol(symbol);
            if (marketStatus && (marketStatus.isOpen || marketStatus.isExtendedHours)) {
                hasOpenMarket = true;
                break;
            }
        }
        
        // Use fast polling only when at least one market is open
        return hasOpenMarket ? this.pollDelay : this.closedMarketPollDelay;
    }
    
    getMarketStatusForSymbol(symbol) {
        // Use cached status if available and fresh (less than 5 minutes old)
        const cached = this.marketStatusCache.get(symbol);
        if (cached && (Date.now() - cached.timestamp) < 300000) {
            return cached.status;
        }
        
        // Get fresh market status
        let status = null;
        if (typeof getMarketStatus === 'function') {
            status = getMarketStatus(symbol);
        } else if (typeof getEnhancedMarketStatus === 'function') {
            status = getEnhancedMarketStatus(symbol);
        }
        
        // Cache the status
        if (status) {
            this.marketStatusCache.set(symbol, {
                status: status,
                timestamp: Date.now()
            });
        }
        
        return status;
    }

    async fetchPrices() {
        if (this.subscriptions.size === 0) return;
        
        const symbols = Array.from(this.subscriptions);
        
        // Group symbols by market status
        const openMarketSymbols = [];
        const closedMarketSymbols = [];
        
        for (const symbol of symbols) {
            const marketStatus = this.getMarketStatusForSymbol(symbol);
            if (marketStatus && (marketStatus.isOpen || marketStatus.isExtendedHours)) {
                openMarketSymbols.push(symbol);
            } else {
                closedMarketSymbols.push(symbol);
            }
        }
        
        // Skip fetching for closed markets if we have cached prices
        const symbolsToFetch = [...openMarketSymbols];
        
        // For closed markets, only fetch if we don't have cached prices or it's been a while
        for (const symbol of closedMarketSymbols) {
            const lastPrice = this.lastPrices.get(symbol);
            if (!lastPrice || Date.now() - lastPrice.timestamp > 300000) { // 5 minutes
                symbolsToFetch.push(symbol);
            }
        }
        
        if (symbolsToFetch.length === 0) return;
        
        try {
            // Update UI to show fetching status
            this.showUpdateStatus(true);

            // Use retry logic for price fetches
            const fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: symbolsToFetch })
            };

            const response = typeof NetworkRetry !== 'undefined'
                ? await NetworkRetry.fetch('/api/prices', fetchOptions, {
                    maxRetries: 2,
                    baseDelay: 500,
                    retryOn: [429, 500, 502, 503, 504]
                })
                : await fetch('/api/prices', fetchOptions);
            
            if (response.ok) {
                const data = await response.json();
                
                // Process each price update
                Object.entries(data).forEach(([symbol, priceData]) => {
                    this.processPriceUpdate({
                        symbol,
                        price: priceData.price,
                        previousClose: priceData.previousClose,
                        change: priceData.change,
                        changePercent: priceData.changePercent,
                        volume: priceData.volume,
                        timestamp: new Date().toISOString()
                    });
                });
            }
        } catch (error) {
        } finally {
            this.showUpdateStatus(false);
        }
    }

    processPriceUpdate(data) {
        const { symbol, price, change, changePercent, volume, timestamp } = data;
        const lastPriceData = this.lastPrices.get(symbol) || {};
        const lastPrice = lastPriceData.price;
        
        // Store current price with timestamp
        this.lastPrices.set(symbol, {
            price: price,
            timestamp: Date.now()
        });
        
        // Calculate movement from last update
        const movement = lastPrice ? price - lastPrice : 0;
        const movementPercent = lastPrice ? (movement / lastPrice) * 100 : 0;
        
        // Check if market is open for this symbol
        const marketStatus = this.getMarketStatusForSymbol(symbol);
        const isMarketOpen = marketStatus && (marketStatus.isOpen || marketStatus.isExtendedHours);
        
        // Only update sparkline during market hours
        if (isMarketOpen) {
            this.updateSparkline(symbol, price, timestamp);
        }
        
        // Notify all listeners for this symbol
        const listeners = this.priceListeners.get(symbol) || [];
        listeners.forEach(listener => {
            listener({
                symbol,
                price,
                lastPrice: lastPrice || price,
                movement,
                movementPercent,
                change,
                changePercent,
                volume,
                timestamp,
                isMarketOpen
            });
        });
    }

    subscribe(symbol, callback) {
        // Add to subscriptions
        this.subscriptions.add(symbol);
        
        // Add listener
        if (!this.priceListeners.has(symbol)) {
            this.priceListeners.set(symbol, []);
        }
        this.priceListeners.get(symbol).push(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.priceListeners.get(symbol) || [];
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            
            // Remove from subscriptions if no more listeners
            if (listeners.length === 0) {
                this.subscriptions.delete(symbol);
                this.priceListeners.delete(symbol);
            }
        };
    }

    updateSparkline(symbol, price, timestamp) {
        let sparkline = this.sparklineCharts.get(symbol);
        
        if (sparkline) {
            sparkline.addDataPoint(price, timestamp);
        }
    }

    createSparkline(container, symbol) {
        const sparkline = new SparklineChart(container, symbol);
        this.sparklineCharts.set(symbol, sparkline);
        return sparkline;
    }

    showUpdateStatus(isUpdating) {
        const statusElement = document.getElementById('price-update-status');
        if (statusElement) {
            if (isUpdating) {
                statusElement.style.display = 'block';
                statusElement.innerHTML = '<span class="price-updating-indicator">Updating prices...</span>';
            } else {
                // Show market closed status if applicable
                let hasClosedMarkets = false;
                for (const symbol of this.subscriptions) {
                    const marketStatus = this.getMarketStatusForSymbol(symbol);
                    if (marketStatus && !marketStatus.isOpen && !marketStatus.isExtendedHours) {
                        hasClosedMarkets = true;
                        break;
                    }
                }
                
                if (hasClosedMarkets) {
                    statusElement.style.display = 'block';
                    statusElement.innerHTML = '<span class="market-closed-indicator">Some markets closed - prices update less frequently</span>';
                    // Hide after 3 seconds
                    setTimeout(() => {
                        statusElement.style.display = 'none';
                    }, 3000);
                } else {
                    statusElement.style.display = 'none';
                }
            }
        }
    }

    pause() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.marketStatusCheckInterval) {
            clearInterval(this.marketStatusCheckInterval);
            this.marketStatusCheckInterval = null;
        }
    }

    resume() {
        if (!this.pollingInterval && this.subscriptions.size > 0) {
            // Clear market status cache to get fresh data
            this.marketStatusCache.clear();
            this.startPolling();
        }
    }

    destroy() {
        this.pause();
        if (this.ws) {
            this.ws.close();
        }
        this.subscriptions.clear();
        this.priceListeners.clear();
        this.sparklineCharts.clear();
        this.lastPrices.clear();
        this.marketStatusCache.clear();
    }
}

/**
 * Sparkline Chart Component
 */
class SparklineChart {
    constructor(container, symbol) {
        this.container = container;
        this.symbol = symbol;
        this.dataPoints = [];
        this.maxPoints = 50;
        this.canvas = this.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        
        // Style configuration
        this.style = {
            lineColor: '#2563eb',
            lineWidth: 2,
            fillOpacity: 0.1,
            positiveColor: '#059669',
            negativeColor: '#dc2626'
        };
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 40;
        canvas.className = 'sparkline-chart';
        this.container.appendChild(canvas);
        return canvas;
    }

    addDataPoint(price, timestamp) {
        this.dataPoints.push({ price, timestamp });
        
        // Keep only recent points
        if (this.dataPoints.length > this.maxPoints) {
            this.dataPoints.shift();
        }
        
        this.render();
    }

    render() {
        const { width, height } = this.canvas;
        const padding = 2;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        if (this.dataPoints.length < 2) return;
        
        // Calculate scale
        const prices = this.dataPoints.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        // Determine trend color
        const trendColor = this.getTrendColor();
        
        // Draw gradient fill
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `${trendColor}22`);
        gradient.addColorStop(1, `${trendColor}00`);
        
        // Draw filled area
        this.ctx.beginPath();
        this.dataPoints.forEach((point, index) => {
            const x = (index / (this.dataPoints.length - 1)) * (width - 2 * padding) + padding;
            const y = height - ((point.price - minPrice) / priceRange) * (height - 2 * padding) - padding;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        // Complete the fill
        const lastX = width - padding;
        this.ctx.lineTo(lastX, height - padding);
        this.ctx.lineTo(padding, height - padding);
        this.ctx.closePath();
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Draw line
        this.ctx.beginPath();
        this.ctx.strokeStyle = trendColor;
        this.ctx.lineWidth = this.style.lineWidth;
        
        this.dataPoints.forEach((point, index) => {
            const x = (index / (this.dataPoints.length - 1)) * (width - 2 * padding) + padding;
            const y = height - ((point.price - minPrice) / priceRange) * (height - 2 * padding) - padding;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();
        
        // Draw current price point
        if (this.dataPoints.length > 0) {
            const lastPoint = this.dataPoints[this.dataPoints.length - 1];
            const lastX = width - padding;
            const lastY = height - ((lastPoint.price - minPrice) / priceRange) * (height - 2 * padding) - padding;
            
            this.ctx.beginPath();
            this.ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = trendColor;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }

    getTrendColor() {
        if (this.dataPoints.length < 2) return this.style.lineColor;
        
        const firstPrice = this.dataPoints[0].price;
        const lastPrice = this.dataPoints[this.dataPoints.length - 1].price;
        
        return lastPrice >= firstPrice ? this.style.positiveColor : this.style.negativeColor;
    }

    clear() {
        this.dataPoints = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

/**
 * Live P&L Calculator with Animations
 */
class LivePnLCalculator {
    constructor(tradeElement) {
        this.tradeElement = tradeElement;
        this.tradeId = tradeElement.dataset.tradeId;
        this.entryPrice = parseFloat(tradeElement.dataset.entryPrice);
        this.shares = parseInt(tradeElement.dataset.shares);
        this.investment = parseFloat(tradeElement.dataset.investment);
        this.currentPrice = this.entryPrice;
        
        this.initializeElements();
    }

    initializeElements() {
        this.priceElement = this.tradeElement.querySelector('.current-price');
        this.plElement = this.tradeElement.querySelector('.current-pl');
        this.valueElement = this.tradeElement.querySelector('.current-value');
    }

    updatePrice(newPrice, change, changePercent) {
        const oldPrice = this.currentPrice;
        this.currentPrice = newPrice;
        
        // Update price display with animation
        this.animatePriceChange(oldPrice, newPrice);
        
        // Calculate P&L
        const pnlValue = (newPrice - this.entryPrice) * this.shares;
        const pnlPercent = ((newPrice - this.entryPrice) / this.entryPrice) * 100;
        const currentValue = newPrice * this.shares;
        
        // Animate the P&L change
        this.animatePnLChange(pnlValue, pnlPercent);
        
        // Update current value
        this.animateValueChange(currentValue);
        
        // Add price movement indicator
        this.showPriceMovement(change > 0);
    }

    animatePriceChange(oldPrice, newPrice) {
        const priceContainer = this.priceElement.parentElement;
        
        // Add animation class
        priceContainer.classList.add('price-updating');
        
        // Determine direction
        const isUp = newPrice > oldPrice;
        this.priceElement.classList.remove('price-up', 'price-down');
        this.priceElement.classList.add(isUp ? 'price-up' : 'price-down');
        
        // Smooth number transition
        this.animateNumber(this.priceElement, oldPrice, newPrice, '$');
        
        // Show arrow indicator
        this.showArrowIndicator(isUp);
        
        // Remove animation class after completion
        setTimeout(() => {
            priceContainer.classList.remove('price-updating');
        }, 600);
    }

    animatePnLChange(value, percent) {
        const plContainer = this.plElement.parentElement;
        
        // Create floating indicator
        const indicator = document.createElement('div');
        indicator.className = 'pnl-change-indicator';
        
        const change = value - (parseFloat(this.plElement.dataset.currentValue) || 0);
        const changePercent = (change / this.investment) * 100;
        
        if (Math.abs(changePercent) > 0.01) {
            indicator.innerHTML = `
                <span class="${change >= 0 ? 'positive' : 'negative'}">
                    ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%
                </span>
            `;
            
            // Position near the P&L display
            const rect = this.plElement.getBoundingClientRect();
            indicator.className = 'pnl-change-indicator float-up-animation';
            indicator.style.left = `${rect.left}px`;
            indicator.style.top = `${rect.top - 20}px`;
            
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 2000);
        }
        
        // Update P&L with smooth transition
        this.plElement.dataset.currentValue = value;
        
        const plClass = value >= 0 ? 'profit' : 'loss';
        this.plElement.className = `current-pl ${plClass}`;
        
        this.plElement.innerHTML = `
            ${value >= 0 ? '+' : ''}$${Math.abs(value).toFixed(2)}
            (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)
        `;
        
        // Add pulse effect for significant changes
        if (Math.abs(changePercent) > 1) {
            plContainer.classList.add('significant-change');
            setTimeout(() => plContainer.classList.remove('significant-change'), 1000);
        }
    }

    animateValueChange(newValue) {
        const oldValue = parseFloat(this.valueElement.textContent.replace(/[$,]/g, '')) || this.investment;
        this.animateNumber(this.valueElement, oldValue, newValue, '$');
    }

    animateNumber(element, start, end, prefix = '', suffix = '') {
        const duration = 500;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const current = start + (end - start) * easeOut;
            element.textContent = `${prefix}${current.toFixed(2)}${suffix}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    showArrowIndicator(isUp) {
        const arrow = document.createElement('span');
        arrow.className = 'price-arrow';
        arrow.textContent = isUp ? '↑' : '↓';
        arrow.style.color = isUp ? 'var(--success-color)' : 'var(--danger-color)';
        
        this.priceElement.appendChild(arrow);
        setTimeout(() => arrow.remove(), 800);
    }

    showPriceMovement(isPositive) {
        const badge = this.tradeElement.querySelector('.price-movement-badge');
        if (badge) {
            badge.className = `price-movement-badge ${isPositive ? 'positive' : 'negative'}`;
            badge.style.opacity = '1';
            setTimeout(() => {
                badge.style.opacity = '0';
            }, 3000);
        }
    }
}

// Initialize service when DOM is ready
let priceService;

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('trades.html')) {
        priceService = new RealTimePriceService();
        
        // Make it globally available
        window.RealTimePriceService = priceService;
    }
});