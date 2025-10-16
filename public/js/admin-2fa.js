/**
 * Admin 2FA - Two-Factor Authentication
 * Phase 5: Advanced Features
 *
 * Features:
 * - TOTP (Time-based One-Time Password)
 * - QR Code generation for authenticator apps
 * - Backup codes
 * - 2FA enablement/disablement
 * - 2FA verification
 * - Recovery options
 *
 * Dependencies: AdminComponentsV2
 */

const Admin2FA = {
    // State management
    state: {
        is2FAEnabled: false,
        backupCodes: [],
        qrCodeUrl: null,
        secret: null
    },

    /**
     * Initialize 2FA system
     */
    async init() {
        console.log('[2FA] Initializing 2FA system...');

        try {
            await this.check2FAStatus();
            console.log('[2FA] 2FA system initialized');
        } catch (error) {
            console.error('[2FA] Failed to initialize:', error);
        }
    },

    /**
     * Check if 2FA is enabled for current user
     */
    async check2FAStatus() {
        try {
            const response = await fetch('/api/admin/2fa/status');

            if (response.ok) {
                const data = await response.json();
                this.state.is2FAEnabled = data.enabled || false;
            }
        } catch (error) {
            console.error('[2FA] Error checking 2FA status:', error);
        }
    },

    /**
     * Show 2FA setup UI
     * @param {string} containerId - Container element ID
     */
    async show2FASetup(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Check current status
        await this.check2FAStatus();

        if (this.state.is2FAEnabled) {
            this.show2FAManagement(container);
        } else {
            this.show2FAEnablement(container);
        }
    },

    /**
     * Show 2FA enablement flow
     */
    async show2FAEnablement(container) {
        container.innerHTML = `
            <div class="twofa-container">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">🔐 Enable Two-Factor Authentication</h2>
                    </div>
                    <div class="admin-card-body">
                        <div class="twofa-intro">
                            <p>Two-factor authentication adds an extra layer of security to your account.</p>
                            <p>You'll need an authenticator app like:</p>
                            <ul class="authenticator-apps">
                                <li>📱 Google Authenticator</li>
                                <li>📱 Microsoft Authenticator</li>
                                <li>📱 Authy</li>
                                <li>📱 1Password</li>
                            </ul>
                        </div>

                        <div class="twofa-steps">
                            <div class="twofa-step" id="step-1">
                                <div class="step-number">1</div>
                                <div class="step-content">
                                    <h3>Generate Secret Key</h3>
                                    <p>Click the button below to generate your 2FA secret key.</p>
                                    <button class="btn btn-primary" onclick="Admin2FA.generateSecret()">
                                        Generate Secret
                                    </button>
                                </div>
                            </div>

                            <div class="twofa-step" id="step-2" style="display: none;">
                                <div class="step-number">2</div>
                                <div class="step-content">
                                    <h3>Scan QR Code</h3>
                                    <p>Scan this QR code with your authenticator app:</p>
                                    <div class="qr-code-container" id="qr-code-container">
                                        ${AdminComponentsV2.skeleton({ type: 'card', rows: 1 })}
                                    </div>
                                    <div class="manual-entry">
                                        <p>Or enter this key manually:</p>
                                        <div class="secret-key" id="secret-key">
                                            <code></code>
                                            <button class="btn-icon" onclick="Admin2FA.copySecret()" title="Copy">
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="twofa-step" id="step-3" style="display: none;">
                                <div class="step-number">3</div>
                                <div class="step-content">
                                    <h3>Verify Code</h3>
                                    <p>Enter the 6-digit code from your authenticator app:</p>
                                    <form id="verify-2fa-form" onsubmit="Admin2FA.verifyAndEnable(event)">
                                        <div class="form-group">
                                            <input type="text" id="verification-code"
                                                   class="verification-input"
                                                   placeholder="000000"
                                                   maxlength="6"
                                                   pattern="[0-9]{6}"
                                                   required>
                                        </div>
                                        <button type="submit" class="btn btn-primary">
                                            Verify and Enable 2FA
                                        </button>
                                    </form>
                                </div>
                            </div>

                            <div class="twofa-step" id="step-4" style="display: none;">
                                <div class="step-number">4</div>
                                <div class="step-content">
                                    <h3>Save Backup Codes</h3>
                                    <p>Save these backup codes in a secure location. You can use them to access your account if you lose your device.</p>
                                    <div class="backup-codes" id="backup-codes"></div>
                                    <div class="backup-actions">
                                        <button class="btn btn-secondary" onclick="Admin2FA.downloadBackupCodes()">
                                            📥 Download Codes
                                        </button>
                                        <button class="btn btn-primary" onclick="Admin2FA.finishSetup()">
                                            I've Saved My Codes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Show 2FA management (when already enabled)
     */
    show2FAManagement(container) {
        container.innerHTML = `
            <div class="twofa-container">
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">🔐 Two-Factor Authentication</h2>
                        <span class="status-badge status-success">✓ Enabled</span>
                    </div>
                    <div class="admin-card-body">
                        <div class="twofa-status">
                            <p>Two-factor authentication is currently enabled for your account.</p>
                        </div>

                        <div class="twofa-actions">
                            <button class="btn btn-secondary" onclick="Admin2FA.regenerateBackupCodes()">
                                🔄 Regenerate Backup Codes
                            </button>
                            <button class="btn btn-danger" onclick="Admin2FA.disable2FA()">
                                ⚠️ Disable 2FA
                            </button>
                        </div>

                        <div class="twofa-info">
                            <h3>What is 2FA?</h3>
                            <p>Two-factor authentication provides an additional layer of security by requiring both your password and a verification code from your authenticator app.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generate 2FA secret
     */
    async generateSecret() {
        try {
            const response = await fetch('/api/admin/2fa/generate', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to generate secret');
            }

            const data = await response.json();
            this.state.secret = data.secret;
            this.state.qrCodeUrl = data.qrCodeUrl;

            // Show QR code
            this.displayQRCode(data.qrCodeUrl, data.secret);

            // Hide step 1, show step 2 and 3
            document.getElementById('step-1').style.display = 'none';
            document.getElementById('step-2').style.display = 'block';
            document.getElementById('step-3').style.display = 'block';

            AdminComponentsV2.toast({
                type: 'success',
                message: '2FA secret generated successfully'
            });
        } catch (error) {
            console.error('[2FA] Error generating secret:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to generate secret: ${error.message}`
            });
        }
    },

    /**
     * Display QR code
     */
    displayQRCode(qrCodeUrl, secret) {
        const qrContainer = document.getElementById('qr-code-container');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <img src="${qrCodeUrl}" alt="QR Code" class="qr-code-image">
            `;
        }

        const secretKey = document.querySelector('#secret-key code');
        if (secretKey) {
            secretKey.textContent = secret;
        }
    },

    /**
     * Copy secret to clipboard
     */
    copySecret() {
        const secretKey = document.querySelector('#secret-key code');
        if (!secretKey) return;

        navigator.clipboard.writeText(secretKey.textContent).then(() => {
            AdminComponentsV2.toast({
                type: 'success',
                message: 'Secret key copied to clipboard',
                duration: 2000
            });
        });
    },

    /**
     * Verify and enable 2FA
     */
    async verifyAndEnable(event) {
        event.preventDefault();

        const code = document.getElementById('verification-code').value;

        try {
            const response = await fetch('/api/admin/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: this.state.secret,
                    code
                })
            });

            if (!response.ok) {
                throw new Error('Invalid verification code');
            }

            const data = await response.json();
            this.state.backupCodes = data.backupCodes || [];
            this.state.is2FAEnabled = true;

            // Show backup codes
            this.displayBackupCodes(data.backupCodes);

            // Hide step 3, show step 4
            document.getElementById('step-3').style.display = 'none';
            document.getElementById('step-4').style.display = 'block';

            AdminComponentsV2.toast({
                type: 'success',
                message: '2FA enabled successfully!'
            });
        } catch (error) {
            console.error('[2FA] Error enabling 2FA:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: error.message || 'Failed to verify code'
            });
        }
    },

    /**
     * Display backup codes
     */
    displayBackupCodes(codes) {
        const backupCodesContainer = document.getElementById('backup-codes');
        if (!backupCodesContainer) return;

        backupCodesContainer.innerHTML = `
            <div class="backup-codes-grid">
                ${codes.map(code => `
                    <div class="backup-code">
                        <code>${code}</code>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Download backup codes as text file
     */
    downloadBackupCodes() {
        const codes = this.state.backupCodes.join('\n');
        const blob = new Blob([
            'SutrAlgo Admin Portal - 2FA Backup Codes\n',
            '==========================================\n\n',
            'Keep these codes in a safe place.\n',
            'Each code can only be used once.\n\n',
            codes
        ], { type: 'text/plain' });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sutralgo-2fa-backup-codes-${Date.now()}.txt`;
        link.click();
        window.URL.revokeObjectURL(url);

        AdminComponentsV2.toast({
            type: 'success',
            message: 'Backup codes downloaded'
        });
    },

    /**
     * Finish 2FA setup
     */
    finishSetup() {
        AdminComponentsV2.toast({
            type: 'success',
            message: '2FA setup completed successfully!',
            duration: 3000
        });

        // Refresh the page or redirect
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    },

    /**
     * Regenerate backup codes
     */
    async regenerateBackupCodes() {
        const confirmed = await AdminComponentsV2.confirm({
            title: 'Regenerate Backup Codes',
            message: 'This will invalidate your existing backup codes. Are you sure?',
            danger: true
        });

        if (!confirmed) return;

        try {
            const response = await fetch('/api/admin/2fa/regenerate-codes', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to regenerate codes');
            }

            const data = await response.json();
            this.state.backupCodes = data.backupCodes;

            // Show codes in a modal
            const modal = AdminComponentsV2.modal({
                title: 'New Backup Codes',
                content: `
                    <div class="backup-codes-modal">
                        <p>Save these new backup codes in a secure location:</p>
                        <div class="backup-codes-grid">
                            ${data.backupCodes.map(code => `
                                <div class="backup-code">
                                    <code>${code}</code>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary" onclick="Admin2FA.downloadBackupCodes()">
                            📥 Download Codes
                        </button>
                    </div>
                `,
                size: 'medium'
            });

            modal.show();

            AdminComponentsV2.toast({
                type: 'success',
                message: 'Backup codes regenerated'
            });
        } catch (error) {
            console.error('[2FA] Error regenerating codes:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to regenerate codes: ${error.message}`
            });
        }
    },

    /**
     * Disable 2FA
     */
    async disable2FA() {
        const confirmed = await AdminComponentsV2.confirm({
            title: 'Disable Two-Factor Authentication',
            message: 'Are you sure you want to disable 2FA? Your account will be less secure.',
            danger: true
        });

        if (!confirmed) return;

        // Ask for verification code
        const modal = AdminComponentsV2.modal({
            title: 'Verify to Disable 2FA',
            content: `
                <form id="disable-2fa-form">
                    <p>Enter your current 2FA code to disable two-factor authentication:</p>
                    <div class="form-group">
                        <input type="text" id="disable-verification-code"
                               class="verification-input"
                               placeholder="000000"
                               maxlength="6"
                               pattern="[0-9]{6}"
                               required>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Disable 2FA',
                    variant: 'danger',
                    onClick: async () => {
                        const code = document.getElementById('disable-verification-code').value;
                        await this.confirmDisable2FA(code, modal);
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Confirm disable 2FA
     */
    async confirmDisable2FA(code, modal) {
        try {
            const response = await fetch('/api/admin/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                throw new Error('Invalid verification code');
            }

            this.state.is2FAEnabled = false;

            AdminComponentsV2.toast({
                type: 'success',
                message: '2FA disabled successfully'
            });

            modal.close();

            // Refresh the page
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error('[2FA] Error disabling 2FA:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: error.message || 'Failed to disable 2FA'
            });
        }
    },

    /**
     * Verify 2FA code (for login)
     */
    async verify2FACode(code) {
        try {
            const response = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                throw new Error('Invalid code');
            }

            return true;
        } catch (error) {
            console.error('[2FA] Error verifying code:', error);
            return false;
        }
    }
};

// Make available globally
window.Admin2FA = Admin2FA;
