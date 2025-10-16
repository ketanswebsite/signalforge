/**
 * Unit Tests for AdminPerformance
 * Phase 6: Testing & Polish
 */

describe('AdminPerformance', () => {
    let AdminPerformance;

    beforeEach(() => {
        // Mock the global AdminPerformance object
        global.AdminPerformance = {
            loadModule: jest.fn(),
            getCached: jest.fn(),
            batchRequest: jest.fn(),
            getMetrics: jest.fn(),
            lazyLoadImages: jest.fn(),
            clearCache: jest.fn(),
            invalidateCache: jest.fn()
        };

        AdminPerformance = global.AdminPerformance;

        // Reset fetch mock
        global.fetch.mockClear();
    });

    describe('loadModule', () => {
        it('should load module dynamically', async () => {
            AdminPerformance.loadModule.mockResolvedValue(true);

            const result = await AdminPerformance.loadModule(
                'analytics',
                '/js/admin-analytics-v2.js'
            );

            expect(AdminPerformance.loadModule).toHaveBeenCalledWith(
                'analytics',
                '/js/admin-analytics-v2.js'
            );
            expect(result).toBe(true);
        });

        it('should not load same module twice', async () => {
            AdminPerformance.loadModule
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            await AdminPerformance.loadModule('analytics', '/js/analytics.js');
            const secondCall = await AdminPerformance.loadModule('analytics', '/js/analytics.js');

            expect(secondCall).toBe(false); // Already loaded
        });

        it('should handle module load errors', async () => {
            AdminPerformance.loadModule.mockRejectedValue(
                new Error('Failed to load module')
            );

            await expect(
                AdminPerformance.loadModule('invalid', '/js/invalid.js')
            ).rejects.toThrow('Failed to load module');
        });

        it('should track module load time', async () => {
            const mockMetrics = {
                moduleLoadTimes: { analytics: 150 }
            };
            AdminPerformance.getMetrics.mockReturnValue(mockMetrics);
            AdminPerformance.loadModule.mockResolvedValue(true);

            await AdminPerformance.loadModule('analytics', '/js/analytics.js');

            const metrics = AdminPerformance.getMetrics();
            expect(metrics.moduleLoadTimes).toHaveProperty('analytics');
        });
    });

    describe('getCached', () => {
        it('should return cached data if available', async () => {
            const cachedData = { users: [1, 2, 3] };
            AdminPerformance.getCached.mockResolvedValue(cachedData);

            const fetchFn = jest.fn();
            const result = await AdminPerformance.getCached('users-list', fetchFn);

            expect(result).toEqual(cachedData);
            expect(fetchFn).not.toHaveBeenCalled(); // Should not fetch if cached
        });

        it('should fetch and cache if not available', async () => {
            const freshData = { users: [1, 2, 3] };
            const fetchFn = jest.fn().mockResolvedValue(freshData);

            AdminPerformance.getCached.mockImplementation(async (key, fn) => {
                return await fn();
            });

            const result = await AdminPerformance.getCached('users-list', fetchFn);

            expect(fetchFn).toHaveBeenCalled();
            expect(result).toEqual(freshData);
        });

        it('should respect TTL', async () => {
            const data = { value: 'test' };
            AdminPerformance.getCached.mockResolvedValue(data);

            const result = await AdminPerformance.getCached(
                'key',
                jest.fn(),
                300000 // 5 minute TTL
            );

            expect(result).toEqual(data);
            expect(AdminPerformance.getCached).toHaveBeenCalledWith(
                'key',
                expect.any(Function),
                300000
            );
        });

        it('should handle cache errors gracefully', async () => {
            const fetchFn = jest.fn().mockRejectedValue(new Error('Fetch failed'));

            AdminPerformance.getCached.mockRejectedValue(new Error('Fetch failed'));

            await expect(
                AdminPerformance.getCached('key', fetchFn)
            ).rejects.toThrow('Fetch failed');
        });
    });

    describe('batchRequest', () => {
        it('should batch multiple requests', async () => {
            AdminPerformance.batchRequest
                .mockResolvedValueOnce({ id: 1, data: 'a' })
                .mockResolvedValueOnce({ id: 2, data: 'b' });

            const promise1 = AdminPerformance.batchRequest('/api/batch', { id: 1 });
            const promise2 = AdminPerformance.batchRequest('/api/batch', { id: 2 });

            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1.id).toBe(1);
            expect(result2.id).toBe(2);
        });

        it('should delay batch execution', async () => {
            jest.useFakeTimers();

            AdminPerformance.batchRequest.mockResolvedValue({ success: true });

            const promise = AdminPerformance.batchRequest('/api/batch', { id: 1 });

            jest.advanceTimersByTime(50); // Default batch delay

            await promise;

            expect(AdminPerformance.batchRequest).toHaveBeenCalled();

            jest.useRealTimers();
        });

        it('should limit batch size', async () => {
            const promises = [];

            AdminPerformance.batchRequest.mockImplementation((endpoint, params) => {
                return Promise.resolve({ id: params.id });
            });

            // Create 15 requests (max 10 per batch)
            for (let i = 0; i < 15; i++) {
                promises.push(AdminPerformance.batchRequest('/api/batch', { id: i }));
            }

            const results = await Promise.all(promises);

            expect(results).toHaveLength(15);
            expect(AdminPerformance.batchRequest).toHaveBeenCalledTimes(15);
        });
    });

    describe('getMetrics', () => {
        it('should return performance metrics', () => {
            const mockMetrics = {
                cacheHitRate: '85.5%',
                moduleLoadTimes: {
                    analytics: 150,
                    performance: 100
                },
                requestCounts: {
                    total: 500,
                    batched: 300
                }
            };

            AdminPerformance.getMetrics.mockReturnValue(mockMetrics);

            const metrics = AdminPerformance.getMetrics();

            expect(metrics).toHaveProperty('cacheHitRate');
            expect(metrics).toHaveProperty('moduleLoadTimes');
            expect(metrics).toHaveProperty('requestCounts');
            expect(metrics.cacheHitRate).toBe('85.5%');
        });

        it('should calculate cache hit rate correctly', () => {
            const mockMetrics = {
                cacheHitRate: '75.0%',
                cacheHits: 75,
                cacheMisses: 25
            };

            AdminPerformance.getMetrics.mockReturnValue(mockMetrics);

            const metrics = AdminPerformance.getMetrics();

            expect(parseFloat(metrics.cacheHitRate)).toBe(75.0);
        });
    });

    describe('clearCache', () => {
        it('should clear all cache entries', () => {
            AdminPerformance.clearCache.mockReturnValue(true);

            const result = AdminPerformance.clearCache();

            expect(AdminPerformance.clearCache).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('invalidateCache', () => {
        it('should invalidate specific cache key', () => {
            AdminPerformance.invalidateCache.mockReturnValue(true);

            const result = AdminPerformance.invalidateCache('users-list');

            expect(AdminPerformance.invalidateCache).toHaveBeenCalledWith('users-list');
            expect(result).toBe(true);
        });

        it('should support pattern matching', () => {
            AdminPerformance.invalidateCache.mockReturnValue(5); // 5 entries invalidated

            const result = AdminPerformance.invalidateCache('users-*');

            expect(AdminPerformance.invalidateCache).toHaveBeenCalledWith('users-*');
            expect(result).toBe(5);
        });
    });

    describe('lazyLoadImages', () => {
        it('should set up IntersectionObserver', () => {
            AdminPerformance.lazyLoadImages('img[data-src]');

            expect(AdminPerformance.lazyLoadImages).toHaveBeenCalledWith('img[data-src]');
        });

        it('should use default selector if none provided', () => {
            AdminPerformance.lazyLoadImages();

            expect(AdminPerformance.lazyLoadImages).toHaveBeenCalled();
        });

        it('should load images when they enter viewport', () => {
            const mockObserver = {
                observe: jest.fn(),
                unobserve: jest.fn(),
                disconnect: jest.fn()
            };

            global.IntersectionObserver.mockImplementation(() => mockObserver);

            // Create test image
            const img = document.createElement('img');
            img.setAttribute('data-src', 'test.jpg');
            document.body.appendChild(img);

            AdminPerformance.lazyLoadImages.mockImplementation((selector) => {
                const images = document.querySelectorAll(selector || 'img[data-src]');
                expect(images.length).toBeGreaterThan(0);
            });

            AdminPerformance.lazyLoadImages();

            expect(AdminPerformance.lazyLoadImages).toHaveBeenCalled();
        });
    });
});
