/**
 * API Client for Trade Data Management
 * Handles all communication with the backend SQLite database
 */

const TradeAPI = {
    // Base URL for API endpoints
    baseURL: window.location.origin,

    /**
     * Helper method for making API requests
     */
    async request(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}/api${endpoint}`;
            console.log('API: Making request to:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            console.log('API: Response status:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('API: Response data:', data);
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    /**
     * Get all trades
     */
    async getAllTrades() {
        console.log('API: Fetching all trades from /api/trades');
        const result = await this.request('/trades');
        console.log('API: Received response:', result);
        return result;
    },

    /**
     * Get active trades
     */
    async getActiveTrades() {
        return this.request('/trades/active');
    },

    /**
     * Get closed trades
     */
    async getClosedTrades() {
        return this.request('/trades/closed');
    },

    /**
     * Get a specific trade by ID
     */
    async getTradeById(id) {
        return this.request(`/trades/${id}`);
    },

    /**
     * Create a new trade
     */
    async createTrade(trade) {
        return this.request('/trades', {
            method: 'POST',
            body: JSON.stringify(trade)
        });
    },

    /**
     * Update an existing trade
     */
    async updateTrade(id, updates) {
        console.log('>>> API Client updateTrade:', {
            id,
            updates,
            hasEntryPrice: 'entryPrice' in updates,
            entryPrice: updates.entryPrice
        });
        return this.request(`/trades/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    /**
     * Delete a trade
     */
    async deleteTrade(id) {
        return this.request(`/trades/${id}`, {
            method: 'DELETE'
        });
    },

    /**
     * Delete all trades
     */
    async deleteAllTrades() {
        return this.request('/trades', {
            method: 'DELETE'
        });
    },

    /**
     * Bulk import trades (useful for migration)
     */
    async bulkImportTrades(trades) {
        return this.request('/trades/bulk', {
            method: 'POST',
            body: JSON.stringify({ trades })
        });
    },

    /**
     * Migrate data from localStorage to SQLite
     */
    async migrateFromLocalStorage() {
        try {
            // Check if there's data in localStorage
            const localStorageKey = 'dti_backtester_trades';
            const storedData = localStorage.getItem(localStorageKey);
            
            if (!storedData) {
                console.log('No data to migrate from localStorage');
                return { migrated: false, count: 0 };
            }

            const trades = JSON.parse(storedData);
            
            if (!Array.isArray(trades) || trades.length === 0) {
                console.log('No valid trades to migrate');
                return { migrated: false, count: 0 };
            }

            // Transform trades to match database schema
            const transformedTrades = trades.map(trade => ({
                symbol: trade.symbol,
                entryDate: trade.entryDate,
                entryPrice: trade.entryPrice,
                exitDate: trade.exitDate || null,
                exitPrice: trade.exitPrice || null,
                shares: trade.shares,
                status: trade.status,
                profit: trade.profit || null,
                percentGain: trade.percentGain || null,
                entryReason: trade.entryReason || null,
                exitReason: trade.exitReason || null,
                stockIndex: trade.stockIndex || null
            }));

            // Bulk import to database
            const result = await this.bulkImportTrades(transformedTrades);
            
            // If successful, remove from localStorage
            if (result.success) {
                localStorage.removeItem(localStorageKey);
                console.log(`Successfully migrated ${result.imported} trades to database`);
                return { migrated: true, count: result.imported };
            }
            
            return { migrated: false, count: 0 };
        } catch (error) {
            console.error('Migration failed:', error);
            return { migrated: false, count: 0, error: error.message };
        }
    }
};

// Export for use in other modules
window.TradeAPI = TradeAPI;