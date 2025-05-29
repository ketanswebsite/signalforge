/**
 * Input validation middleware for API endpoints
 */

// Validate trade data
function validateTradeData(req, res, next) {
    const { symbol, type, entryDate, entryPrice, shares, targetPrice, stopLoss } = req.body;
    
    // Required fields
    if (!symbol || !type || !entryDate || !entryPrice || !shares) {
        return res.status(400).json({ 
            error: 'Missing required fields: symbol, type, entryDate, entryPrice, shares' 
        });
    }
    
    // Type validation
    if (!['buy', 'sell'].includes(type.toLowerCase())) {
        return res.status(400).json({ error: 'Type must be "buy" or "sell"' });
    }
    
    // Numeric validation
    const numericFields = {
        entryPrice: entryPrice,
        shares: shares,
        targetPrice: targetPrice,
        stopLoss: stopLoss
    };
    
    for (const [field, value] of Object.entries(numericFields)) {
        if (value !== undefined && value !== null && value !== '') {
            const num = parseFloat(value);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({ 
                    error: `${field} must be a positive number` 
                });
            }
            // Store parsed value
            req.body[field] = num;
        }
    }
    
    // Date validation
    const date = new Date(entryDate);
    if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid entry date' });
    }
    
    // Symbol validation (basic)
    if (!/^[A-Z0-9\.\-]+$/i.test(symbol)) {
        return res.status(400).json({ 
            error: 'Invalid symbol format. Use letters, numbers, dots, and hyphens only.' 
        });
    }
    
    // Logical validation
    if (targetPrice && stopLoss) {
        if (type.toLowerCase() === 'buy' && targetPrice <= entryPrice) {
            return res.status(400).json({ 
                error: 'For buy trades, target price must be higher than entry price' 
            });
        }
        if (type.toLowerCase() === 'buy' && stopLoss >= entryPrice) {
            return res.status(400).json({ 
                error: 'For buy trades, stop loss must be lower than entry price' 
            });
        }
    }
    
    next();
}

// Validate square off data
function validateSquareOffData(req, res, next) {
    const { exitDate, exitPrice, exitReason } = req.body;
    
    if (!exitDate || exitPrice === undefined) {
        return res.status(400).json({ 
            error: 'Missing required fields: exitDate, exitPrice' 
        });
    }
    
    // Numeric validation
    const price = parseFloat(exitPrice);
    if (isNaN(price) || price < 0) {
        return res.status(400).json({ 
            error: 'Exit price must be a positive number' 
        });
    }
    req.body.exitPrice = price;
    
    // Date validation
    const date = new Date(exitDate);
    if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid exit date' });
    }
    
    // Exit reason validation
    const validReasons = ['Target', 'Stoploss', 'Manual', 'Time Exit', 'Other'];
    if (exitReason && !validReasons.includes(exitReason)) {
        return res.status(400).json({ 
            error: `Invalid exit reason. Must be one of: ${validReasons.join(', ')}` 
        });
    }
    
    next();
}

// Validate trade ID
function validateTradeId(req, res, next) {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid trade ID' });
    }
    
    req.params.id = parseInt(id);
    next();
}

// Sanitize HTML to prevent XSS
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Apply sanitization to all string inputs
function sanitizeAllInputs(req, res, next) {
    // Sanitize body
    if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string') {
                req.body[key] = sanitizeInput(value);
            }
        }
    }
    
    // Sanitize query params
    if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
                req.query[key] = sanitizeInput(value);
            }
        }
    }
    
    next();
}

module.exports = {
    validateTradeData,
    validateSquareOffData,
    validateTradeId,
    sanitizeAllInputs,
    sanitizeInput
};