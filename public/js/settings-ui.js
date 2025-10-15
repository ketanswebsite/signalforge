/**
 * Settings UI Module
 * User interface for managing preferences
 */

const SettingsUI = (function() {

    let currentSettings = {};

    /**
     * Initialize settings page
     */
    async function initializeSettings() {
        try {
            // Load current settings
            currentSettings = await loadSettings();

            // Populate form
            populateSettingsForm(currentSettings);

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    }

    /**
     * Load settings from API
     */
    async function loadSettings() {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to load settings');
        return await response.json();
    }

    /**
     * Populate settings form
     */
    function populateSettingsForm(settings) {
        // Trading parameters
        document.getElementById('stop-loss-percent').value =
            settings.default_stop_loss_percent || '5';
        document.getElementById('target-percent').value =
            settings.default_target_percent || '8';
        document.getElementById('max-positions-total').value =
            settings.max_positions_total || '30';
        document.getElementById('max-positions-per-market').value =
            settings.max_positions_per_market || '10';
        document.getElementById('min-dti-threshold').value =
            settings.min_dti_threshold || '-40';

        // Telegram settings
        document.getElementById('telegram-enabled').checked =
            settings.telegram_alerts_enabled === 'true';

        const alertTypes = settings.telegram_alert_types?.split(',') || [];
        document.getElementById('alert-target').checked = alertTypes.includes('target');
        document.getElementById('alert-stoploss').checked = alertTypes.includes('stoploss');
        document.getElementById('alert-manual').checked = alertTypes.includes('manual');
        document.getElementById('alert-conviction').checked = alertTypes.includes('conviction');

        // Auto-add signals
        document.getElementById('auto-add-signals').checked =
            settings.auto_add_signals === 'true';

        // Initial capital
        document.getElementById('capital-india').value =
            settings.initial_capital_india || '500000';
        document.getElementById('capital-uk').value =
            settings.initial_capital_uk || '4000';
        document.getElementById('capital-us').value =
            settings.initial_capital_us || '5000';
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Save settings button
        document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);

        // Reset to defaults button
        document.getElementById('reset-defaults-btn')?.addEventListener('click', resetToDefaults);

        // Real-time validation
        document.querySelectorAll('.settings-input').forEach(input => {
            input.addEventListener('change', validateInput);
        });
    }

    /**
     * Validate input
     */
    function validateInput(event) {
        const input = event.target;
        const value = input.value;
        const key = input.dataset.settingKey;

        // Basic validation based on input type
        if (input.type === 'number') {
            const num = parseFloat(value);
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);

            if (num < min || num > max) {
                input.classList.add('invalid');
                return false;
            }
        }

        input.classList.remove('invalid');
        return true;
    }

    /**
     * Save settings
     */
    async function saveSettings() {
        try {
            // Gather all settings
            const settings = {
                default_stop_loss_percent: document.getElementById('stop-loss-percent').value,
                default_target_percent: document.getElementById('target-percent').value,
                max_positions_total: document.getElementById('max-positions-total').value,
                max_positions_per_market: document.getElementById('max-positions-per-market').value,
                min_dti_threshold: document.getElementById('min-dti-threshold').value,
                telegram_alerts_enabled: document.getElementById('telegram-enabled').checked.toString(),
                auto_add_signals: document.getElementById('auto-add-signals').checked.toString(),
                initial_capital_india: document.getElementById('capital-india').value,
                initial_capital_uk: document.getElementById('capital-uk').value,
                initial_capital_us: document.getElementById('capital-us').value
            };

            // Get selected alert types
            const alertTypes = [];
            if (document.getElementById('alert-target').checked) alertTypes.push('target');
            if (document.getElementById('alert-stoploss').checked) alertTypes.push('stoploss');
            if (document.getElementById('alert-manual').checked) alertTypes.push('manual');
            if (document.getElementById('alert-conviction').checked) alertTypes.push('conviction');
            settings.telegram_alert_types = alertTypes.join(',');

            // Save to API
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (!response.ok) throw new Error('Failed to save settings');

            // Show success message
            showNotification('Settings saved successfully', 'success');

            // Update current settings
            currentSettings = settings;

        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Failed to save settings', 'error');
        }
    }

    /**
     * Reset to defaults
     */
    async function resetToDefaults() {
        if (!confirm('Reset all settings to defaults?')) return;

        try {
            const response = await fetch('/api/settings/reset', {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to reset settings');

            // Reload settings
            const settings = await loadSettings();
            populateSettingsForm(settings);

            showNotification('Settings reset to defaults', 'success');

        } catch (error) {
            console.error('Error resetting settings:', error);
            showNotification('Failed to reset settings', 'error');
        }
    }

    /**
     * Show notification
     */
    function showNotification(message, type) {
        // Use existing notification system if available
        if (typeof showNotification !== 'undefined') {
            window.showNotification(message, type);
            return;
        }

        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    // Public API
    return {
        initializeSettings,
        loadSettings,
        saveSettings
    };
})();

window.SettingsUI = SettingsUI;
