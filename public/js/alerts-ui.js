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
                console.warn('No alert preferences found, using defaults');
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
            console.error('Failed to load alert preferences:', error);
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
    function addTelegramButton() {
        // Check if button already exists
        if (document.querySelector('.telegram-button')) return;
        
        // Wait a bit for page to load
        setTimeout(() => {
            // Check which page we're on to determine where to insert the button
            const currentPage = window.location.pathname;
            let targetContainer = null;
            let insertPosition = 'beforebegin';
            
            if (currentPage.includes('trades.html')) {
                // On trades page, insert before "Back to Backtester" button
                targetContainer = document.querySelector('.btn-nav[onclick*="index.html"]');
            } else if (currentPage.includes('index.html') || currentPage === '/') {
                // On index page, insert before "Signal Management" link
                targetContainer = document.querySelector('.nav-link[href="trades.html"]');
            }
            
            if (!targetContainer) return;
            
            const telegramButton = document.createElement('a');
            telegramButton.href = '/telegram-subscribe.html';
            telegramButton.className = 'telegram-button btn-nav desktop-only';
            telegramButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.198 2.433a1.3 1.3 0 0 0-1.394-.12L2.304 9.585a1.4 1.4 0 0 0 .096 2.64l3.93 1.434 1.47 4.722c.22.704 1.177.85 1.654.252l2.13-2.67 4.263 3.155a1.3 1.3 0 0 0 2.092-.934L21.334 3.684a1.3 1.3 0 0 0-.136-1.25Z"></path>
                    <path d="M11.44 14.435 9.9 15.98"></path>
                </svg>
                📈 Subscribe to Telegram
            `;

            telegramButton.title = 'Click to subscribe to daily 7 AM conviction trades on Telegram';

            // Add click tracking
            telegramButton.onclick = function(e) {
                // Track the click for analytics
                if (window.gtag) {
                    window.gtag('event', 'telegram_subscribe_click', {
                        'event_category': 'engagement',
                        'event_label': 'homepage_button'
                    });
                }
            };
            
            // Insert the button before the target container
            targetContainer.parentNode.insertBefore(telegramButton, targetContainer);
            
            // Also add to mobile navigation drawer
            addTelegramButtonToMobileNav();
        }, 1000); // Wait 1 second for page to fully load
    }
    
    // Add telegram subscription button to mobile navigation drawer
    function addTelegramButtonToMobileNav() {
        const mobileDrawer = document.querySelector('.mobile-nav-drawer .drawer-nav-links');
        if (!mobileDrawer) return;
        
        // Check if mobile telegram button already exists
        if (mobileDrawer.querySelector('.telegram-mobile-link')) return;
        
        const mobileTelegramLink = document.createElement('a');
        mobileTelegramLink.href = '/telegram-subscribe.html';
        mobileTelegramLink.className = 'drawer-nav-link telegram-mobile-link';
        mobileTelegramLink.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.198 2.433a1.3 1.3 0 0 0-1.394-.12L2.304 9.585a1.4 1.4 0 0 0 .096 2.64l3.93 1.434 1.47 4.722c.22.704 1.177.85 1.654.252l2.13-2.67 4.263 3.155a1.3 1.3 0 0 0 2.092-.934L21.334 3.684a1.3 1.3 0 0 0-.136-1.25Z"></path>
                <path d="M11.44 14.435 9.9 15.98"></path>
            </svg>
            <span>📈 Subscribe to Telegram</span>
        `;

        // Add click tracking for mobile
        mobileTelegramLink.onclick = function(e) {
            if (window.gtag) {
                window.gtag('event', 'telegram_subscribe_click', {
                    'event_category': 'engagement',
                    'event_label': 'mobile_menu_button'
                });
            }
            
            // Show user-friendly message for mobile too
            setTimeout(() => {
                if (!document.hidden) {
                    showTelegramInstructions();
                }
            }, 1000);
        };
        
        // Find the first nav link and insert before it
        const firstNavLink = mobileDrawer.querySelector('.drawer-nav-link');
        if (firstNavLink) {
            mobileDrawer.insertBefore(mobileTelegramLink, firstNavLink);
        } else {
            mobileDrawer.appendChild(mobileTelegramLink);
        }
    }
    
    // Show instructions if Telegram isn't installed
    function showTelegramInstructions() {
        // Check if instruction modal already exists
        if (document.getElementById('telegram-instructions-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'telegram-instructions-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
            align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
        `;
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; 
                        text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Join My Telegram for Trading Signals!</h3>
                <p style="color: #666; margin-bottom: 25px; line-height: 1.5;">
                    Get my daily 7 AM conviction trades and high conviction scan results delivered directly to your phone.
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <p style="margin: 0 0 10px 0; font-weight: 500;">📲 How to subscribe:</p>
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        1. Install Telegram app on your phone<br>
                        2. Search for <strong>@MySignalForgeBot</strong><br>
                        3. Send <strong>/start</strong> to subscribe
                    </p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <a href="https://telegram.org/apps" target="_blank" 
                       style="background: #0088cc; color: white; padding: 12px 24px; border-radius: 6px; 
                              text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;">
                        📱 Install Telegram
                    </a>
                    <a href="https://t.me/MySignalForgeBot" target="_blank"
                       style="background: #24A1DE; color: white; padding: 12px 24px; border-radius: 6px; 
                              text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;">
                        🚀 Open Bot
                    </a>
                </div>
                <button onclick="document.getElementById('telegram-instructions-modal').remove()" 
                        style="background: none; border: none; color: #999; margin-top: 20px; 
                               cursor: pointer; text-decoration: underline;">
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
            .telegram-button {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: linear-gradient(135deg, #0088cc 0%, #24A1DE 100%);
                color: white !important;
                border: none;
                text-decoration: none !important;
                font-weight: 500;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 136, 204, 0.2);
            }
            
            .telegram-button:hover {
                background: linear-gradient(135deg, #0077b5 0%, #1f8bc7 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 136, 204, 0.3);
                color: white !important;
                text-decoration: none !important;
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
        const modal = document.getElementById('alerts-modal');
        if (modal) {
            modal.style.display = 'flex';
            loadPreferences(); // Reload preferences when opening
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