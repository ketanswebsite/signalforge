/**
 * DTI Backtester - Enhanced Trade Entry Modal
 * trade-modal.js - Handles the trade entry modal for creating new trades
 * Improved UI and user experience with subtle animations and better feedback
 */

// Global TradeModal object
const TradeModal = (function() {
    // Private variables
    let modalElement = null;
    let currentOpportunity = null;
    let stockSymbol = null;
    let stockName = null;
    let currentPrice = 0;
    let currencySymbol = '$'; // Default, will be set dynamically
    
    // Parameters from backtester
    let stopLossPercent = 5;
    let takeProfitPercent = 8;
    let maxHoldingDays = 30;
    
    // DOM Elements
    let investmentInput = null;
    let sharesElement = null;
    let stopLossElement = null;
    let targetElement = null;
    let squareOffDateElement = null;
    let confirmButton = null;
    
    /**
     * Initialize the trade modal
     */
    function init() {
        // Create modal if it doesn't exist
        if (!document.getElementById('trade-entry-modal')) {
            createModalElement();
        }
        
        // Get backtester parameters
        updateParametersFromBacktester();
        
        // Set up event listeners
        setupEventListeners();
    }
    
    /**
     * Create the modal element and add it to the DOM
     */
    function createModalElement() {
        const modalHTML = `
        <div id="trade-entry-modal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        Take a New Trade
                    </h3>
                    <button class="modal-close" id="trade-modal-close" aria-label="Close modal">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="stock-info">
                        <h4 id="trade-stock-name">Stock Name</h4>
                        <div id="trade-stock-symbol" class="stock-symbol">SYMBOL</div>
                    </div>
                    
                    <div class="price-info">
                        <div class="price-label">Current Market Price</div>
                        <div id="trade-current-price" class="price-value">0.00</div>
                    </div>

                    <div class="parameter-group">
                        <label for="trade-investment-amount">Investment Amount</label>
                        <input type="number" id="trade-investment-amount" min="1" step="1" placeholder="Enter investment amount">
                        <span class="form-hint">Minimum investment varies by currency</span>
                    </div>

                    <div class="trade-details">
                        <div class="detail-row">
                            <div class="detail-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                    <line x1="12" y1="16" x2="12" y2="16"></line>
                                    <line x1="12" y1="8" x2="12" y2="8"></line>
                                </svg>
                                Shares
                            </div>
                            <div id="trade-shares" class="detail-value">0</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Stop Loss Price
                            </div>
                            <div id="trade-stop-loss" class="detail-value">0.00</div>
                            <div class="detail-info">(${stopLossPercent}% below entry)</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Target Price
                            </div>
                            <div id="trade-target" class="detail-value">0.00</div>
                            <div class="detail-info">(${takeProfitPercent}% above entry)</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Square Off Date
                            </div>
                            <div id="trade-square-off-date" class="detail-value">-</div>
                            <div class="detail-info">(if target/stop not hit)</div>
                        </div>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="trade-notes">Notes (Optional)</label>
                        <textarea id="trade-notes" rows="3" placeholder="Add any notes or observations about this trade"></textarea>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button id="trade-cancel" class="btn-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Cancel
                    </button>
                    <button id="trade-confirm" class="btn-success">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Confirm Trade
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Find the placeholder if it exists, or create a new element
        let modalContainer = document.getElementById('trade-modal-placeholder');
        
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'trade-modal-placeholder';
            document.body.appendChild(modalContainer);
        }
        
        // Add the modal HTML to the container
        modalContainer.innerHTML = modalHTML;
        
        // Store reference to modal element
        modalElement = document.getElementById('trade-entry-modal');
    }
    
    /**
     * Set up event listeners for the modal
     */
    function setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('trade-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        // Cancel button
        const cancelBtn = document.getElementById('trade-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // Confirm button
        confirmButton = document.getElementById('trade-confirm');
        if (confirmButton) {
            confirmButton.addEventListener('click', confirmTrade);
        }
        
        // Investment amount input
        investmentInput = document.getElementById('trade-investment-amount');
        if (investmentInput) {
            investmentInput.addEventListener('input', calculateTradeDetails);
            
            // Add validation visualization
            investmentInput.addEventListener('blur', function() {
                validateInvestmentAmount(this.value);
            });
        }
        
        // Store references to elements that will be updated
        sharesElement = document.getElementById('trade-shares');
        stopLossElement = document.getElementById('trade-stop-loss');
        targetElement = document.getElementById('trade-target');
        squareOffDateElement = document.getElementById('trade-square-off-date');
        
        // Close modal on background click (but not on modal content click)
        if (modalElement) {
            modalElement.addEventListener('click', function(e) {
                if (e.target === modalElement) {
                    closeModal();
                }
            });
            
            // Add escape key handler
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modalElement.classList.contains('active')) {
                    closeModal();
                }
            });
        }
    }
    
    /**
     * Validates investment amount and provides visual feedback
     * @param {number} amount - The investment amount to validate
     * @returns {boolean} - True if valid, false otherwise
     */
function validateInvestmentAmount(amount) {
    amount = parseFloat(amount) || 0;
    
    // Define minimum amounts based on currency
    let minAmount = 100; // Default fallback
    if (currencySymbol === '$' || currencySymbol === '£') {
        minAmount = 1;
    } else if (currencySymbol === '₹') {
        minAmount = 10000;
    }
    
    const isValid = amount >= minAmount;
    
    if (investmentInput) {
        if (isValid) {
            investmentInput.classList.remove('error');
            investmentInput.nextElementSibling.textContent = `Minimum investment: ${currencySymbol}${minAmount}`;
            investmentInput.nextElementSibling.classList.remove('error-hint');
        } else {
            investmentInput.classList.add('error');
            investmentInput.nextElementSibling.textContent = `Investment must be at least ${currencySymbol}${minAmount}`;
            investmentInput.nextElementSibling.classList.add('error-hint');
        }
    }
    
    return isValid;
}
    
    /**
     * Update trading parameters from the backtester
     */
    function updateParametersFromBacktester() {
        // Get the parameters from the backtester inputs
        const stopLossInput = document.getElementById('stop-loss');
        const takeProfitInput = document.getElementById('take-profit');
        const maxDaysInput = document.getElementById('max-days');
        
        if (stopLossInput) stopLossPercent = parseFloat(stopLossInput.value);
        if (takeProfitInput) takeProfitPercent = parseFloat(takeProfitInput.value);
        if (maxDaysInput) maxHoldingDays = parseInt(maxDaysInput.value);
        
        // Update the labels in the modal if it exists
        const stopLossInfo = document.querySelector('.detail-row:nth-child(2) .detail-info');
        const targetInfo = document.querySelector('.detail-row:nth-child(3) .detail-info');
        
        if (stopLossInfo) stopLossInfo.textContent = `(${stopLossPercent}% below entry)`;
        if (targetInfo) targetInfo.textContent = `(${takeProfitPercent}% above entry)`;
    }
    
    /**
     * Open the modal with opportunity data
     * @param {Object} opportunity - The trading opportunity data
     */
    function openModal(opportunity) {
        // Update parameters from backtester
        updateParametersFromBacktester();
        
        // Store the opportunity data
        currentOpportunity = opportunity;
        stockSymbol = opportunity.symbol;
        stockName = opportunity.name;
        currentPrice = opportunity.currentPrice || opportunity.close || 0;
        
        // Determine currency symbol based on the stock symbol
        currencySymbol = typeof TradeCore !== 'undefined' && TradeCore.getCurrencySymbol ? 
            TradeCore.getCurrencySymbol(stockSymbol) : 
            (stockSymbol.endsWith('.L') ? '£' : (stockSymbol.includes('.') ? '₹' : '$'));
        
// Update the modal UI
document.getElementById('trade-stock-name').textContent = stockName;
document.getElementById('trade-stock-symbol').textContent = stockSymbol;
document.getElementById('trade-current-price').textContent = `${currencySymbol}${currentPrice.toFixed(2)}`;

// Determine minimum investment based on currency
let minAmount = 100; // Default fallback
if (currencySymbol === '$' || currencySymbol === '£') {
    minAmount = 1;
} else if (currencySymbol === '₹') {
    minAmount = 10000;
}

// Clear and focus the investment amount input
investmentInput.value = '';
investmentInput.min = minAmount; // Update min attribute
investmentInput.step = Math.min(minAmount, 100); // Update step attribute appropriately
investmentInput.classList.remove('error');
const formHint = investmentInput.nextElementSibling;
if (formHint) {
    formHint.textContent = `Minimum investment: ${currencySymbol}${minAmount}`;
    formHint.classList.remove('error-hint');
}

        
        // Calculate square off date
        const squareOffDate = new Date();
        squareOffDate.setDate(squareOffDate.getDate() + maxHoldingDays);
        squareOffDateElement.textContent = formatDate(squareOffDate);
        
        // Reset other calculated values
        sharesElement.textContent = '0';
        stopLossElement.textContent = `${currencySymbol}${calculateStopLoss(currentPrice).toFixed(2)}`;
        targetElement.textContent = `${currencySymbol}${calculateTarget(currentPrice).toFixed(2)}`;
        
        // Clear notes
        document.getElementById('trade-notes').value = '';
        
        // Reset confirm button state
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Confirm Trade';
        }
        
        // Show the modal with animation
        modalElement.classList.add('active');
        
        // Focus on investment input after a short delay
        setTimeout(() => {
            investmentInput.focus();
        }, 300);
    }
    
    /**
     * Close the modal
     */
    function closeModal() {
        modalElement.classList.remove('active');
        currentOpportunity = null;
    }
    
    /**
     * Calculate trade details based on investment amount
     */
function calculateTradeDetails() {
    const investmentAmount = parseFloat(investmentInput.value) || 0;
    
    if (investmentAmount > 0 && currentPrice > 0) {
        // Calculate number of shares (allow fractional shares)
        const shares = investmentAmount / currentPrice;
        
        // Update UI - display with appropriate precision
        sharesElement.textContent = shares.toFixed(4);
        stopLossElement.textContent = `${currencySymbol}${calculateStopLoss(currentPrice).toFixed(2)}`;
        targetElement.textContent = `${currencySymbol}${calculateTarget(currentPrice).toFixed(2)}`;
        
        // No need to adjust investment amount since we're allowing fractional shares
    } else {
        // Reset values if investment amount is invalid
        sharesElement.textContent = '0';
    }
}
    
    /**
     * Calculate stop loss price based on entry price
     * @param {number} entryPrice - The entry price
     * @returns {number} - The stop loss price
     */
    function calculateStopLoss(entryPrice) {
        return entryPrice * (1 - (stopLossPercent / 100));
    }
    
    /**
     * Calculate target price based on entry price
     * @param {number} entryPrice - The entry price
     * @returns {number} - The target price
     */
    function calculateTarget(entryPrice) {
        return entryPrice * (1 + (takeProfitPercent / 100));
    }
    
    /**
     * Confirm the trade and create a new trade record
     */
    async function confirmTrade() {
        const investmentAmount = parseFloat(investmentInput.value) || 0;
        
        // Validate input
        if (!validateInvestmentAmount(investmentAmount)) {
            investmentInput.focus();
            return;
        }
        
        // Calculate shares based on market type
        let shares;
        const isIndianMarket = stockSymbol.includes('.NS') || stockSymbol.includes('.BO') || (!stockSymbol.includes('.') && currencySymbol === '₹');
        
        if (isIndianMarket) {
            // Indian markets: whole numbers only
            shares = Math.floor(investmentAmount / currentPrice);
        } else {
            // UK (.L) and US markets: allow fractional shares
            shares = parseFloat((investmentAmount / currentPrice).toFixed(6)); // Round to 6 decimal places
        }
        
        // Validate minimum shares
        const minShares = isIndianMarket ? 1 : 0.000001; // Minimum 1 share for Indian market, very small fraction for others
        if (shares < minShares) {
            const minInvestment = isIndianMarket ? currentPrice : 0.01; // Minimum 1 cent for fractional shares
            showNotification(`Investment amount too low. Minimum required: ${currencySymbol}${minInvestment.toFixed(2)}`, 'error');
            // Reset button state
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Confirm Trade
                `;
            }
            return;
        }
        

        
        // Set button to loading state
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = `
                <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                Processing...
            `;
        }
        
        // Get notes
        const notes = document.getElementById('trade-notes').value;
        
        // Calculate square off date
        const squareOffDate = new Date();
        squareOffDate.setDate(squareOffDate.getDate() + maxHoldingDays);
        
        // Prepare trade data
        const tradeData = {
            stockName: stockName,
            symbol: stockSymbol,
            entryPrice: currentPrice,
            investmentAmount: investmentAmount,
            shares: shares,
            stopLossPrice: calculateStopLoss(currentPrice),
            targetPrice: calculateTarget(currentPrice),
            stopLossPercent: stopLossPercent,
            takeProfitPercent: takeProfitPercent,
            squareOffDate: squareOffDate,
            entryDate: new Date(),
            currencySymbol: currencySymbol,  // Add the currency symbol
            notes: notes,
            status: 'active'  // Add the required status field
        };
        
        // Add the trade using the trades.js function
        if (typeof window.addNewTrade === 'function') {
            try {
                const tradeId = await window.addNewTrade(tradeData);
                
                if (tradeId) {
                    // Show success message
                    showNotification(`Trade added successfully: ${shares} shares of ${stockName}`, 'success');
                    
                    // Close the modal
                    closeModal();
                    
                    // Navigate to trades page
                    if (confirm('Trade added successfully! Do you want to view your trades now?')) {
                        window.location.href = 'trades.html';
                    }
                } else {
                    throw new Error('Failed to add trade - no trade ID returned');
                }
            } catch (error) {
                // Show detailed error message to help diagnose the issue
                const errorMessage = error.message || 'Unknown error occurred';
                showNotification(`Error adding trade: ${errorMessage}`, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Confirm Trade
                    `;
                }
            }
        } else {
            showNotification('Trade management system is not initialized properly.', 'error');
            
            // Reset button state
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Confirm Trade
                `;
            }
        }
    }
    
    /**
     * Display validation error on an input element
     * @param {HTMLElement} inputElement - The input element
     * @param {string} message - Error message to display
     */
    function showValidationError(inputElement, message) {
        inputElement.classList.add('error');
        const hintElement = inputElement.nextElementSibling;
        
        if (hintElement) {
            hintElement.textContent = message;
            hintElement.classList.add('error-hint');
        }
    }
    
    /**
     * Format a date as a string
     * @param {Date} date - The date to format
     * @returns {string} - Formatted date string
     */
    function formatDate(date) {
        if (!date) return 'N/A';
        
        try {
            // Handle different input types
            let dateObj;
            if (date instanceof Date) {
                dateObj = date;
            } else if (typeof date === 'string') {
                dateObj = new Date(date);
            } else {
                return String(date); // Return as string if not a recognized format
            }
            
            // Verify it's a valid date
            if (isNaN(dateObj.getTime())) {
                return String(date); // Return original value as string if invalid date
            }
            
            return dateObj.toLocaleDateString();
        } catch (error) {
            return String(date); // Fallback to string representation
        }
    }
    
    /**
     * Show a notification message
     * @param {string} message - Message to show
     * @param {string} type - Notification type (success, error, info)
     */
    function showNotification(message, type = 'info') {
        // Check if there's a notification system in script.js
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            ${type === 'success' ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            ${type === 'error' ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' : ''}
            ${type === 'info' ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' : ''}
            <span>${message}</span>
        `;
        
        // Add to document - try to find notification container first
        const container = document.getElementById('notification-container') || document.body;
        container.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-in-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Add a small animation for the spinner
    
    
    // Public methods
    return {
        init: init,
        openModal: openModal,
        closeModal: closeModal,
        updateParameters: updateParametersFromBacktester
    };
})();

// Initialize the modal on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    TradeModal.init();
});

// Add a helper function to script.js to open the modal from opportunity cards
window.openTradeModal = function(opportunityData) {
    TradeModal.openModal(opportunityData);
};