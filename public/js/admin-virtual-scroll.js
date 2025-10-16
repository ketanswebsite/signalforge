/**
 * Admin Virtual Scroll - Phase 4
 *
 * Implements virtual scrolling for large tables and lists
 * Only renders visible items for improved performance
 *
 * Features:
 * - Virtual scrolling for tables
 * - Dynamic row height support
 * - Smooth scrolling
 * - Buffer rows for smooth experience
 * - Memory efficient
 *
 * Dependencies: None
 */

const AdminVirtualScroll = {
    // Active virtual scroll instances
    instances: new Map(),

    /**
     * Create a virtual scroll table
     * @param {string} containerId - Container element ID
     * @param {Object} config - Configuration object
     * @returns {string} - Instance ID
     */
    create(containerId, config = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[VirtualScroll] Container not found: ${containerId}`);
            return null;
        }

        const instanceId = `vs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const instance = {
            id: instanceId,
            container,
            config: {
                data: config.data || [],
                columns: config.columns || [],
                rowHeight: config.rowHeight || 50,
                headerHeight: config.headerHeight || 40,
                bufferRows: config.bufferRows || 5,
                onRowClick: config.onRowClick || null,
                onRowRender: config.onRowRender || null,
                className: config.className || 'virtual-scroll-table'
            },
            state: {
                scrollTop: 0,
                visibleStart: 0,
                visibleEnd: 0,
                totalHeight: 0
            },
            elements: {}
        };

        // Initialize the virtual scroll
        this.initialize(instance);

        // Store instance
        this.instances.set(instanceId, instance);

        console.log(`[VirtualScroll] Created instance ${instanceId} with ${instance.config.data.length} rows`);

        return instanceId;
    },

    /**
     * Initialize virtual scroll instance
     * @param {Object} instance - Instance object
     */
    initialize(instance) {
        const { container, config } = instance;

        // Clear container
        container.innerHTML = '';
        container.className = `virtual-scroll-container ${config.className}`;

        // Create structure
        const wrapper = document.createElement('div');
        wrapper.className = 'virtual-scroll-wrapper';

        // Create header
        const header = document.createElement('div');
        header.className = 'virtual-scroll-header';
        header.style.height = `${config.headerHeight}px`;
        header.innerHTML = this.renderHeader(config.columns);

        // Create viewport
        const viewport = document.createElement('div');
        viewport.className = 'virtual-scroll-viewport';
        viewport.style.height = `calc(100% - ${config.headerHeight}px)`;
        viewport.style.overflowY = 'auto';
        viewport.style.position = 'relative';

        // Create spacer (maintains scroll height)
        const spacer = document.createElement('div');
        spacer.className = 'virtual-scroll-spacer';
        const totalHeight = config.data.length * config.rowHeight;
        spacer.style.height = `${totalHeight}px`;
        instance.state.totalHeight = totalHeight;

        // Create content container (holds visible rows)
        const content = document.createElement('div');
        content.className = 'virtual-scroll-content';
        content.style.position = 'absolute';
        content.style.top = '0';
        content.style.left = '0';
        content.style.right = '0';

        // Assemble structure
        spacer.appendChild(content);
        viewport.appendChild(spacer);
        wrapper.appendChild(header);
        wrapper.appendChild(viewport);
        container.appendChild(wrapper);

        // Store elements
        instance.elements = {
            wrapper,
            header,
            viewport,
            spacer,
            content
        };

        // Setup scroll listener
        viewport.addEventListener('scroll', this.throttle(() => {
            this.handleScroll(instance);
        }, 16)); // ~60fps

        // Initial render
        this.handleScroll(instance);
    },

    /**
     * Render table header
     * @param {Array} columns - Column definitions
     * @returns {string} - Header HTML
     */
    renderHeader(columns) {
        return `
            <div class="virtual-scroll-row virtual-scroll-header-row">
                ${columns.map(col => `
                    <div class="virtual-scroll-cell" style="${col.width ? `width: ${col.width}` : 'flex: 1'}">
                        ${col.label || col.key}
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Handle scroll event
     * @param {Object} instance - Instance object
     */
    handleScroll(instance) {
        const { viewport, content } = instance.elements;
        const { config, state } = instance;

        const scrollTop = viewport.scrollTop;
        state.scrollTop = scrollTop;

        // Calculate visible range
        const viewportHeight = viewport.clientHeight;
        const visibleStart = Math.floor(scrollTop / config.rowHeight);
        const visibleEnd = Math.ceil((scrollTop + viewportHeight) / config.rowHeight);

        // Add buffer rows
        const bufferStart = Math.max(0, visibleStart - config.bufferRows);
        const bufferEnd = Math.min(config.data.length, visibleEnd + config.bufferRows);

        // Only re-render if range changed
        if (bufferStart !== state.visibleStart || bufferEnd !== state.visibleEnd) {
            state.visibleStart = bufferStart;
            state.visibleEnd = bufferEnd;

            // Render visible rows
            const html = this.renderRows(instance, bufferStart, bufferEnd);
            content.innerHTML = html;

            // Position content
            content.style.transform = `translateY(${bufferStart * config.rowHeight}px)`;
        }
    },

    /**
     * Render visible rows
     * @param {Object} instance - Instance object
     * @param {number} start - Start index
     * @param {number} end - End index
     * @returns {string} - Rows HTML
     */
    renderRows(instance, start, end) {
        const { config } = instance;
        const rows = [];

        for (let i = start; i < end; i++) {
            const rowData = config.data[i];
            if (!rowData) continue;

            let rowHtml = `
                <div class="virtual-scroll-row" data-index="${i}" style="height: ${config.rowHeight}px">
                    ${config.columns.map(col => {
                        let value = rowData[col.key];

                        // Apply formatter if provided
                        if (col.formatter && typeof col.formatter === 'function') {
                            value = col.formatter(value, rowData);
                        }

                        return `
                            <div class="virtual-scroll-cell" style="${col.width ? `width: ${col.width}` : 'flex: 1'}">
                                ${value !== null && value !== undefined ? value : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            // Apply custom row render if provided
            if (config.onRowRender) {
                rowHtml = config.onRowRender(rowData, i, rowHtml);
            }

            rows.push(rowHtml);
        }

        return rows.join('');
    },

    /**
     * Update data
     * @param {string} instanceId - Instance ID
     * @param {Array} newData - New data array
     */
    updateData(instanceId, newData) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            console.error(`[VirtualScroll] Instance not found: ${instanceId}`);
            return;
        }

        instance.config.data = newData;

        // Update spacer height
        const totalHeight = newData.length * instance.config.rowHeight;
        instance.state.totalHeight = totalHeight;
        instance.elements.spacer.style.height = `${totalHeight}px`;

        // Re-render
        this.handleScroll(instance);

        console.log(`[VirtualScroll] Updated data for ${instanceId}: ${newData.length} rows`);
    },

    /**
     * Scroll to index
     * @param {string} instanceId - Instance ID
     * @param {number} index - Row index to scroll to
     * @param {boolean} smooth - Use smooth scrolling
     */
    scrollToIndex(instanceId, index, smooth = true) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;

        const scrollTop = index * instance.config.rowHeight;
        instance.elements.viewport.scrollTo({
            top: scrollTop,
            behavior: smooth ? 'smooth' : 'auto'
        });
    },

    /**
     * Get visible range
     * @param {string} instanceId - Instance ID
     * @returns {Object} - {start, end}
     */
    getVisibleRange(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return null;

        return {
            start: instance.state.visibleStart,
            end: instance.state.visibleEnd
        };
    },

    /**
     * Destroy instance
     * @param {string} instanceId - Instance ID
     */
    destroy(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) return;

        // Clear container
        instance.container.innerHTML = '';

        // Remove instance
        this.instances.delete(instanceId);

        console.log(`[VirtualScroll] Destroyed instance ${instanceId}`);
    },

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Throttle limit in ms
     * @returns {Function} - Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Create virtual list (simpler than table, just items)
     * @param {string} containerId - Container element ID
     * @param {Object} config - Configuration object
     * @returns {string} - Instance ID
     */
    createList(containerId, config = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[VirtualScroll] Container not found: ${containerId}`);
            return null;
        }

        const instanceId = `vsl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const instance = {
            id: instanceId,
            type: 'list',
            container,
            config: {
                items: config.items || [],
                itemHeight: config.itemHeight || 60,
                bufferItems: config.bufferItems || 5,
                renderItem: config.renderItem || ((item, index) => `<div>${JSON.stringify(item)}</div>`),
                onItemClick: config.onItemClick || null,
                className: config.className || 'virtual-scroll-list'
            },
            state: {
                scrollTop: 0,
                visibleStart: 0,
                visibleEnd: 0,
                totalHeight: 0
            },
            elements: {}
        };

        // Initialize the virtual list
        this.initializeList(instance);

        // Store instance
        this.instances.set(instanceId, instance);

        console.log(`[VirtualScroll] Created list instance ${instanceId} with ${instance.config.items.length} items`);

        return instanceId;
    },

    /**
     * Initialize virtual list instance
     * @param {Object} instance - Instance object
     */
    initializeList(instance) {
        const { container, config } = instance;

        // Clear container
        container.innerHTML = '';
        container.className = `virtual-scroll-container virtual-scroll-list-container ${config.className}`;

        // Create viewport
        const viewport = document.createElement('div');
        viewport.className = 'virtual-scroll-viewport';
        viewport.style.height = '100%';
        viewport.style.overflowY = 'auto';
        viewport.style.position = 'relative';

        // Create spacer
        const spacer = document.createElement('div');
        spacer.className = 'virtual-scroll-spacer';
        const totalHeight = config.items.length * config.itemHeight;
        spacer.style.height = `${totalHeight}px`;
        instance.state.totalHeight = totalHeight;

        // Create content container
        const content = document.createElement('div');
        content.className = 'virtual-scroll-content';
        content.style.position = 'absolute';
        content.style.top = '0';
        content.style.left = '0';
        content.style.right = '0';

        // Assemble structure
        spacer.appendChild(content);
        viewport.appendChild(spacer);
        container.appendChild(viewport);

        // Store elements
        instance.elements = {
            viewport,
            spacer,
            content
        };

        // Setup scroll listener
        viewport.addEventListener('scroll', this.throttle(() => {
            this.handleListScroll(instance);
        }, 16));

        // Setup click delegation
        if (config.onItemClick) {
            content.addEventListener('click', (e) => {
                const item = e.target.closest('.virtual-scroll-item');
                if (item) {
                    const index = parseInt(item.dataset.index);
                    const itemData = config.items[index];
                    config.onItemClick(itemData, index, e);
                }
            });
        }

        // Initial render
        this.handleListScroll(instance);
    },

    /**
     * Handle list scroll event
     * @param {Object} instance - Instance object
     */
    handleListScroll(instance) {
        const { viewport, content } = instance.elements;
        const { config, state } = instance;

        const scrollTop = viewport.scrollTop;
        state.scrollTop = scrollTop;

        // Calculate visible range
        const viewportHeight = viewport.clientHeight;
        const visibleStart = Math.floor(scrollTop / config.itemHeight);
        const visibleEnd = Math.ceil((scrollTop + viewportHeight) / config.itemHeight);

        // Add buffer items
        const bufferStart = Math.max(0, visibleStart - config.bufferItems);
        const bufferEnd = Math.min(config.items.length, visibleEnd + config.bufferItems);

        // Only re-render if range changed
        if (bufferStart !== state.visibleStart || bufferEnd !== state.visibleEnd) {
            state.visibleStart = bufferStart;
            state.visibleEnd = bufferEnd;

            // Render visible items
            const html = this.renderListItems(instance, bufferStart, bufferEnd);
            content.innerHTML = html;

            // Position content
            content.style.transform = `translateY(${bufferStart * config.itemHeight}px)`;
        }
    },

    /**
     * Render list items
     * @param {Object} instance - Instance object
     * @param {number} start - Start index
     * @param {number} end - End index
     * @returns {string} - Items HTML
     */
    renderListItems(instance, start, end) {
        const { config } = instance;
        const items = [];

        for (let i = start; i < end; i++) {
            const itemData = config.items[i];
            if (!itemData) continue;

            const itemContent = config.renderItem(itemData, i);
            const itemHtml = `
                <div class="virtual-scroll-item" data-index="${i}" style="height: ${config.itemHeight}px">
                    ${itemContent}
                </div>
            `;

            items.push(itemHtml);
        }

        return items.join('');
    },

    /**
     * Update list items
     * @param {string} instanceId - Instance ID
     * @param {Array} newItems - New items array
     */
    updateItems(instanceId, newItems) {
        const instance = this.instances.get(instanceId);
        if (!instance || instance.type !== 'list') {
            console.error(`[VirtualScroll] List instance not found: ${instanceId}`);
            return;
        }

        instance.config.items = newItems;

        // Update spacer height
        const totalHeight = newItems.length * instance.config.itemHeight;
        instance.state.totalHeight = totalHeight;
        instance.elements.spacer.style.height = `${totalHeight}px`;

        // Re-render
        this.handleListScroll(instance);

        console.log(`[VirtualScroll] Updated items for ${instanceId}: ${newItems.length} items`);
    }
};

// Make available globally
window.AdminVirtualScroll = AdminVirtualScroll;
