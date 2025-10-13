/**
 * Alerts UI Module
 * Handles the user interface for configuring Telegram alerts
 */

const AlertsUI = (function() {
    let alertPreferences = null;
    let botInfo = null;
    
    // Initialize the alerts UI
    async function init() {
        
        // Load current preferences
        await loadPreferences();
        
        // Add Telegram subscription button to the page
        addTelegramButton();
        
    }
    
    // Load alert preferences from server
    async function loadPreferences() {
        try {
            const response = await fetch('/api/alerts/preferences');
            if (response.ok) {
                alertPreferences = await response.json();
            } else {
                alertPreferences = {
                    telegram_enabled: false,
                    telegram_chat_id: '',
                    alert_on_buy: true,
                    alert_on_sell: true,
                    alert_on_target: true,
                    alert_on_stoploss: true,
                    alert_on_time_exit: true,
                    market_open_alert: false,
                    market_close_alert: false
                };
            }
        } catch (error) {
            // Use defaults on error
            alertPreferences = {
                telegram_enabled: false,
                telegram_chat_id: '',
                alert_on_buy: true,
                alert_on_sell: true,
                alert_on_target: true,
                alert_on_stoploss: true,
                alert_on_time_exit: true,
                market_open_alert: false,
                market_close_alert: false
            };
        }
    }
    
    // Add telegram subscription button to navigation
    // NOTE: Buttons moved to unified navbar - this function is now deprecated
    function addTelegramButton() {
        // Buttons are now in the unified navbar at the top of the page
        // This function is kept for backwards compatibility but does nothing
    }
    
    // Add telegram subscription button to mobile navigation drawer
    // NOTE: Mobile buttons also moved to unified navbar - this function is now deprecated
    function addTelegramButtonToMobileNav() {
        // Mobile Telegram link is now in the unified navbar mobile drawer
        // This function is kept for backwards compatibility but does nothing
    }
    
    // Show instructions if Telegram isn't installed
    function showTelegramInstructions() {
        // Check if instruction modal already exists
        if (document.getElementById('telegram-instructions-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'telegram-instructions-modal';
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="telegram-icon">📱</div>
                <h3>Join My Telegram for Trading Signals!</h3>
                <p class="modal-description">
                    Get my daily 7 AM conviction trades and high conviction scan results delivered directly to your phone.
                </p>
                <div class="telegram-instructions">
                    <p class="instructions-title">📲 How to subscribe:</p>
                    <p class="instructions-text">
                        1. Install Telegram app on your phone<br>
                        2. Search for <strong>@MySignalForgeBot</strong><br>
                        3. Send <strong>/start</strong> to subscribe
                    </p>
                </div>
                <div class="modal-actions">
                    <a href="https://telegram.org/apps" target="_blank" class="btn-telegram-install">
                        📱 Install Telegram
                    </a>
                    <a href="https://t.me/MySignalForgeBot" target="_blank" class="btn-telegram-open">
                        🚀 Open Bot
                    </a>
                </div>
                <button onclick="document.getElementById('telegram-instructions-modal').remove()" class="btn-modal-close">
                    Close
                </button>
            </div>
        `;
        
        // Close on background click
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        };
        
        document.body.appendChild(modal);
    }
    
    // Create the alerts configuration modal
    function createAlertsModal() {
        // Check if modal already exists
        if (document.getElementById('alerts-modal')) {
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'dialog-overlay';
        modal.id = 'alerts-modal';

        modal.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        Configure Alerts
                    </h3>
                    <button class="dialog-close" onclick="AlertsUI.hideAlertsModal()">&times;</button>
                </div>
                <div class="dialog-body">
                    <!-- Telegram Setup Section -->
                    <div class="alert-section">
                        <h4>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            Telegram Alerts
                        </h4>
                        
                        <div class="telegram-setup">
                            <div class="setup-steps">
                                <h5>Setup Instructions:</h5>
                                <ol>
                                    <li>Open Telegram and search for <code>@SignalForgeBot</code></li>
                                    <li>Start the bot by clicking "Start" or sending <code>/start</code></li>
                                    <li>The bot will send you your Chat ID</li>
                                    <li>Enter your Chat ID below</li>
                                </ol>
                            </div>
                            
                            <div class="parameter-group">
                                <label for="telegram-enabled">
                                    <input type="checkbox" id="telegram-enabled" ${alertPreferences?.telegram_enabled ? 'checked' : ''}>
                                    Enable Telegram Alerts
                                </label>
                            </div>
                            
                            <div class="parameter-group">
                                <label for="telegram-chat-id">Chat ID</label>
                                <input type="text" id="telegram-chat-id" placeholder="Enter your Telegram Chat ID" value="${alertPreferences?.telegram_chat_id || ''}">
                                <button class="btn-secondary" onclick="AlertsUI.testTelegram()">
                                    Test Connection
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Alert Types Section -->
                    <div class="alert-section">
                        <h4>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            Alert Types
                        </h4>
                        
                        <div class="alert-types">
                            <label>
                                <input type="checkbox" id="alert-buy" ${alertPreferences?.alert_on_buy !== false ? 'checked' : ''}>
                                Entry Patterns
                            </label>
                            <label>
                                <input type="checkbox" id="alert-sell" ${alertPreferences?.alert_on_sell !== false ? 'checked' : ''}>
                                Exit Patterns
                            </label>
                            <label>
                                <input type="checkbox" id="alert-target" ${alertPreferences?.alert_on_target !== false ? 'checked' : ''}>
                                Target Reached
                            </label>
                            <label>
                                <input type="checkbox" id="alert-stoploss" ${alertPreferences?.alert_on_stoploss !== false ? 'checked' : ''}>
                                Stop Loss Hit
                            </label>
                            <label>
                                <input type="checkbox" id="alert-time" ${alertPreferences?.alert_on_time_exit !== false ? 'checked' : ''}>
                                Time-based Exits
                            </label>
                            <label>
                                <input type="checkbox" id="alert-market-open" ${alertPreferences?.market_open_alert ? 'checked' : ''}>
                                Market Open
                            </label>
                            <label>
                                <input type="checkbox" id="alert-market-close" ${alertPreferences?.market_close_alert ? 'checked' : ''}>
                                Market Close
                            </label>
                        </div>
                    </div>

                    <div id="alert-status" class="alert-status"></div>
                </div>
                <div class="dialog-actions">
                    <button class="btn-secondary" onclick="AlertsUI.hideAlertsModal()">Cancel</button>
                    <button class="btn-primary" onclick="AlertsUI.savePreferences()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Settings
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles
        
    }
    
    // Show the alerts modal
    function showAlertsModal() {
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal
            loadPreferences(); // Reload preferences when opening
        } else {
            createAlertsModal();
            // Try again
            const newModal = document.getElementById('alerts-modal');
            if (newModal) {
                newModal
                loadPreferences();
            }
        }
    }
    
    // Hide the alerts modal
    function hideAlertsModal() {
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal
        }
    }
    
    // Test Telegram connection
    async function testTelegram() {
        const chatId = document.getElementById('telegram-chat-id').value;
        const statusDiv = document.getElementById('alert-status');
        
        if (!chatId) {
            showStatus('Please enter your Chat ID first', 'error');
            return;
        }
        
        showStatus('Testing connection...', 'info');
        
        try {
            const response = await fetch('/api/alerts/test-telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId })
            });
            
            if (response.ok) {
                showStatus('✅ Test message sent! Check your Telegram.', 'success');
            } else {
                const error = await response.json();
                showStatus(`❌ Failed: ${error.error}`, 'error');
            }
        } catch (error) {
            showStatus(`❌ Connection error: ${error.message}`, 'error');
        }
    }
    
    // Save alert preferences
    async function savePreferences() {
        const prefs = {
            telegram_enabled: document.getElementById('telegram-enabled').checked,
            telegram_chat_id: document.getElementById('telegram-chat-id').value,
            alert_on_buy: document.getElementById('alert-buy').checked,
            alert_on_sell: document.getElementById('alert-sell').checked,
            alert_on_target: document.getElementById('alert-target').checked,
            alert_on_stoploss: document.getElementById('alert-stoploss').checked,
            alert_on_time_exit: document.getElementById('alert-time').checked,
            market_open_alert: document.getElementById('alert-market-open').checked,
            market_close_alert: document.getElementById('alert-market-close').checked
        };
        
        showStatus('Saving preferences...', 'info');
        
        try {
            const response = await fetch('/api/alerts/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs)
            });
            
            if (response.ok) {
                alertPreferences = prefs;
                showStatus('✅ Alert preferences saved successfully!', 'success');
                setTimeout(() => hideAlertsModal(), 1500);
            } else {
                const error = await response.json();
                showStatus(`❌ Failed to save: ${error.error}`, 'error');
            }
        } catch (error) {
            showStatus(`❌ Save error: ${error.message}`, 'error');
        }
    }
    
    // Show status message
    function showStatus(message, type) {
        const statusDiv = document.getElementById('alert-status');
        if (!statusDiv) return;
        
        statusDiv.textContent = message;
        statusDiv.className = `alert-status ${type}`;
        statusDiv
    }
    
    // Public API
    return {
        init,
        showAlertsModal,
        hideAlertsModal,
        testTelegram,
        savePreferences
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(AlertsUI.init, 100); // Small delay to ensure everything is loaded
    });
} else {
    setTimeout(AlertsUI.init, 100); // Small delay to ensure everything is loaded
}