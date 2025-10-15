/**
 * Settings Manager
 * Handles user preferences and system configuration
 */

const db = require('../../database-postgres');

class SettingsManager {

    /**
     * Get user setting
     */
    static async getSetting(userId, key, defaultValue = null) {
        try {
            const result = await db.getUserSetting(userId, key);
            return result ? result.setting_value : defaultValue;
        } catch (error) {
            console.error('Error getting setting:', error);
            return defaultValue;
        }
    }

    /**
     * Get all user settings
     */
    static async getAllSettings(userId) {
        try {
            const settings = await db.getAllUserSettings(userId);

            // Convert to key-value object
            const settingsObj = {};
            settings.forEach(setting => {
                settingsObj[setting.setting_key] = setting.setting_value;
            });

            return settingsObj;
        } catch (error) {
            console.error('Error getting all settings:', error);
            return {};
        }
    }

    /**
     * Update setting
     */
    static async updateSetting(userId, key, value) {
        try {
            await db.updateUserSetting(userId, key, value);
            return true;
        } catch (error) {
            console.error('Error updating setting:', error);
            return false;
        }
    }

    /**
     * Update multiple settings
     */
    static async updateSettings(userId, settings) {
        try {
            const promises = Object.entries(settings).map(([key, value]) =>
                db.updateUserSetting(userId, key, value)
            );

            await Promise.all(promises);
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }

    /**
     * Reset to default settings
     */
    static async resetToDefaults(userId) {
        const defaults = {
            'default_stop_loss_percent': '5',
            'default_target_percent': '8',
            'max_positions_total': '30',
            'max_positions_per_market': '10',
            'telegram_alerts_enabled': 'true',
            'telegram_alert_types': 'target,stoploss,manual,conviction',
            'auto_add_signals': 'false',
            'min_dti_threshold': '-40',
            'initial_capital_india': '500000',
            'initial_capital_uk': '4000',
            'initial_capital_us': '5000'
        };

        return await this.updateSettings(userId, defaults);
    }

    /**
     * Validate setting value
     */
    static validateSetting(key, value) {
        switch (key) {
            case 'default_stop_loss_percent':
            case 'default_target_percent':
                const percent = parseFloat(value);
                return percent > 0 && percent <= 20;

            case 'max_positions_total':
                const total = parseInt(value);
                return total > 0 && total <= 50;

            case 'max_positions_per_market':
                const perMarket = parseInt(value);
                return perMarket > 0 && perMarket <= 20;

            case 'min_dti_threshold':
                const dti = parseFloat(value);
                return dti >= -100 && dti <= 0;

            case 'telegram_alerts_enabled':
            case 'auto_add_signals':
                return value === 'true' || value === 'false';

            case 'initial_capital_india':
            case 'initial_capital_uk':
            case 'initial_capital_us':
                const capital = parseFloat(value);
                return capital >= 0;

            default:
                return true;
        }
    }
}

module.exports = SettingsManager;
