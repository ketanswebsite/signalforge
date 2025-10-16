/**
 * Admin Query Builder - Visual SQL Query Builder
 * Phase 5: Advanced Features
 *
 * Features:
 * - Visual query construction
 * - Table and column selection
 * - WHERE clause builder
 * - JOIN builder
 * - ORDER BY and GROUP BY
 * - Query preview and execution
 * - Query history
 * - Query templates
 *
 * Dependencies: AdminComponentsV2, AdminTablesV2
 */

const AdminQueryBuilder = {
    // State management
    state: {
        query: {
            select: [],
            from: null,
            joins: [],
            where: [],
            groupBy: [],
            orderBy: [],
            limit: null
        },
        tables: [],
        columns: {},
        results: null,
        history: [],
        templates: []
    },

    /**
     * Initialize query builder
     */
    async init(containerId) {
        console.log('[QueryBuilder] Initializing...');
        this.containerId = containerId;

        await this.loadTables();
        this.render();
    },

    /**
     * Load available tables and their columns
     */
    async loadTables() {
        try {
            const response = await fetch('/api/admin/database/tables');

            if (!response.ok) {
                throw new Error('Failed to load tables');
            }

            const data = await response.json();
            this.state.tables = data.tables || [];
            this.state.columns = data.columns || {};
        } catch (error) {
            console.error('[QueryBuilder] Error loading tables:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: 'Failed to load database tables'
            });
        }
    },

    /**
     * Render query builder UI
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="query-builder-container">
                <!-- Header -->
                <div class="query-builder-header">
                    <h2>Visual Query Builder</h2>
                    <div class="query-actions">
                        <button class="btn btn-secondary btn-sm" onclick="AdminQueryBuilder.loadTemplate()">
                            📋 Templates
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="AdminQueryBuilder.showHistory()">
                            🕐 History
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="AdminQueryBuilder.resetQuery()">
                            🔄 Reset
                        </button>
                    </div>
                </div>

                <!-- Query Builder Panels -->
                <div class="query-builder-panels">
                    <!-- Left Panel: Query Construction -->
                    <div class="query-builder-panel">
                        <div class="panel-section">
                            <h3>SELECT Columns</h3>
                            <div class="select-section" id="select-section">
                                ${this.renderSelectSection()}
                            </div>
                        </div>

                        <div class="panel-section">
                            <h3>FROM Table</h3>
                            <div class="from-section" id="from-section">
                                ${this.renderFromSection()}
                            </div>
                        </div>

                        <div class="panel-section">
                            <h3>WHERE Conditions</h3>
                            <div class="where-section" id="where-section">
                                ${this.renderWhereSection()}
                            </div>
                        </div>

                        <div class="panel-section">
                            <h3>ORDER BY</h3>
                            <div class="order-section" id="order-section">
                                ${this.renderOrderSection()}
                            </div>
                        </div>

                        <div class="panel-section">
                            <h3>LIMIT</h3>
                            <div class="limit-section">
                                <input type="number" id="query-limit"
                                       placeholder="e.g., 100"
                                       min="1" max="10000"
                                       onchange="AdminQueryBuilder.updateLimit(this.value)">
                            </div>
                        </div>
                    </div>

                    <!-- Right Panel: Query Preview & Results -->
                    <div class="query-builder-panel">
                        <div class="panel-section">
                            <h3>Query Preview</h3>
                            <div class="query-preview" id="query-preview">
                                ${this.renderQueryPreview()}
                            </div>
                            <div class="query-preview-actions">
                                <button class="btn btn-primary" onclick="AdminQueryBuilder.executeQuery()">
                                    ▶️ Execute Query
                                </button>
                                <button class="btn btn-secondary" onclick="AdminQueryBuilder.copyQuery()">
                                    📋 Copy SQL
                                </button>
                                <button class="btn btn-secondary" onclick="AdminQueryBuilder.saveTemplate()">
                                    💾 Save Template
                                </button>
                            </div>
                        </div>

                        <div class="panel-section">
                            <h3>Results</h3>
                            <div class="query-results" id="query-results">
                                <div class="empty-state">
                                    <div class="empty-state-icon">🔍</div>
                                    <div class="empty-state-title">No results yet</div>
                                    <div class="empty-state-message">Execute a query to see results here</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render SELECT section
     */
    renderSelectSection() {
        const selectedColumns = this.state.query.select;

        return `
            <div class="select-columns">
                ${selectedColumns.length > 0 ?
                    selectedColumns.map((col, index) => `
                        <div class="selected-column">
                            <span>${col}</span>
                            <button class="btn-icon" onclick="AdminQueryBuilder.removeColumn(${index})" title="Remove">
                                ✕
                            </button>
                        </div>
                    `).join('') :
                    '<p class="text-muted">No columns selected</p>'
                }
            </div>
            <button class="btn btn-sm btn-primary" onclick="AdminQueryBuilder.addColumn()">
                ➕ Add Column
            </button>
        `;
    },

    /**
     * Render FROM section
     */
    renderFromSection() {
        return `
            <select id="from-table" onchange="AdminQueryBuilder.setFromTable(this.value)">
                <option value="">Select a table...</option>
                ${this.state.tables.map(table => `
                    <option value="${table}" ${this.state.query.from === table ? 'selected' : ''}>
                        ${table}
                    </option>
                `).join('')}
            </select>
        `;
    },

    /**
     * Render WHERE section
     */
    renderWhereSection() {
        const conditions = this.state.query.where;

        return `
            <div class="where-conditions">
                ${conditions.length > 0 ?
                    conditions.map((cond, index) => `
                        <div class="where-condition">
                            <span class="condition-text">${cond.column} ${cond.operator} ${cond.value}</span>
                            <button class="btn-icon" onclick="AdminQueryBuilder.removeCondition(${index})" title="Remove">
                                ✕
                            </button>
                        </div>
                    `).join('') :
                    '<p class="text-muted">No conditions</p>'
                }
            </div>
            <button class="btn btn-sm btn-primary" onclick="AdminQueryBuilder.addCondition()">
                ➕ Add Condition
            </button>
        `;
    },

    /**
     * Render ORDER BY section
     */
    renderOrderSection() {
        const orderBy = this.state.query.orderBy;

        return `
            <div class="order-columns">
                ${orderBy.length > 0 ?
                    orderBy.map((order, index) => `
                        <div class="order-column">
                            <span>${order.column} ${order.direction}</span>
                            <button class="btn-icon" onclick="AdminQueryBuilder.removeOrder(${index})" title="Remove">
                                ✕
                            </button>
                        </div>
                    `).join('') :
                    '<p class="text-muted">No ordering</p>'
                }
            </div>
            <button class="btn btn-sm btn-primary" onclick="AdminQueryBuilder.addOrder()">
                ➕ Add Order
            </button>
        `;
    },

    /**
     * Render query preview
     */
    renderQueryPreview() {
        const sql = this.generateSQL();
        return `
            <pre class="sql-preview"><code>${sql || 'No query built yet'}</code></pre>
        `;
    },

    /**
     * Generate SQL from query object
     */
    generateSQL() {
        const q = this.state.query;

        if (!q.from) {
            return '';
        }

        let sql = 'SELECT ';
        sql += q.select.length > 0 ? q.select.join(', ') : '*';
        sql += `\nFROM ${q.from}`;

        if (q.where.length > 0) {
            sql += '\nWHERE ';
            sql += q.where.map(cond =>
                `${cond.column} ${cond.operator} ${this.formatValue(cond.value)}`
            ).join(' AND ');
        }

        if (q.orderBy.length > 0) {
            sql += '\nORDER BY ';
            sql += q.orderBy.map(order =>
                `${order.column} ${order.direction}`
            ).join(', ');
        }

        if (q.limit) {
            sql += `\nLIMIT ${q.limit}`;
        }

        return sql;
    },

    /**
     * Format value for SQL
     */
    formatValue(value) {
        if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
        }
        return value;
    },

    /**
     * Add column to SELECT
     */
    addColumn() {
        if (!this.state.query.from) {
            AdminComponentsV2.toast({
                type: 'warning',
                message: 'Please select a table first'
            });
            return;
        }

        const columns = this.state.columns[this.state.query.from] || [];

        const modal = AdminComponentsV2.modal({
            title: 'Add Column',
            content: `
                <div class="form-group">
                    <label>Select Column</label>
                    <select id="column-select" class="form-control">
                        ${columns.map(col => `
                            <option value="${col.name}">${col.name} (${col.type})</option>
                        `).join('')}
                    </select>
                </div>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Add',
                    variant: 'primary',
                    onClick: () => {
                        const columnName = document.getElementById('column-select').value;
                        this.state.query.select.push(columnName);
                        modal.close();
                        this.updateUI();
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Remove column from SELECT
     */
    removeColumn(index) {
        this.state.query.select.splice(index, 1);
        this.updateUI();
    },

    /**
     * Set FROM table
     */
    setFromTable(tableName) {
        this.state.query.from = tableName;
        // Reset select if changing table
        if (tableName !== this.state.query.from) {
            this.state.query.select = [];
        }
        this.updateUI();
    },

    /**
     * Add WHERE condition
     */
    addCondition() {
        if (!this.state.query.from) {
            AdminComponentsV2.toast({
                type: 'warning',
                message: 'Please select a table first'
            });
            return;
        }

        const columns = this.state.columns[this.state.query.from] || [];

        const modal = AdminComponentsV2.modal({
            title: 'Add Condition',
            content: `
                <div class="form-group">
                    <label>Column</label>
                    <select id="condition-column" class="form-control">
                        ${columns.map(col => `
                            <option value="${col.name}">${col.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Operator</label>
                    <select id="condition-operator" class="form-control">
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">></option>
                        <option value="<"><</option>
                        <option value=">=">>=</option>
                        <option value="<="><=</option>
                        <option value="LIKE">LIKE</option>
                        <option value="IN">IN</option>
                        <option value="IS NULL">IS NULL</option>
                        <option value="IS NOT NULL">IS NOT NULL</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Value</label>
                    <input type="text" id="condition-value" class="form-control" placeholder="Value">
                </div>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Add',
                    variant: 'primary',
                    onClick: () => {
                        const column = document.getElementById('condition-column').value;
                        const operator = document.getElementById('condition-operator').value;
                        const value = document.getElementById('condition-value').value;

                        this.state.query.where.push({ column, operator, value });
                        modal.close();
                        this.updateUI();
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Remove WHERE condition
     */
    removeCondition(index) {
        this.state.query.where.splice(index, 1);
        this.updateUI();
    },

    /**
     * Add ORDER BY
     */
    addOrder() {
        if (!this.state.query.from) {
            AdminComponentsV2.toast({
                type: 'warning',
                message: 'Please select a table first'
            });
            return;
        }

        const columns = this.state.columns[this.state.query.from] || [];

        const modal = AdminComponentsV2.modal({
            title: 'Add Order',
            content: `
                <div class="form-group">
                    <label>Column</label>
                    <select id="order-column" class="form-control">
                        ${columns.map(col => `
                            <option value="${col.name}">${col.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Direction</label>
                    <select id="order-direction" class="form-control">
                        <option value="ASC">Ascending (ASC)</option>
                        <option value="DESC">Descending (DESC)</option>
                    </select>
                </div>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Add',
                    variant: 'primary',
                    onClick: () => {
                        const column = document.getElementById('order-column').value;
                        const direction = document.getElementById('order-direction').value;

                        this.state.query.orderBy.push({ column, direction });
                        modal.close();
                        this.updateUI();
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Remove ORDER BY
     */
    removeOrder(index) {
        this.state.query.orderBy.splice(index, 1);
        this.updateUI();
    },

    /**
     * Update LIMIT
     */
    updateLimit(value) {
        this.state.query.limit = value ? parseInt(value) : null;
        this.updateUI();
    },

    /**
     * Update UI after query changes
     */
    updateUI() {
        document.getElementById('select-section').innerHTML = this.renderSelectSection();
        document.getElementById('where-section').innerHTML = this.renderWhereSection();
        document.getElementById('order-section').innerHTML = this.renderOrderSection();
        document.getElementById('query-preview').innerHTML = this.renderQueryPreview();
    },

    /**
     * Execute query
     */
    async executeQuery() {
        const sql = this.generateSQL();

        if (!sql) {
            AdminComponentsV2.toast({
                type: 'warning',
                message: 'Please build a query first'
            });
            return;
        }

        const resultsContainer = document.getElementById('query-results');
        resultsContainer.innerHTML = AdminComponentsV2.skeleton({ type: 'table', rows: 5 });

        try {
            const response = await fetch('/api/admin/database/execute-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });

            if (!response.ok) {
                throw new Error('Query execution failed');
            }

            const data = await response.json();
            this.state.results = data;

            // Add to history
            this.state.history.unshift({
                sql,
                timestamp: Date.now(),
                rowCount: data.rows?.length || 0
            });

            // Render results
            this.renderResults(data);

            AdminComponentsV2.toast({
                type: 'success',
                message: `Query executed successfully! ${data.rows?.length || 0} rows returned`
            });
        } catch (error) {
            console.error('[QueryBuilder] Error executing query:', error);
            resultsContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-state-icon">⚠️</div>
                    <div class="error-state-title">Query Failed</div>
                    <div class="error-state-message">${error.message}</div>
                </div>
            `;
            AdminComponentsV2.toast({
                type: 'error',
                message: `Query failed: ${error.message}`
            });
        }
    },

    /**
     * Render query results
     */
    renderResults(data) {
        const resultsContainer = document.getElementById('query-results');

        if (!data.rows || data.rows.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">No Results</div>
                    <div class="empty-state-message">Query returned no rows</div>
                </div>
            `;
            return;
        }

        // Use AdminTablesV2 for results display
        const columns = Object.keys(data.rows[0]).map(key => ({
            key,
            label: key,
            sortable: true
        }));

        resultsContainer.innerHTML = '<div id="results-table"></div>';

        AdminTablesV2.create('results-table', {
            columns,
            data: data.rows,
            sortable: true,
            filterable: true,
            exportable: true,
            pageSize: 50
        });
    },

    /**
     * Copy SQL to clipboard
     */
    copyQuery() {
        const sql = this.generateSQL();
        if (!sql) return;

        navigator.clipboard.writeText(sql).then(() => {
            AdminComponentsV2.toast({
                type: 'success',
                message: 'SQL copied to clipboard',
                duration: 2000
            });
        });
    },

    /**
     * Save query as template
     */
    saveTemplate() {
        const sql = this.generateSQL();
        if (!sql) return;

        const modal = AdminComponentsV2.modal({
            title: 'Save Query Template',
            content: `
                <div class="form-group">
                    <label>Template Name</label>
                    <input type="text" id="template-name" class="form-control" placeholder="My Query">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="template-description" class="form-control" rows="3"></textarea>
                </div>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Save',
                    variant: 'primary',
                    onClick: () => {
                        const name = document.getElementById('template-name').value;
                        const description = document.getElementById('template-description').value;

                        this.state.templates.push({
                            name,
                            description,
                            query: { ...this.state.query },
                            sql
                        });

                        AdminComponentsV2.toast({
                            type: 'success',
                            message: 'Template saved'
                        });

                        modal.close();
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Load query template
     */
    loadTemplate() {
        if (this.state.templates.length === 0) {
            AdminComponentsV2.toast({
                type: 'info',
                message: 'No saved templates'
            });
            return;
        }

        const modal = AdminComponentsV2.modal({
            title: 'Load Template',
            content: `
                <div class="templates-list">
                    ${this.state.templates.map((template, index) => `
                        <div class="template-item" onclick="AdminQueryBuilder.applyTemplate(${index})">
                            <strong>${template.name}</strong>
                            <p>${template.description || 'No description'}</p>
                            <code>${template.sql}</code>
                        </div>
                    `).join('')}
                </div>
            `,
            size: 'large'
        });

        modal.show();
    },

    /**
     * Apply template
     */
    applyTemplate(index) {
        const template = this.state.templates[index];
        this.state.query = { ...template.query };
        this.updateUI();

        AdminComponentsV2.toast({
            type: 'success',
            message: 'Template loaded'
        });
    },

    /**
     * Show query history
     */
    showHistory() {
        if (this.state.history.length === 0) {
            AdminComponentsV2.toast({
                type: 'info',
                message: 'No query history'
            });
            return;
        }

        const modal = AdminComponentsV2.modal({
            title: 'Query History',
            content: `
                <div class="history-list">
                    ${this.state.history.map((item, index) => `
                        <div class="history-item">
                            <div class="history-meta">
                                <span>${new Date(item.timestamp).toLocaleString()}</span>
                                <span>${item.rowCount} rows</span>
                            </div>
                            <code>${item.sql}</code>
                        </div>
                    `).join('')}
                </div>
            `,
            size: 'large'
        });

        modal.show();
    },

    /**
     * Reset query
     */
    resetQuery() {
        this.state.query = {
            select: [],
            from: null,
            joins: [],
            where: [],
            groupBy: [],
            orderBy: [],
            limit: null
        };

        this.render();

        AdminComponentsV2.toast({
            type: 'info',
            message: 'Query reset'
        });
    }
};

// Make available globally
window.AdminQueryBuilder = AdminQueryBuilder;
