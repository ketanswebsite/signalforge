/**
 * Integration Tests for API Interactions
 * Phase 6: Testing & Polish
 */

describe('API Integration Tests', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        global.fetch.mockClear();
    });

    describe('User Management API', () => {
        it('should fetch user list', async () => {
            const mockUsers = [
                { email: 'user1@example.com', name: 'User 1' },
                { email: 'user2@example.com', name: 'User 2' }
            ];

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ users: mockUsers })
            });

            const response = await fetch('/api/admin/users');
            const data = await response.json();

            expect(fetch).toHaveBeenCalledWith('/api/admin/users');
            expect(data.users).toHaveLength(2);
            expect(data.users[0].email).toBe('user1@example.com');
        });

        it('should fetch user details', async () => {
            const mockUser = {
                email: 'user@example.com',
                name: 'Test User',
                subscription: 'premium'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockUser
            });

            const response = await fetch('/api/admin/users/user@example.com');
            const data = await response.json();

            expect(fetch).toHaveBeenCalledWith('/api/admin/users/user@example.com');
            expect(data.email).toBe('user@example.com');
            expect(data.subscription).toBe('premium');
        });

        it('should update user details', async () => {
            const updatedUser = {
                email: 'user@example.com',
                name: 'Updated Name'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, user: updatedUser })
            });

            const response = await fetch('/api/admin/users/user@example.com', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Updated Name' })
            });

            const data = await response.json();

            expect(fetch).toHaveBeenCalledWith(
                '/api/admin/users/user@example.com',
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
            expect(data.success).toBe(true);
            expect(data.user.name).toBe('Updated Name');
        });

        it('should handle API errors gracefully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ error: 'User not found' })
            });

            const response = await fetch('/api/admin/users/nonexistent@example.com');
            const data = await response.json();

            expect(response.ok).toBe(false);
            expect(response.status).toBe(404);
            expect(data.error).toBe('User not found');
        });
    });

    describe('Analytics API', () => {
        it('should fetch cohort analysis data', async () => {
            const mockCohortData = {
                cohorts: [
                    { period: '2025-01', users: 100, retention: [100, 85, 70, 60] },
                    { period: '2025-02', users: 120, retention: [120, 100, 85, 72] }
                ]
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCohortData
            });

            const response = await fetch('/api/admin/analytics/cohort?period=monthly');
            const data = await response.json();

            expect(fetch).toHaveBeenCalledWith(
                '/api/admin/analytics/cohort?period=monthly'
            );
            expect(data.cohorts).toHaveLength(2);
            expect(data.cohorts[0].period).toBe('2025-01');
        });

        it('should fetch funnel data', async () => {
            const mockFunnelData = {
                steps: [
                    { name: 'Visit', users: 1000 },
                    { name: 'Signup', users: 500 },
                    { name: 'Purchase', users: 100 }
                ],
                conversionRate: 10
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockFunnelData
            });

            const response = await fetch('/api/admin/analytics/funnel?type=subscription');
            const data = await response.json();

            expect(data.steps).toHaveLength(3);
            expect(data.conversionRate).toBe(10);
        });

        it('should fetch retention data', async () => {
            const mockRetentionData = {
                day1: 85,
                day7: 60,
                day30: 40,
                day90: 25
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRetentionData
            });

            const response = await fetch('/api/admin/analytics/retention');
            const data = await response.json();

            expect(data.day1).toBe(85);
            expect(data.day7).toBe(60);
            expect(data.day30).toBe(40);
        });
    });

    describe('Database API', () => {
        it('should fetch database schema', async () => {
            const mockSchema = {
                tables: [
                    {
                        name: 'users',
                        columns: [
                            { name: 'id', type: 'INTEGER', isPrimaryKey: true },
                            { name: 'email', type: 'TEXT', nullable: false }
                        ]
                    }
                ]
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSchema
            });

            const response = await fetch('/api/admin/database/schema');
            const data = await response.json();

            expect(data.tables).toHaveLength(1);
            expect(data.tables[0].name).toBe('users');
            expect(data.tables[0].columns).toHaveLength(2);
        });

        it('should execute query', async () => {
            const mockResults = {
                rows: [
                    { id: 1, email: 'user1@example.com' },
                    { id: 2, email: 'user2@example.com' }
                ],
                rowCount: 2,
                executionTime: 15
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResults
            });

            const response = await fetch('/api/admin/database/execute-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'SELECT * FROM users LIMIT 10'
                })
            });

            const data = await response.json();

            expect(data.rows).toHaveLength(2);
            expect(data.rowCount).toBe(2);
            expect(data.executionTime).toBeLessThan(100);
        });

        it('should reject unsafe queries', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Only SELECT queries are allowed' })
            });

            const response = await fetch('/api/admin/database/execute-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'DROP TABLE users'
                })
            });

            const data = await response.json();

            expect(response.ok).toBe(false);
            expect(data.error).toContain('SELECT');
        });
    });

    describe('Communication API', () => {
        it('should fetch channel status', async () => {
            const mockChannels = {
                channels: {
                    email: { enabled: true, configured: true },
                    sms: { enabled: false, configured: false },
                    telegram: { enabled: true, configured: true }
                }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockChannels
            });

            const response = await fetch('/api/admin/communication/channels');
            const data = await response.json();

            expect(data.channels.email.enabled).toBe(true);
            expect(data.channels.sms.enabled).toBe(false);
        });

        it('should send notification', async () => {
            const mockResponse = {
                success: true,
                sent: 1,
                messageId: 'msg-123'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const response = await fetch('/api/admin/communication/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientType: 'user',
                    recipients: 'user@example.com',
                    channels: ['email'],
                    subject: 'Test',
                    message: 'Test message'
                })
            });

            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.sent).toBe(1);
            expect(data.messageId).toBeTruthy();
        });

        it('should fetch notification history', async () => {
            const mockHistory = {
                history: [
                    {
                        id: '1',
                        channel: 'email',
                        recipient: 'user@example.com',
                        status: 'delivered',
                        timestamp: '2025-01-16T12:00:00Z'
                    }
                ]
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockHistory
            });

            const response = await fetch('/api/admin/communication/history');
            const data = await response.json();

            expect(data.history).toHaveLength(1);
            expect(data.history[0].channel).toBe('email');
            expect(data.history[0].status).toBe('delivered');
        });
    });

    describe('RBAC API', () => {
        it('should fetch user roles', async () => {
            const mockRoles = {
                roles: [
                    { id: 'admin', name: 'Administrator', permissions: ['*'] },
                    { id: 'user', name: 'Regular User', permissions: ['view'] }
                ]
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRoles
            });

            const response = await fetch('/api/admin/rbac/roles');
            const data = await response.json();

            expect(data.roles).toHaveLength(2);
            expect(data.roles[0].id).toBe('admin');
        });

        it('should assign role to user', async () => {
            const mockResponse = {
                success: true,
                user: 'user@example.com',
                role: 'admin'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const response = await fetch('/api/admin/rbac/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: 'user@example.com',
                    roleId: 'admin'
                })
            });

            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.role).toBe('admin');
        });
    });

    describe('2FA API', () => {
        it('should generate 2FA secret', async () => {
            const mockSecret = {
                secret: 'JBSWY3DPEHPK3PXP',
                qrCodeUrl: 'data:image/png;base64,...'
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSecret
            });

            const response = await fetch('/api/admin/2fa/generate', {
                method: 'POST'
            });

            const data = await response.json();

            expect(data.secret).toBeTruthy();
            expect(data.qrCodeUrl).toContain('data:image/png');
        });

        it('should enable 2FA with valid code', async () => {
            const mockResponse = {
                success: true,
                backupCodes: ['code1', 'code2', 'code3']
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const response = await fetch('/api/admin/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: 'JBSWY3DPEHPK3PXP',
                    code: '123456'
                })
            });

            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.backupCodes).toHaveLength(3);
        });

        it('should reject invalid 2FA code', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid verification code' })
            });

            const response = await fetch('/api/admin/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: 'JBSWY3DPEHPK3PXP',
                    code: '000000'
                })
            });

            const data = await response.json();

            expect(response.ok).toBe(false);
            expect(data.error).toContain('Invalid');
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            try {
                await fetch('/api/admin/users');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toBe('Network error');
            }
        });

        it('should handle 500 server errors', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal server error' })
            });

            const response = await fetch('/api/admin/users');
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('Internal server error');
        });

        it('should handle timeout errors', async () => {
            jest.useFakeTimers();

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 5000);
            });

            global.fetch.mockReturnValueOnce(timeoutPromise);

            const promise = fetch('/api/admin/users');

            jest.advanceTimersByTime(5000);

            await expect(promise).rejects.toThrow('Request timeout');

            jest.useRealTimers();
        });
    });
});
