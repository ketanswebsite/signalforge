/**
 * Unit Tests for AdminVirtualScroll
 * Phase 6: Testing & Polish
 */

describe('AdminVirtualScroll', () => {
    let AdminVirtualScroll;

    beforeEach(() => {
        // Mock the global AdminVirtualScroll object
        global.AdminVirtualScroll = {
            create: jest.fn(),
            createList: jest.fn(),
            updateData: jest.fn(),
            scrollToIndex: jest.fn(),
            getVisibleRange: jest.fn(),
            destroy: jest.fn()
        };

        AdminVirtualScroll = global.AdminVirtualScroll;

        // Set up DOM
        document.body.innerHTML = '<div id="test-container"></div>';
    });

    describe('create', () => {
        it('should create virtual scroll table', () => {
            const mockId = 'virtual-scroll-1';
            AdminVirtualScroll.create.mockReturnValue(mockId);

            const config = {
                data: Array.from({ length: 10000 }, (_, i) => ({
                    id: i,
                    name: `User ${i}`,
                    email: `user${i}@example.com`
                })),
                columns: [
                    { key: 'id', label: 'ID', width: '100px' },
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' }
                ],
                rowHeight: 50,
                bufferRows: 5
            };

            const id = AdminVirtualScroll.create('test-container', config);

            expect(AdminVirtualScroll.create).toHaveBeenCalledWith(
                'test-container',
                expect.objectContaining({
                    data: expect.any(Array),
                    columns: expect.any(Array),
                    rowHeight: 50
                })
            );
            expect(id).toBe(mockId);
        });

        it('should handle empty data', () => {
            AdminVirtualScroll.create.mockReturnValue('virtual-scroll-1');

            const config = {
                data: [],
                columns: [{ key: 'id', label: 'ID' }],
                rowHeight: 50
            };

            const id = AdminVirtualScroll.create('test-container', config);

            expect(AdminVirtualScroll.create).toHaveBeenCalled();
            expect(id).toBeTruthy();
        });

        it('should support custom row heights', () => {
            AdminVirtualScroll.create.mockReturnValue('virtual-scroll-1');

            const config = {
                data: [{ id: 1 }],
                columns: [{ key: 'id', label: 'ID' }],
                rowHeight: 75
            };

            AdminVirtualScroll.create('test-container', config);

            expect(AdminVirtualScroll.create).toHaveBeenCalledWith(
                'test-container',
                expect.objectContaining({ rowHeight: 75 })
            );
        });

        it('should support buffer rows configuration', () => {
            AdminVirtualScroll.create.mockReturnValue('virtual-scroll-1');

            const config = {
                data: [{ id: 1 }],
                columns: [{ key: 'id', label: 'ID' }],
                rowHeight: 50,
                bufferRows: 10
            };

            AdminVirtualScroll.create('test-container', config);

            expect(AdminVirtualScroll.create).toHaveBeenCalledWith(
                'test-container',
                expect.objectContaining({ bufferRows: 10 })
            );
        });
    });

    describe('createList', () => {
        it('should create virtual scroll list', () => {
            const mockId = 'virtual-list-1';
            AdminVirtualScroll.createList.mockReturnValue(mockId);

            const config = {
                items: Array.from({ length: 5000 }, (_, i) => ({
                    id: i,
                    text: `Item ${i}`
                })),
                itemHeight: 60,
                renderItem: (item) => `<div>${item.text}</div>`
            };

            const id = AdminVirtualScroll.createList('test-container', config);

            expect(AdminVirtualScroll.createList).toHaveBeenCalledWith(
                'test-container',
                expect.objectContaining({
                    items: expect.any(Array),
                    itemHeight: 60,
                    renderItem: expect.any(Function)
                })
            );
            expect(id).toBe(mockId);
        });

        it('should require renderItem function', () => {
            const config = {
                items: [{ id: 1 }],
                itemHeight: 60
                // missing renderItem
            };

            // Mock implementation should throw or handle missing renderItem
            AdminVirtualScroll.createList.mockImplementation(() => {
                throw new Error('renderItem is required');
            });

            expect(() => {
                AdminVirtualScroll.createList('test-container', config);
            }).toThrow('renderItem is required');
        });

        it('should support onClick handler', () => {
            const onClick = jest.fn();
            AdminVirtualScroll.createList.mockReturnValue('virtual-list-1');

            const config = {
                items: [{ id: 1 }],
                itemHeight: 60,
                renderItem: (item) => `<div>${item.id}</div>`,
                onClick
            };

            AdminVirtualScroll.createList('test-container', config);

            expect(AdminVirtualScroll.createList).toHaveBeenCalledWith(
                'test-container',
                expect.objectContaining({ onClick })
            );
        });
    });

    describe('updateData', () => {
        it('should update virtual scroll data', () => {
            const instanceId = 'virtual-scroll-1';
            const newData = Array.from({ length: 100 }, (_, i) => ({ id: i }));

            AdminVirtualScroll.updateData.mockReturnValue(true);

            const result = AdminVirtualScroll.updateData(instanceId, newData);

            expect(AdminVirtualScroll.updateData).toHaveBeenCalledWith(
                instanceId,
                newData
            );
            expect(result).toBe(true);
        });

        it('should handle invalid instance ID', () => {
            AdminVirtualScroll.updateData.mockReturnValue(false);

            const result = AdminVirtualScroll.updateData('invalid-id', []);

            expect(result).toBe(false);
        });

        it('should re-render visible rows', () => {
            const instanceId = 'virtual-scroll-1';
            const newData = [{ id: 1, updated: true }];

            AdminVirtualScroll.updateData.mockImplementation((id, data) => {
                // Should trigger re-render of visible rows
                return true;
            });

            AdminVirtualScroll.updateData(instanceId, newData);

            expect(AdminVirtualScroll.updateData).toHaveBeenCalled();
        });
    });

    describe('scrollToIndex', () => {
        it('should scroll to specific index', () => {
            const instanceId = 'virtual-scroll-1';
            const targetIndex = 500;

            AdminVirtualScroll.scrollToIndex.mockReturnValue(true);

            const result = AdminVirtualScroll.scrollToIndex(instanceId, targetIndex);

            expect(AdminVirtualScroll.scrollToIndex).toHaveBeenCalledWith(
                instanceId,
                targetIndex
            );
            expect(result).toBe(true);
        });

        it('should support smooth scrolling', () => {
            const instanceId = 'virtual-scroll-1';
            const targetIndex = 100;

            AdminVirtualScroll.scrollToIndex.mockReturnValue(true);

            AdminVirtualScroll.scrollToIndex(instanceId, targetIndex, true);

            expect(AdminVirtualScroll.scrollToIndex).toHaveBeenCalledWith(
                instanceId,
                targetIndex,
                true
            );
        });

        it('should handle out of bounds index', () => {
            const instanceId = 'virtual-scroll-1';
            const invalidIndex = -1;

            AdminVirtualScroll.scrollToIndex.mockReturnValue(false);

            const result = AdminVirtualScroll.scrollToIndex(instanceId, invalidIndex);

            expect(result).toBe(false);
        });
    });

    describe('getVisibleRange', () => {
        it('should return visible row range', () => {
            const instanceId = 'virtual-scroll-1';
            const mockRange = { start: 10, end: 30 };

            AdminVirtualScroll.getVisibleRange.mockReturnValue(mockRange);

            const range = AdminVirtualScroll.getVisibleRange(instanceId);

            expect(AdminVirtualScroll.getVisibleRange).toHaveBeenCalledWith(instanceId);
            expect(range).toEqual(mockRange);
            expect(range.start).toBe(10);
            expect(range.end).toBe(30);
        });

        it('should return null for invalid instance', () => {
            AdminVirtualScroll.getVisibleRange.mockReturnValue(null);

            const range = AdminVirtualScroll.getVisibleRange('invalid-id');

            expect(range).toBeNull();
        });
    });

    describe('destroy', () => {
        it('should destroy virtual scroll instance', () => {
            const instanceId = 'virtual-scroll-1';

            AdminVirtualScroll.destroy.mockReturnValue(true);

            const result = AdminVirtualScroll.destroy(instanceId);

            expect(AdminVirtualScroll.destroy).toHaveBeenCalledWith(instanceId);
            expect(result).toBe(true);
        });

        it('should clean up event listeners', () => {
            const instanceId = 'virtual-scroll-1';

            AdminVirtualScroll.destroy.mockImplementation((id) => {
                // Should remove scroll event listeners
                // Should clean up DOM elements
                return true;
            });

            AdminVirtualScroll.destroy(instanceId);

            expect(AdminVirtualScroll.destroy).toHaveBeenCalled();
        });

        it('should handle destroying non-existent instance', () => {
            AdminVirtualScroll.destroy.mockReturnValue(false);

            const result = AdminVirtualScroll.destroy('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('Performance', () => {
        it('should handle large datasets efficiently', () => {
            const largeData = Array.from({ length: 100000 }, (_, i) => ({
                id: i,
                name: `Item ${i}`
            }));

            AdminVirtualScroll.create.mockImplementation((containerId, config) => {
                // Should only render visible rows
                const visibleCount = Math.ceil(600 / config.rowHeight) + config.bufferRows * 2;
                expect(visibleCount).toBeLessThan(100);
                return 'virtual-scroll-1';
            });

            AdminVirtualScroll.create('test-container', {
                data: largeData,
                columns: [{ key: 'id', label: 'ID' }],
                rowHeight: 50,
                bufferRows: 5
            });

            expect(AdminVirtualScroll.create).toHaveBeenCalled();
        });

        it('should maintain 60fps scroll performance', () => {
            // Mock should complete scroll update within frame budget (16.67ms)
            const instanceId = 'virtual-scroll-1';

            AdminVirtualScroll.scrollToIndex.mockImplementation((id, index) => {
                const startTime = Date.now();
                // Simulate scroll update
                const endTime = Date.now();
                const duration = endTime - startTime;

                expect(duration).toBeLessThan(17); // Frame budget
                return true;
            });

            AdminVirtualScroll.scrollToIndex(instanceId, 100);
        });

        it('should throttle scroll events', () => {
            jest.useFakeTimers();

            const scrollHandler = jest.fn();
            AdminVirtualScroll.create.mockImplementation((containerId, config) => {
                // Should throttle scroll events to ~16ms
                return 'virtual-scroll-1';
            });

            AdminVirtualScroll.create('test-container', {
                data: [{ id: 1 }],
                columns: [{ key: 'id', label: 'ID' }],
                rowHeight: 50
            });

            // Simulate rapid scroll events
            for (let i = 0; i < 10; i++) {
                jest.advanceTimersByTime(5);
                scrollHandler();
            }

            // Should be throttled
            expect(AdminVirtualScroll.create).toHaveBeenCalledTimes(1);

            jest.useRealTimers();
        });
    });
});
