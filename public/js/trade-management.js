/**
 * Trade Management Module
 * Handles editing, bulk actions, and advanced trade operations
 */

const TradeManagement = (function() {

    /**
     * Edit trade details
     */
    async function editTrade(tradeId, updates) {
        try {
            // Validate updates
            if (updates.entryPrice && updates.entryPrice <= 0) {
                throw new Error('Entry price must be positive');
            }

            if (updates.stopLoss && updates.targetPrice && updates.entryPrice) {
                const plRange = ((updates.targetPrice - updates.entryPrice) / updates.entryPrice) * 100;
                const slRange = ((updates.entryPrice - updates.stopLoss) / updates.entryPrice) * 100;

                if (plRange < 5 || slRange > 7) {
                    throw new Error('Risk/reward ratio outside acceptable range');
                }
            }

            // Update trade
            const response = await fetch(`/api/trades/${tradeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) throw new Error('Failed to update trade');

            const result = await response.json();

            // If capital allocation changed, recalculate available capital
            if (updates.tradeSize) {
                if (typeof CapitalDisplay !== 'undefined' && CapitalDisplay.refreshCapitalData) {
                    await CapitalDisplay.refreshCapitalData();
                }
            }

            console.log('Trade updated successfully:', tradeId);
            return result;
        } catch (error) {
            console.error('Error editing trade:', error);
            throw error;
        }
    }

    /**
     * Bulk close trades
     */
    async function bulkCloseTrades(tradeIds, exitPrice, exitReason) {
        const results = [];
        const errors = [];

        for (const tradeId of tradeIds) {
            try {
                const response = await fetch(`/api/trades/${tradeId}/close`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exitPrice: exitPrice,
                        exitReason: exitReason
                    })
                });

                if (!response.ok) throw new Error('Failed to close trade');

                const result = await response.json();
                results.push({ tradeId, success: true, result });
            } catch (error) {
                errors.push({ tradeId, error: error.message });
            }

            // Small delay between closes
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Refresh displays
        if (typeof CapitalDisplay !== 'undefined' && CapitalDisplay.refreshCapitalData) {
            await CapitalDisplay.refreshCapitalData();
        }

        return { results, errors };
    }

    /**
     * Add notes to trade
     */
    async function addTradeNote(tradeId, note, tags = []) {
        try {
            const currentNotes = await getTradeNotes(tradeId);
            const newNote = {
                text: note,
                tags: tags,
                timestamp: new Date().toISOString()
            };

            const updatedNotes = [...currentNotes, newNote];

            const response = await fetch(`/api/trades/${tradeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes: JSON.stringify(updatedNotes)
                })
            });

            if (!response.ok) throw new Error('Failed to add note');

            return await response.json();
        } catch (error) {
            console.error('Error adding note:', error);
            throw error;
        }
    }

    /**
     * Get trade notes
     */
    async function getTradeNotes(tradeId) {
        try {
            const response = await fetch(`/api/trades/${tradeId}`);
            if (!response.ok) throw new Error('Failed to fetch trade');

            const trade = await response.json();
            if (!trade.notes) return [];

            try {
                return JSON.parse(trade.notes);
            } catch {
                return [{ text: trade.notes, timestamp: trade.created_at }];
            }
        } catch (error) {
            console.error('Error getting notes:', error);
            return [];
        }
    }

    /**
     * Filter trades by criteria
     */
    function filterTrades(trades, criteria) {
        return trades.filter(trade => {
            // Filter by status
            if (criteria.status && trade.status !== criteria.status) {
                return false;
            }

            // Filter by market
            if (criteria.market) {
                const symbol = trade.symbol;
                const isIndian = symbol.includes('.NS');
                const isUK = symbol.includes('.L');
                const isUS = !isIndian && !isUK;

                if (criteria.market === 'india' && !isIndian) return false;
                if (criteria.market === 'uk' && !isUK) return false;
                if (criteria.market === 'us' && !isUS) return false;
            }

            // Filter by date range
            if (criteria.startDate) {
                const tradeDate = new Date(trade.entryDate);
                if (tradeDate < new Date(criteria.startDate)) return false;
            }

            if (criteria.endDate) {
                const tradeDate = new Date(trade.entryDate);
                if (tradeDate > new Date(criteria.endDate)) return false;
            }

            // Filter by P/L
            if (criteria.minPL !== undefined) {
                if (!trade.profitLossPercentage || trade.profitLossPercentage < criteria.minPL) {
                    return false;
                }
            }

            if (criteria.maxPL !== undefined) {
                if (!trade.profitLossPercentage || trade.profitLossPercentage > criteria.maxPL) {
                    return false;
                }
            }

            // Filter by tags
            if (criteria.tags && criteria.tags.length > 0) {
                if (!trade.tags || !criteria.tags.some(tag => trade.tags.includes(tag))) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Export trades to CSV
     */
    function exportToCSV(trades) {
        // CSV headers
        const headers = [
            'Symbol', 'Entry Date', 'Entry Price', 'Current Price',
            'Stop Loss', 'Target', 'Trade Size', 'Market',
            'P/L %', 'Status', 'Exit Date', 'Exit Price', 'Exit Reason', 'Notes'
        ];

        // Convert trades to CSV rows
        const rows = trades.map(trade => {
            const market = trade.symbol.includes('.NS') ? 'India' :
                          trade.symbol.includes('.L') ? 'UK' : 'US';

            return [
                trade.symbol,
                trade.entryDate ? new Date(trade.entryDate).toLocaleDateString() : '',
                trade.entryPrice || '',
                trade.currentPrice || '',
                trade.stopLossPrice || trade.stopLossPercent || '',
                trade.targetPrice || '',
                trade.tradeSize || trade.positionSize || '',
                market,
                trade.profitLossPercentage || '',
                trade.status || '',
                trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : '',
                trade.exitPrice || '',
                trade.exitReason || '',
                (trade.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
            ].map(val => `"${val}"`);
        });

        // Combine headers and rows
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        console.log(`Exported ${trades.length} trades to CSV`);
    }

    /**
     * Get market from symbol
     */
    function getMarketFromSymbol(symbol) {
        if (symbol.includes('.NS')) return 'India';
        if (symbol.includes('.L')) return 'UK';
        return 'US';
    }

    // Public API
    return {
        editTrade,
        bulkCloseTrades,
        addTradeNote,
        getTradeNotes,
        filterTrades,
        exportToCSV,
        getMarketFromSymbol
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TradeManagement = TradeManagement;
}
