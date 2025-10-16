/**
 * Unit Tests for AdminComponentsV2
 * Phase 6: Testing & Polish
 */

describe('AdminComponentsV2', () => {
    let AdminComponentsV2;

    beforeEach(() => {
        // Mock the global AdminComponentsV2 object
        global.AdminComponentsV2 = {
            enhancedMetricCard: jest.fn(),
            toast: jest.fn(),
            confirm: jest.fn(),
            modal: jest.fn(),
            skeleton: jest.fn(),
            searchableDropdown: jest.fn(),
            dateRangePicker: jest.fn()
        };

        AdminComponentsV2 = global.AdminComponentsV2;

        // Set up DOM
        document.body.innerHTML = '<div id="test-container"></div>';
    });

    describe('enhancedMetricCard', () => {
        it('should create metric card with sparkline', () => {
            const mockCard = '<div class="enhanced-metric-card">...</div>';
            AdminComponentsV2.enhancedMetricCard.mockReturnValue(mockCard);

            const config = {
                title: 'Total Users',
                value: 1234,
                change: 12.5,
                sparklineData: [10, 20, 15, 25, 30]
            };

            const result = AdminComponentsV2.enhancedMetricCard(config);

            expect(AdminComponentsV2.enhancedMetricCard).toHaveBeenCalledWith(config);
            expect(result).toContain('enhanced-metric-card');
        });

        it('should handle missing sparkline data', () => {
            const mockCard = '<div class="enhanced-metric-card">...</div>';
            AdminComponentsV2.enhancedMetricCard.mockReturnValue(mockCard);

            const config = {
                title: 'Revenue',
                value: 50000
            };

            const result = AdminComponentsV2.enhancedMetricCard(config);

            expect(AdminComponentsV2.enhancedMetricCard).toHaveBeenCalled();
            expect(result).toBeTruthy();
        });

        it('should handle click callbacks', () => {
            const onClick = jest.fn();
            const mockCard = '<div class="enhanced-metric-card" onclick="onClick()">...</div>';
            AdminComponentsV2.enhancedMetricCard.mockReturnValue(mockCard);

            const config = {
                title: 'Clicks',
                value: 999,
                onClick
            };

            AdminComponentsV2.enhancedMetricCard(config);

            expect(AdminComponentsV2.enhancedMetricCard).toHaveBeenCalledWith(
                expect.objectContaining({ onClick })
            );
        });
    });

    describe('toast', () => {
        it('should display success toast', () => {
            AdminComponentsV2.toast({
                type: 'success',
                message: 'Operation completed'
            });

            expect(AdminComponentsV2.toast).toHaveBeenCalledWith({
                type: 'success',
                message: 'Operation completed'
            });
        });

        it('should display error toast', () => {
            AdminComponentsV2.toast({
                type: 'error',
                message: 'Something went wrong'
            });

            expect(AdminComponentsV2.toast).toHaveBeenCalledWith({
                type: 'error',
                message: 'Something went wrong'
            });
        });

        it('should handle custom duration', () => {
            AdminComponentsV2.toast({
                type: 'info',
                message: 'Loading...',
                duration: 5000
            });

            expect(AdminComponentsV2.toast).toHaveBeenCalledWith(
                expect.objectContaining({ duration: 5000 })
            );
        });

        it('should support action buttons', () => {
            const action = { text: 'Undo', onClick: jest.fn() };

            AdminComponentsV2.toast({
                type: 'warning',
                message: 'Item deleted',
                action
            });

            expect(AdminComponentsV2.toast).toHaveBeenCalledWith(
                expect.objectContaining({ action })
            );
        });

        it('should support different positions', () => {
            ['top-right', 'top-left', 'bottom-right', 'bottom-left'].forEach(position => {
                AdminComponentsV2.toast({
                    type: 'info',
                    message: 'Test',
                    position
                });

                expect(AdminComponentsV2.toast).toHaveBeenCalledWith(
                    expect.objectContaining({ position })
                );
            });
        });
    });

    describe('confirm', () => {
        it('should display confirmation dialog', async () => {
            AdminComponentsV2.confirm.mockResolvedValue(true);

            const result = await AdminComponentsV2.confirm({
                title: 'Confirm Delete',
                message: 'Are you sure?'
            });

            expect(AdminComponentsV2.confirm).toHaveBeenCalledWith({
                title: 'Confirm Delete',
                message: 'Are you sure?'
            });
            expect(result).toBe(true);
        });

        it('should handle cancel action', async () => {
            AdminComponentsV2.confirm.mockResolvedValue(false);

            const result = await AdminComponentsV2.confirm({
                title: 'Confirm',
                message: 'Continue?'
            });

            expect(result).toBe(false);
        });

        it('should support danger mode', async () => {
            AdminComponentsV2.confirm.mockResolvedValue(true);

            await AdminComponentsV2.confirm({
                title: 'Delete Account',
                message: 'This cannot be undone',
                danger: true
            });

            expect(AdminComponentsV2.confirm).toHaveBeenCalledWith(
                expect.objectContaining({ danger: true })
            );
        });

        it('should support custom button text', async () => {
            AdminComponentsV2.confirm.mockResolvedValue(true);

            await AdminComponentsV2.confirm({
                title: 'Confirm',
                message: 'Proceed?',
                confirmText: 'Yes, proceed',
                cancelText: 'No, cancel'
            });

            expect(AdminComponentsV2.confirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    confirmText: 'Yes, proceed',
                    cancelText: 'No, cancel'
                })
            );
        });
    });

    describe('modal', () => {
        it('should create modal with content', () => {
            const mockModal = {
                show: jest.fn(),
                close: jest.fn()
            };
            AdminComponentsV2.modal.mockReturnValue(mockModal);

            const config = {
                title: 'Edit User',
                content: '<form>...</form>'
            };

            const modal = AdminComponentsV2.modal(config);

            expect(AdminComponentsV2.modal).toHaveBeenCalledWith(config);
            expect(modal).toHaveProperty('show');
            expect(modal).toHaveProperty('close');
        });

        it('should support different sizes', () => {
            const mockModal = { show: jest.fn(), close: jest.fn() };
            AdminComponentsV2.modal.mockReturnValue(mockModal);

            ['small', 'medium', 'large', 'fullscreen'].forEach(size => {
                AdminComponentsV2.modal({
                    title: 'Modal',
                    content: 'Content',
                    size
                });

                expect(AdminComponentsV2.modal).toHaveBeenCalledWith(
                    expect.objectContaining({ size })
                );
            });
        });

        it('should support custom actions', () => {
            const mockModal = { show: jest.fn(), close: jest.fn() };
            AdminComponentsV2.modal.mockReturnValue(mockModal);

            const actions = [
                { text: 'Cancel', variant: 'secondary', onClick: jest.fn() },
                { text: 'Save', variant: 'primary', onClick: jest.fn() }
            ];

            AdminComponentsV2.modal({
                title: 'Modal',
                content: 'Content',
                actions
            });

            expect(AdminComponentsV2.modal).toHaveBeenCalledWith(
                expect.objectContaining({ actions })
            );
        });
    });

    describe('skeleton', () => {
        it('should generate text skeleton', () => {
            const mockSkeleton = '<div class="skeleton-text">...</div>';
            AdminComponentsV2.skeleton.mockReturnValue(mockSkeleton);

            const result = AdminComponentsV2.skeleton({ type: 'text', rows: 3 });

            expect(AdminComponentsV2.skeleton).toHaveBeenCalledWith({
                type: 'text',
                rows: 3
            });
            expect(result).toContain('skeleton-text');
        });

        it('should generate table skeleton', () => {
            const mockSkeleton = '<div class="skeleton-table">...</div>';
            AdminComponentsV2.skeleton.mockReturnValue(mockSkeleton);

            const result = AdminComponentsV2.skeleton({
                type: 'table',
                rows: 5,
                columns: 4
            });

            expect(AdminComponentsV2.skeleton).toHaveBeenCalledWith({
                type: 'table',
                rows: 5,
                columns: 4
            });
            expect(result).toContain('skeleton-table');
        });

        it('should generate card skeleton', () => {
            const mockSkeleton = '<div class="skeleton-card">...</div>';
            AdminComponentsV2.skeleton.mockReturnValue(mockSkeleton);

            const result = AdminComponentsV2.skeleton({ type: 'card' });

            expect(AdminComponentsV2.skeleton).toHaveBeenCalled();
            expect(result).toContain('skeleton-card');
        });

        it('should generate avatar skeleton', () => {
            const mockSkeleton = '<div class="skeleton-avatar">...</div>';
            AdminComponentsV2.skeleton.mockReturnValue(mockSkeleton);

            const result = AdminComponentsV2.skeleton({ type: 'avatar' });

            expect(AdminComponentsV2.skeleton).toHaveBeenCalled();
            expect(result).toContain('skeleton-avatar');
        });
    });

    describe('searchableDropdown', () => {
        it('should create dropdown with search', () => {
            const mockDropdown = {
                show: jest.fn(),
                hide: jest.fn(),
                getValue: jest.fn()
            };
            AdminComponentsV2.searchableDropdown.mockReturnValue(mockDropdown);

            const options = [
                { value: '1', label: 'Option 1' },
                { value: '2', label: 'Option 2' }
            ];

            const dropdown = AdminComponentsV2.searchableDropdown({
                containerId: 'test-container',
                options
            });

            expect(AdminComponentsV2.searchableDropdown).toHaveBeenCalled();
            expect(dropdown).toHaveProperty('show');
            expect(dropdown).toHaveProperty('hide');
            expect(dropdown).toHaveProperty('getValue');
        });

        it('should support onSelect callback', () => {
            const onSelect = jest.fn();
            const mockDropdown = { show: jest.fn(), hide: jest.fn(), getValue: jest.fn() };
            AdminComponentsV2.searchableDropdown.mockReturnValue(mockDropdown);

            AdminComponentsV2.searchableDropdown({
                containerId: 'test-container',
                options: [],
                onSelect
            });

            expect(AdminComponentsV2.searchableDropdown).toHaveBeenCalledWith(
                expect.objectContaining({ onSelect })
            );
        });
    });

    describe('dateRangePicker', () => {
        it('should create date range picker', () => {
            const mockPicker = {
                getStartDate: jest.fn(),
                getEndDate: jest.fn()
            };
            AdminComponentsV2.dateRangePicker.mockReturnValue(mockPicker);

            const picker = AdminComponentsV2.dateRangePicker({
                containerId: 'test-container'
            });

            expect(AdminComponentsV2.dateRangePicker).toHaveBeenCalled();
            expect(picker).toHaveProperty('getStartDate');
            expect(picker).toHaveProperty('getEndDate');
        });

        it('should support presets', () => {
            const mockPicker = {
                getStartDate: jest.fn(),
                getEndDate: jest.fn()
            };
            AdminComponentsV2.dateRangePicker.mockReturnValue(mockPicker);

            AdminComponentsV2.dateRangePicker({
                containerId: 'test-container',
                presets: ['today', 'thisWeek', 'thisMonth']
            });

            expect(AdminComponentsV2.dateRangePicker).toHaveBeenCalledWith(
                expect.objectContaining({
                    presets: expect.arrayContaining(['today', 'thisWeek', 'thisMonth'])
                })
            );
        });

        it('should support onChange callback', () => {
            const onChange = jest.fn();
            const mockPicker = {
                getStartDate: jest.fn(),
                getEndDate: jest.fn()
            };
            AdminComponentsV2.dateRangePicker.mockReturnValue(mockPicker);

            AdminComponentsV2.dateRangePicker({
                containerId: 'test-container',
                onChange
            });

            expect(AdminComponentsV2.dateRangePicker).toHaveBeenCalledWith(
                expect.objectContaining({ onChange })
            );
        });
    });
});
