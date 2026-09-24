/**
 * Admin Settings Module
 * What this server runs with (read-only: Render's environment sets it) and the three actions that
 * work: a Telegram test message to the admin's own chat, a web push broadcast, and clearing the AI
 * verdicts held in memory. Until 2026-09-24 this tab was seven pages of forms that saved nothing:
 * buttons answered success without doing anything (save all, the Telegram test, the email template,
 * the feature flags, the broadcast, maintenance mode and four cache buttons), and the rest promised
 * features that were never built.
 */

const AdminSettings = {
    /**
     * Initialize the settings module
     */
    async init() {
        const container = document.getElementById('settings-page');
        container.replaceChildren(
            this.section('Configuration', 'settings-config'),
            this.section('Telegram', 'settings-telegram'),
            this.section('Web Push Broadcast', 'settings-broadcast'),
            this.section('Memory Cache', 'settings-cache')
        );
        this.renderBroadcast();
        this.renderCache();
        await Promise.all([this.loadConfiguration(), this.loadTelegram()]);
    },

    /**
     * A card whose body holds one element with this id
     */
    section(heading, bodyId) {
        const body = document.createElement('div');
        body.id = bodyId;
        body.appendChild(AdminComponents.noteEl('Loading...'));
        return AdminComponents.cardEl(heading, body);
    },

    /**
     * POST and read the answer. The admin router answers { error: { message } }, server.js { error }.
     */
    async send(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            // not JSON: the status below says what happened
        }
        if (!response.ok || data.success === false) {
            const reason = typeof data.error === 'string' ? data.error : (data.error && data.error.message);
            throw new Error(reason || `The server answered ${response.status}`);
        }
        return data;
    },

    /**
     * A button that runs an action and shows the server's answer beside it
     */
    actionButton(label, className, action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn ${className}`;
        button.textContent = label;
        const result = document.createElement('p');
        result.className = 'text-muted mt-1';
        button.addEventListener('click', async () => {
            button.disabled = true;
            result.textContent = 'Working...';
            try {
                result.textContent = await action();
            } catch (error) {
                result.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
        return [button, result];
    },

    /**
     * What this server is configured with
     */
    async loadConfiguration() {
        const target = document.getElementById('settings-config');
        let config;
        try {
            config = (await ApiClient.get('/api/admin/settings/general')).data;
        } catch (error) {
            target.replaceChildren(AdminComponents.noteEl(`The configuration could not be read: ${error.message}`));
            return;
        }

        const set = value => (value ? 'Set' : 'Not set');
        target.replaceChildren(
            AdminComponents.tableEl(['Setting', 'Value'], [
                ['Environment', config.environment],
                ['Automatic trading', config.autoExecute
                    ? 'On: the 1 PM executor books the day\'s signals'
                    : 'Off (observation mode): nothing is booked'],
                ['Telegram bot', set(config.integrations.telegramBot)],
                ['Web push', set(config.integrations.webPush)],
                ['Stripe payments', set(config.integrations.stripe)],
                ['Stripe webhook', set(config.integrations.stripeWebhook)],
                ['AI conviction', set(config.integrations.gemini)]
            ]),
            AdminComponents.noteEl('These come from the Render environment (AUTO_EXECUTE, TELEGRAM_BOT_TOKEN, VAPID_PUBLIC_KEY and ' +
                'VAPID_PRIVATE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GEMINI_API_KEY). This page shows them and cannot change them.')
        );
    },

    /**
     * Telegram: the bot, the admin's own chat, and a test message to that chat
     */
    async loadTelegram() {
        const target = document.getElementById('settings-telegram');
        let telegram;
        try {
            telegram = (await ApiClient.get('/api/admin/settings/telegram')).data;
        } catch (error) {
            target.replaceChildren(AdminComponents.noteEl(`The Telegram status could not be read: ${error.message}`));
            return;
        }

        const [button, result] = this.actionButton('Send me a test message', 'btn-primary', async () =>
            (await this.send('/api/admin/settings/telegram/test')).message);
        target.replaceChildren(
            AdminComponents.tableEl(['What', 'Status'], [
                ['Bot', telegram.botConfigured ? 'Configured' : 'Not configured: TELEGRAM_BOT_TOKEN is not set'],
                ['Your chat', telegram.ownChatLinked ? 'Linked' : 'Not linked: link it from the Account page']
            ]),
            AdminComponents.noteEl('The test message goes to your own linked chat, never to subscribers.'),
            button,
            result
        );
    },

    /**
     * A web push notification to every subscribed browser (POST /api/admin/push/broadcast)
     */
    renderBroadcast() {
        const target = document.getElementById('settings-broadcast');
        const field = (label, control) => {
            const group = document.createElement('div');
            group.className = 'form-group';
            const labelEl = document.createElement('label');
            labelEl.htmlFor = control.id;
            labelEl.textContent = label;
            group.append(labelEl, control);
            return group;
        };

        const title = document.createElement('input');
        title.type = 'text';
        title.id = 'broadcast-title';
        title.className = 'form-control';
        title.maxLength = 100;

        const message = document.createElement('textarea');
        message.id = 'broadcast-message';
        message.className = 'form-control';
        message.rows = 4;
        message.maxLength = 500;

        const link = document.createElement('input');
        link.type = 'text';
        link.id = 'broadcast-url';
        link.className = 'form-control';
        link.placeholder = '/account.html';

        const [button, result] = this.actionButton('Send to every subscribed browser', 'btn-primary', async () => {
            if (!confirm('Send this notification to every browser that turned on notifications?')) {
                return 'Not sent.';
            }
            const answer = await this.send('/api/admin/push/broadcast', {
                title: title.value,
                body: message.value,
                url: link.value.trim()
            });
            title.value = '';
            message.value = '';
            link.value = '';
            return answer.message;
        });

        target.replaceChildren(
            AdminComponents.noteEl('A notification to every browser that turned on notifications in the app. Telegram subscribers do not get it.'),
            field('Title', title),
            field('Message', message),
            field('Opens this page of the site when clicked (optional)', link),
            button,
            result
        );
    },

    /**
     * The AI verdicts held in memory (POST /api/admin/settings/clear-cache)
     */
    renderCache() {
        const target = document.getElementById('settings-cache');
        const [button, result] = this.actionButton('Clear the AI verdicts held in memory', 'btn-secondary', async () =>
            (await this.send('/api/admin/settings/clear-cache', { type: 'conviction' })).message);
        target.replaceChildren(
            AdminComponents.noteEl('Once read, an AI verdict stays in the server\'s memory until midnight UTC (or for ' +
                'CONVICTION_CACHE_TTL_MIN minutes when that is set). Clearing makes the next read of each symbol go to the database.'),
            button,
            result
        );
    }
};
