/**
 * Alerts UI Module
 * Handles the user interface for configuring Telegram alerts
 */

const AlertsUI = (function() {
    let alertPreferences = null;
    let botInfo = null;
    
    // Initialize the alerts UI
    async function init() {
        console.log('AlertsUI: Initializing...');
        
        // Load current preferences
        await loadPreferences();
        
        // Create the alerts modal first
        createAlertsModal();
        
        // Add alerts button to the page
        addAlertsButton();
        
        console.log('AlertsUI: Initialized');
    }
    
    // Load alert preferences from server
    async function loadPreferences() {
        try {
            const response = await fetch('/api/alerts/preferences');
            if (response.ok) {
                alertPreferences = await response.json();
            }
        } catch (error) {
            console.error('Failed to load alert preferences:', error);
        }
    }
    
    // Add alerts button to trades page
    function addAlertsButton() {
        // Alert button disabled - functionality hidden from UI
        return;
        
        // Check if button already exists
        if (document.querySelector('.alerts-button')) return;
        
        // Find the right place to add the button
        const navBar = document.querySelector('.nav-bar');
        const pageNav = document.querySelector('.page-nav');
        const navLinks = document.querySelector('.nav-links');
        
        const alertsButton = document.createElement('button');
        alertsButton.className = 'alerts-button';
        alertsButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
        `;
        alertsButton.style.position = 'fixed';
        alertsButton.style.top = '20px';
        alertsButton.style.right = '20px';
        alertsButton.style.width = '40px';
        alertsButton.style.height = '40px';
        alertsButton.style.borderRadius = '50%';
        alertsButton.style.backgroundColor = 'var(--primary-color)';
        alertsButton.style.color = 'white';
        alertsButton.style.border = 'none';
        alertsButton.style.cursor = 'pointer';
        alertsButton.style.display = 'flex';
        alertsButton.style.alignItems = 'center';
        alertsButton.style.justifyContent = 'center';
        alertsButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        alertsButton.style.transition = 'all 0.2s ease';
        alertsButton.style.zIndex = '1000';
        alertsButton.title = 'Alerts Settings';
        
        // Add hover effect
        alertsButton.onmouseover = function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        };
        alertsButton.onmouseout = function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        };
        
        // Navigate to alerts page when clicked
        alertsButton.onclick = function(e) {
            e.preventDefault();
            window.location.href = '/alerts.html';
        };
        
        // Add directly to body for fixed positioning
        document.body.appendChild(alertsButton);
        
        // Add right margin to navigation containers to avoid bell icon
        if (navBar) {
            navBar.style.marginRight = '60px';
        }
        if (pageNav) {
            pageNav.style.marginRight = '60px';
        }
        if (navLinks) {
            navLinks.style.marginRight = '60px';
        }
    }
    
    // Create the alerts configuration modal
    function createAlertsModal() {
        // Check if modal already exists
        if (document.getElementById('alerts-modal')) {
            console.log('AlertsUI: Modal already exists');
            return;
        }
        
        console.log('AlertsUI: Creating modal...');
        const modal = document.createElement('div');
        modal.className = 'dialog-overlay';
        modal.id = 'alerts-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div class="dialog-content" style="max-width: 600px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 0; margin: 20px;">
                <div class="dialog-header" style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        Configure Alerts
                    </h3>
                    <button class="dialog-close" onclick="AlertsUI.hideAlertsModal()" style="position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
                </div>
                <div class="dialog-body" style="padding: 20px;">
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
                                <button class="btn-secondary" onclick="AlertsUI.testTelegram()" style="margin-top: 5px;">
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
                                Buy Signals
                            </label>
                            <label>
                                <input type="checkbox" id="alert-sell" ${alertPreferences?.alert_on_sell !== false ? 'checked' : ''}>
                                Sell Signals
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
                    
                    <div id="alert-status" class="alert-status" style="display: none; margin-top: 15px;"></div>
                </div>
                <div class="dialog-actions" style="padding: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 10px;">
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
        const style = document.createElement('style');
        style.textContent = `
            .alerts-button {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            
            .alert-section {
                background-color: var(--background-secondary);
                border-radius: var(--radius);
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .alert-section h4 {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 0;
                margin-bottom: 15px;
                color: var(--primary-color);
            }
            
            .setup-steps {
                background-color: var(--primary-lightest);
                border-left: 3px solid var(--primary-color);
                padding: 15px;
                margin-bottom: 20px;
                border-radius: var(--radius-sm);
            }
            
            .setup-steps h5 {
                margin-top: 0;
                margin-bottom: 10px;
                color: var(--primary-color);
            }
            
            .setup-steps ol {
                margin: 0;
                padding-left: 20px;
            }
            
            .setup-steps li {
                margin-bottom: 8px;
                line-height: 1.5;
            }
            
            .setup-steps code {
                background-color: var(--background-color);
                padding: 2px 6px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 14px;
            }
            
            .alert-types {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }
            
            .alert-types label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                padding: 8px;
                border-radius: var(--radius-sm);
                transition: background-color 0.2s ease;
            }
            
            .alert-types label:hover {
                background-color: var(--background-color);
            }
            
            .alert-types input[type="checkbox"] {
                cursor: pointer;
            }
            
            .alert-status {
                padding: 12px 16px;
                border-radius: var(--radius-sm);
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .alert-status.success {
                background-color: #d4edda;
                color: #155724;
                border-left: 3px solid #28a745;
            }
            
            .alert-status.error {
                background-color: #f8d7da;
                color: #721c24;
                border-left: 3px solid #dc3545;
            }
            
            .alert-status.info {
                background-color: #d1ecf1;
                color: #0c5460;
                border-left: 3px solid #17a2b8;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Show the alerts modal
    function showAlertsModal() {
        console.log('AlertsUI: Showing modal...');
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal.style.display = 'flex';
            loadPreferences(); // Reload preferences when opening
            console.log('AlertsUI: Modal displayed');
        } else {
            console.error('AlertsUI: Modal not found! Creating it now...');
            createAlertsModal();
            // Try again
            const newModal = document.getElementById('alerts-modal');
            if (newModal) {
                newModal.style.display = 'flex';
                loadPreferences();
            }
        }
    }
    
    // Hide the alerts modal
    function hideAlertsModal() {
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal.style.display = 'none';
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
        statusDiv.style.display = 'block';
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