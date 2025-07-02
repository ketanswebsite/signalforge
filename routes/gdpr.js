const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../config/auth');

// Get user data summary for data management page
router.get('/user/data-summary', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.email;
        
        // Get user's trades
        const trades = await db.getTrades(userId);
        const activeTrades = trades.filter(t => t.status === 'open');
        
        // Get last activity
        const lastActivity = trades.length > 0 ? 
            Math.max(...trades.map(t => new Date(t.updatedAt || t.createdAt || t.entryDate).getTime())) : null;
        
        const summary = {
            email: req.user.email,
            name: req.user.displayName || req.user.name || 'N/A',
            created_at: req.user.createdAt || new Date().toISOString(),
            total_trades: trades.length,
            active_signals: activeTrades.length,
            last_activity: lastActivity ? new Date(lastActivity).toISOString() : null
        };
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching user data summary:', error);
        res.status(500).json({ error: 'Failed to fetch data summary' });
    }
});

// Download all user data (GDPR data portability)
router.get('/user/download-data', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.email;
        
        // Collect all user data
        const userData = {
            exportDate: new Date().toISOString(),
            gdprExport: true,
            user: {
                email: req.user.email,
                name: req.user.displayName || req.user.name,
                profilePicture: req.user.picture || req.user.photos?.[0]?.value,
                provider: req.user.provider,
                createdAt: req.user.createdAt || 'N/A'
            },
            trades: await db.getTrades(userId),
            preferences: await db.getAlertPreferences?.(userId) || {},
            consentHistory: await db.getConsentHistory?.(userId) || []
        };
        
        // Set headers for JSON download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="signalforge-data-${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json(userData);
    } catch (error) {
        console.error('Error downloading user data:', error);
        res.status(500).json({ error: 'Failed to download data' });
    }
});

// Export trades as CSV
router.get('/trades/export', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.email;
        const trades = await db.getTrades(userId);
        
        // Convert to CSV
        const headers = ['Stock', 'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'Shares', 'Profit/Loss', 'Status', 'Exit Reason'];
        
        const csvRows = [headers.join(',')];
        
        trades.forEach(trade => {
            const row = [
                trade.stock || trade.symbol,
                trade.entryDate,
                trade.exitDate || 'N/A',
                trade.entryPrice,
                trade.exitPrice || 'N/A',
                trade.shares || 'N/A',
                trade.profitLoss || 'N/A',
                trade.status,
                trade.exitReason || 'N/A'
            ];
            csvRows.push(row.map(cell => `"${cell}"`).join(','));
        });
        
        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="trade-history-${new Date().toISOString().split('T')[0]}.csv"`);
        
        res.send(csv);
    } catch (error) {
        console.error('Error exporting trades:', error);
        res.status(500).json({ error: 'Failed to export trades' });
    }
});

// Delete user account (GDPR right to erasure)
router.delete('/user/delete-account', isAuthenticated, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.email;
        
        // Log the deletion request for compliance
        console.log(`Account deletion requested for user: ${userId} at ${new Date().toISOString()}`);
        
        // Delete user's trades (except what we must retain for legal compliance)
        const trades = await db.getTrades(userId);
        
        // For financial compliance, we may need to retain some data for 6 years
        // But we can anonymize it
        for (const trade of trades) {
            if (trade.status === 'closed' && trade.exitDate) {
                const exitDate = new Date(trade.exitDate);
                const sixYearsAgo = new Date();
                sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
                
                if (exitDate < sixYearsAgo) {
                    // Can fully delete old trades
                    await db.deleteTrade?.(trade.id, userId);
                } else {
                    // Anonymize but retain for compliance
                    await db.anonymizeTrade?.(trade.id);
                }
            } else {
                // Delete open trades
                await db.deleteTrade?.(trade.id, userId);
            }
        }
        
        // Delete preferences
        await db.deleteAlertPreferences?.(userId);
        
        // Clear session
        req.logout((err) => {
            if (err) {
                console.error('Error during logout:', err);
            }
        });
        
        res.json({ success: true, message: 'Account deletion initiated' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Record cookie consent
router.post('/privacy/consent', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user?.email || 'anonymous';
        const consent = req.body;
        
        // Store consent record
        await db.recordConsent?.({
            userId,
            consent,
            timestamp: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error recording consent:', error);
        res.status(500).json({ error: 'Failed to record consent' });
    }
});

// Get data retention policy
router.get('/privacy/retention-policy', (req, res) => {
    res.json({
        policy: {
            account_data: '30 days after deletion request',
            financial_records: '6 years (UK legal requirement)',
            usage_logs: '12 months',
            support_communications: '3 years',
            marketing_data: '30 days after consent withdrawal'
        },
        lastUpdated: '2025-01-06'
    });
});

module.exports = router;