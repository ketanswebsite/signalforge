/**
 * Admin Schema Viewer - Database Schema Visualization
 * Phase 5: Advanced Features
 *
 * Features:
 * - Visual database schema representation
 * - Table details (columns, types, constraints, indexes)
 * - Foreign key relationships
 * - Search and filter tables/columns
 * - Export schema documentation
 * - Interactive ERD (Entity-Relationship Diagram)
 *
 * Dependencies: AdminComponentsV2, AdminTablesV2
 */

const AdminSchemaViewer = {
    // State management
    state: {
        tables: [],
        selectedTable: null,
        relationships: [],
        searchQuery: '',
        viewMode: 'list' // 'list' or 'erd'
    },

    /**
     * Initialize schema viewer
     */
    async init() {
        console.log('[SchemaViewer] Initializing schema viewer...');

        try {
            await this.loadSchema();
            console.log('[SchemaViewer] Schema viewer initialized');
        } catch (error) {
            console.error('[SchemaViewer] Failed to initialize:', error);
        }
    },

    /**
     * Load database schema
     */
    async loadSchema() {
        try {
            const response = await fetch('/api/admin/database/schema');

            if (!response.ok) {
                throw new Error('Failed to load schema');
            }

            const data = await response.json();
            this.state.tables = data.tables || [];
            this.state.relationships = data.relationships || [];

            console.log(`[SchemaViewer] Loaded ${this.state.tables.length} tables`);
        } catch (error) {
            console.error('[SchemaViewer] Error loading schema:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to load schema: ${error.message}`
            });
        }
    },

    /**
     * Show schema viewer UI
     * @param {string} containerId - Container element ID
     */
    async showSchemaViewer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Load schema if not already loaded
        if (this.state.tables.length === 0) {
            await this.loadSchema();
        }

        container.innerHTML = `
            <div class="schema-viewer-container">
                <!-- Header with controls -->
                <div class="schema-viewer-header">
                    <div class="schema-viewer-title">
                        <h2>🗄️ Database Schema</h2>
                        <span class="schema-stats">
                            ${this.state.tables.length} tables
                        </span>
                    </div>

                    <div class="schema-viewer-controls">
                        <!-- Search -->
                        <div class="schema-search">
                            <input type="text"
                                   id="schema-search-input"
                                   placeholder="Search tables, columns..."
                                   value="${this.state.searchQuery}"
                                   oninput="AdminSchemaViewer.handleSearch(this.value)">
                            <span class="search-icon">🔍</span>
                        </div>

                        <!-- View Mode Toggle -->
                        <div class="view-mode-toggle">
                            <button class="btn btn-sm ${this.state.viewMode === 'list' ? 'active' : ''}"
                                    onclick="AdminSchemaViewer.setViewMode('list')"
                                    title="List View">
                                📋
                            </button>
                            <button class="btn btn-sm ${this.state.viewMode === 'erd' ? 'active' : ''}"
                                    onclick="AdminSchemaViewer.setViewMode('erd')"
                                    title="ERD View">
                                🔗
                            </button>
                        </div>

                        <!-- Actions -->
                        <button class="btn btn-primary btn-sm"
                                onclick="AdminSchemaViewer.exportSchema()">
                            📥 Export Schema
                        </button>
                        <button class="btn btn-secondary btn-sm"
                                onclick="AdminSchemaViewer.refreshSchema()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="schema-viewer-content">
                    ${this.state.viewMode === 'list'
                        ? this.renderListView()
                        : this.renderERDView()}
                </div>

                <!-- Details Panel -->
                <div class="schema-details-panel" id="schema-details-panel" style="display: none;">
                    <!-- Table details will be rendered here -->
                </div>
            </div>
        `;
    },

    /**
     * Render list view of tables
     */
    renderListView() {
        const filteredTables = this.filterTables();

        return `
            <div class="schema-list-view">
                <div class="tables-grid">
                    ${filteredTables.map(table => this.renderTableCard(table)).join('')}
                </div>

                ${filteredTables.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <h3>No tables found</h3>
                        <p>Try adjusting your search query</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render table card
     */
    renderTableCard(table) {
        const columnCount = table.columns?.length || 0;
        const hasIndexes = table.indexes?.length > 0;
        const hasForeignKeys = table.foreignKeys?.length > 0;
        const primaryKey = table.columns?.find(col => col.isPrimaryKey);

        return `
            <div class="table-card" onclick="AdminSchemaViewer.showTableDetails('${table.name}')">
                <div class="table-card-header">
                    <h3 class="table-name">${table.name}</h3>
                    ${table.comment ? `<p class="table-comment">${table.comment}</p>` : ''}
                </div>

                <div class="table-card-body">
                    <div class="table-stats">
                        <div class="table-stat">
                            <span class="stat-label">Columns</span>
                            <span class="stat-value">${columnCount}</span>
                        </div>
                        ${table.rowCount !== undefined ? `
                            <div class="table-stat">
                                <span class="stat-label">Rows</span>
                                <span class="stat-value">${table.rowCount.toLocaleString()}</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="table-features">
                        ${primaryKey ? `<span class="feature-badge">🔑 PK: ${primaryKey.name}</span>` : ''}
                        ${hasIndexes ? `<span class="feature-badge">📇 ${table.indexes.length} indexes</span>` : ''}
                        ${hasForeignKeys ? `<span class="feature-badge">🔗 ${table.foreignKeys.length} FK</span>` : ''}
                    </div>
                </div>

                <div class="table-card-footer">
                    <span class="table-size">${table.size || 'Unknown size'}</span>
                    <button class="btn-icon" onclick="event.stopPropagation(); AdminSchemaViewer.showTableDetails('${table.name}')" title="View Details">
                        →
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render ERD view
     */
    renderERDView() {
        const filteredTables = this.filterTables();

        return `
            <div class="schema-erd-view">
                <div class="erd-canvas" id="erd-canvas">
                    <svg id="erd-svg" width="100%" height="100%">
                        <!-- Relationship lines will be drawn here -->
                        <g id="erd-relationships"></g>
                        <!-- Tables will be positioned here -->
                        <g id="erd-tables"></g>
                    </svg>

                    <!-- HTML overlays for table boxes -->
                    <div class="erd-tables-overlay" id="erd-tables-overlay">
                        ${filteredTables.map((table, index) => this.renderERDTable(table, index)).join('')}
                    </div>
                </div>

                ${filteredTables.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <h3>No tables found</h3>
                        <p>Try adjusting your search query</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render ERD table box
     */
    renderERDTable(table, index) {
        const columnCount = Math.min(table.columns?.length || 0, 5);
        const displayColumns = table.columns?.slice(0, 5) || [];
        const remainingCount = (table.columns?.length || 0) - 5;

        // Position tables in a grid layout
        const tablesPerRow = 3;
        const row = Math.floor(index / tablesPerRow);
        const col = index % tablesPerRow;
        const x = 50 + col * 350;
        const y = 50 + row * 250;

        return `
            <div class="erd-table"
                 id="erd-table-${table.name}"
                 data-table="${table.name}"
                 style="left: ${x}px; top: ${y}px;"
                 onclick="AdminSchemaViewer.showTableDetails('${table.name}')">
                <div class="erd-table-header">
                    <h4>${table.name}</h4>
                </div>
                <div class="erd-table-body">
                    ${displayColumns.map(col => `
                        <div class="erd-column ${col.isPrimaryKey ? 'primary-key' : ''} ${col.isForeignKey ? 'foreign-key' : ''}">
                            <span class="column-name">${col.name}</span>
                            <span class="column-type">${col.type}</span>
                        </div>
                    `).join('')}
                    ${remainingCount > 0 ? `
                        <div class="erd-column-more">
                            +${remainingCount} more columns
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Show table details in side panel
     */
    async showTableDetails(tableName) {
        const table = this.state.tables.find(t => t.name === tableName);
        if (!table) return;

        this.state.selectedTable = tableName;

        const panel = document.getElementById('schema-details-panel');
        if (!panel) return;

        panel.style.display = 'block';
        panel.innerHTML = `
            <div class="schema-details-header">
                <h3>📋 ${tableName}</h3>
                <button class="btn-icon" onclick="AdminSchemaViewer.closeDetailsPanel()" title="Close">
                    ✕
                </button>
            </div>

            <div class="schema-details-body">
                <!-- Table Info -->
                <div class="detail-section">
                    <h4>Table Information</h4>
                    ${table.comment ? `<p class="table-description">${table.comment}</p>` : ''}
                    <div class="detail-stats">
                        <div class="detail-stat">
                            <span class="label">Columns:</span>
                            <span class="value">${table.columns?.length || 0}</span>
                        </div>
                        ${table.rowCount !== undefined ? `
                            <div class="detail-stat">
                                <span class="label">Rows:</span>
                                <span class="value">${table.rowCount.toLocaleString()}</span>
                            </div>
                        ` : ''}
                        ${table.size ? `
                            <div class="detail-stat">
                                <span class="label">Size:</span>
                                <span class="value">${table.size}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Columns -->
                <div class="detail-section">
                    <h4>Columns (${table.columns?.length || 0})</h4>
                    <div class="columns-table">
                        ${this.renderColumnsTable(table.columns || [])}
                    </div>
                </div>

                <!-- Indexes -->
                ${table.indexes && table.indexes.length > 0 ? `
                    <div class="detail-section">
                        <h4>Indexes (${table.indexes.length})</h4>
                        <div class="indexes-list">
                            ${table.indexes.map(idx => `
                                <div class="index-item">
                                    <div class="index-name">
                                        ${idx.isPrimary ? '🔑' : '📇'} ${idx.name}
                                    </div>
                                    <div class="index-columns">
                                        ${idx.columns.join(', ')}
                                    </div>
                                    <div class="index-type">
                                        ${idx.type} ${idx.isUnique ? '(Unique)' : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Foreign Keys -->
                ${table.foreignKeys && table.foreignKeys.length > 0 ? `
                    <div class="detail-section">
                        <h4>Foreign Keys (${table.foreignKeys.length})</h4>
                        <div class="foreign-keys-list">
                            ${table.foreignKeys.map(fk => `
                                <div class="foreign-key-item">
                                    <div class="fk-constraint">
                                        <strong>${fk.name}</strong>
                                    </div>
                                    <div class="fk-relationship">
                                        ${fk.column} →
                                        <a href="#" onclick="AdminSchemaViewer.showTableDetails('${fk.referencedTable}'); return false;">
                                            ${fk.referencedTable}.${fk.referencedColumn}
                                        </a>
                                    </div>
                                    ${fk.onDelete || fk.onUpdate ? `
                                        <div class="fk-rules">
                                            ${fk.onDelete ? `ON DELETE ${fk.onDelete}` : ''}
                                            ${fk.onUpdate ? `ON UPDATE ${fk.onUpdate}` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Referenced By -->
                ${this.getReferencingTables(tableName).length > 0 ? `
                    <div class="detail-section">
                        <h4>Referenced By</h4>
                        <div class="references-list">
                            ${this.getReferencingTables(tableName).map(ref => `
                                <div class="reference-item">
                                    <a href="#" onclick="AdminSchemaViewer.showTableDetails('${ref.table}'); return false;">
                                        ${ref.table}
                                    </a>
                                    <span class="ref-details">via ${ref.column}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div class="detail-section">
                    <div class="detail-actions">
                        <button class="btn btn-secondary btn-sm"
                                onclick="AdminSchemaViewer.openQueryBuilder('${tableName}')">
                            🔍 Query Table
                        </button>
                        <button class="btn btn-secondary btn-sm"
                                onclick="AdminSchemaViewer.exportTableSchema('${tableName}')">
                            📥 Export Schema
                        </button>
                        <button class="btn btn-secondary btn-sm"
                                onclick="AdminSchemaViewer.viewTableData('${tableName}')">
                            👁️ View Data
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Scroll to panel on mobile
        if (window.innerWidth < 768) {
            panel.scrollIntoView({ behavior: 'smooth' });
        }
    },

    /**
     * Render columns table
     */
    renderColumnsTable(columns) {
        if (!columns || columns.length === 0) {
            return '<p class="text-muted">No columns</p>';
        }

        return `
            <table class="schema-columns-table">
                <thead>
                    <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Default</th>
                        <th>Extra</th>
                    </tr>
                </thead>
                <tbody>
                    ${columns.map(col => `
                        <tr class="${col.isPrimaryKey ? 'primary-key-row' : ''}">
                            <td>
                                <div class="column-name-cell">
                                    ${col.isPrimaryKey ? '<span class="badge badge-primary">PK</span>' : ''}
                                    ${col.isForeignKey ? '<span class="badge badge-secondary">FK</span>' : ''}
                                    <span class="column-name">${col.name}</span>
                                </div>
                                ${col.comment ? `<div class="column-comment">${col.comment}</div>` : ''}
                            </td>
                            <td><code>${col.type}</code></td>
                            <td>${col.nullable ? '✓' : '✗'}</td>
                            <td>${col.default !== null ? `<code>${col.default}</code>` : '—'}</td>
                            <td>${col.extra || '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Get tables that reference this table
     */
    getReferencingTables(tableName) {
        const references = [];

        this.state.tables.forEach(table => {
            if (table.foreignKeys) {
                table.foreignKeys.forEach(fk => {
                    if (fk.referencedTable === tableName) {
                        references.push({
                            table: table.name,
                            column: fk.column,
                            referencedColumn: fk.referencedColumn
                        });
                    }
                });
            }
        });

        return references;
    },

    /**
     * Close details panel
     */
    closeDetailsPanel() {
        const panel = document.getElementById('schema-details-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        this.state.selectedTable = null;
    },

    /**
     * Filter tables based on search query
     */
    filterTables() {
        if (!this.state.searchQuery) {
            return this.state.tables;
        }

        const query = this.state.searchQuery.toLowerCase();

        return this.state.tables.filter(table => {
            // Search in table name
            if (table.name.toLowerCase().includes(query)) {
                return true;
            }

            // Search in table comment
            if (table.comment && table.comment.toLowerCase().includes(query)) {
                return true;
            }

            // Search in column names
            if (table.columns) {
                return table.columns.some(col =>
                    col.name.toLowerCase().includes(query) ||
                    (col.comment && col.comment.toLowerCase().includes(query))
                );
            }

            return false;
        });
    },

    /**
     * Handle search input
     */
    handleSearch(query) {
        this.state.searchQuery = query;

        // Re-render the appropriate view
        const content = document.querySelector('.schema-viewer-content');
        if (content) {
            content.innerHTML = this.state.viewMode === 'list'
                ? this.renderListView()
                : this.renderERDView();
        }

        // Draw ERD if in ERD mode
        if (this.state.viewMode === 'erd') {
            setTimeout(() => this.drawERDRelationships(), 100);
        }
    },

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.state.viewMode = mode;

        // Re-render
        const content = document.querySelector('.schema-viewer-content');
        if (content) {
            content.innerHTML = mode === 'list'
                ? this.renderListView()
                : this.renderERDView();
        }

        // Update toggle buttons
        document.querySelectorAll('.view-mode-toggle .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Draw ERD if switching to ERD mode
        if (mode === 'erd') {
            setTimeout(() => this.drawERDRelationships(), 100);
        }
    },

    /**
     * Draw relationship lines in ERD
     */
    drawERDRelationships() {
        const svg = document.getElementById('erd-svg');
        const relationshipsGroup = document.getElementById('erd-relationships');
        if (!svg || !relationshipsGroup) return;

        // Clear existing lines
        relationshipsGroup.innerHTML = '';

        // Draw lines for each foreign key relationship
        this.state.tables.forEach(table => {
            if (!table.foreignKeys) return;

            table.foreignKeys.forEach(fk => {
                const sourceEl = document.getElementById(`erd-table-${table.name}`);
                const targetEl = document.getElementById(`erd-table-${fk.referencedTable}`);

                if (sourceEl && targetEl) {
                    const sourceRect = sourceEl.getBoundingClientRect();
                    const targetRect = targetEl.getBoundingClientRect();
                    const canvasRect = svg.getBoundingClientRect();

                    const x1 = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
                    const y1 = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
                    const x2 = targetRect.left + targetRect.width / 2 - canvasRect.left;
                    const y2 = targetRect.top + targetRect.height / 2 - canvasRect.top;

                    // Create curved path
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const path = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    line.setAttribute('d', path);
                    line.setAttribute('class', 'erd-relationship-line');
                    line.setAttribute('stroke', 'var(--border-color)');
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('fill', 'none');
                    line.setAttribute('marker-end', 'url(#arrow)');

                    relationshipsGroup.appendChild(line);
                }
            });
        });

        // Add arrow marker definition if not exists
        if (!svg.querySelector('#arrow')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="var(--border-color)" />
                </marker>
            `;
            svg.insertBefore(defs, svg.firstChild);
        }
    },

    /**
     * Refresh schema from server
     */
    async refreshSchema() {
        AdminComponentsV2.toast({
            type: 'info',
            message: 'Refreshing schema...'
        });

        await this.loadSchema();

        // Re-render current view
        const containerId = document.querySelector('.schema-viewer-container')?.parentElement?.id;
        if (containerId) {
            await this.showSchemaViewer(containerId);
        }

        AdminComponentsV2.toast({
            type: 'success',
            message: 'Schema refreshed successfully'
        });
    },

    /**
     * Export entire schema
     */
    async exportSchema() {
        const format = await new Promise(resolve => {
            const modal = AdminComponentsV2.modal({
                title: 'Export Schema',
                content: `
                    <div class="export-format-selection">
                        <p>Select export format:</p>
                        <div class="format-options">
                            <label class="format-option">
                                <input type="radio" name="export-format" value="json" checked>
                                <span>JSON (Complete)</span>
                            </label>
                            <label class="format-option">
                                <input type="radio" name="export-format" value="markdown">
                                <span>Markdown (Documentation)</span>
                            </label>
                            <label class="format-option">
                                <input type="radio" name="export-format" value="sql">
                                <span>SQL (DDL)</span>
                            </label>
                        </div>
                    </div>
                `,
                actions: [
                    { text: 'Cancel', variant: 'secondary', onClick: () => { modal.close(); resolve(null); } },
                    {
                        text: 'Export',
                        variant: 'primary',
                        onClick: () => {
                            const selected = document.querySelector('input[name="export-format"]:checked');
                            modal.close();
                            resolve(selected ? selected.value : 'json');
                        }
                    }
                ]
            });
            modal.show();
        });

        if (!format) return;

        let content, filename, mimeType;

        if (format === 'json') {
            content = JSON.stringify({
                tables: this.state.tables,
                relationships: this.state.relationships,
                exportedAt: new Date().toISOString()
            }, null, 2);
            filename = `database-schema-${Date.now()}.json`;
            mimeType = 'application/json';
        } else if (format === 'markdown') {
            content = this.generateMarkdownSchema();
            filename = `database-schema-${Date.now()}.md`;
            mimeType = 'text/markdown';
        } else if (format === 'sql') {
            content = this.generateSQLSchema();
            filename = `database-schema-${Date.now()}.sql`;
            mimeType = 'text/plain';
        }

        // Download file
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);

        AdminComponentsV2.toast({
            type: 'success',
            message: `Schema exported as ${format.toUpperCase()}`
        });
    },

    /**
     * Generate markdown documentation
     */
    generateMarkdownSchema() {
        let md = `# Database Schema Documentation\n\n`;
        md += `Generated: ${new Date().toLocaleString()}\n\n`;
        md += `Total Tables: ${this.state.tables.length}\n\n`;
        md += `---\n\n`;

        this.state.tables.forEach(table => {
            md += `## ${table.name}\n\n`;

            if (table.comment) {
                md += `${table.comment}\n\n`;
            }

            md += `### Columns\n\n`;
            md += `| Column | Type | Nullable | Default | Extra |\n`;
            md += `|--------|------|----------|---------|-------|\n`;

            (table.columns || []).forEach(col => {
                md += `| ${col.isPrimaryKey ? '🔑 ' : ''}${col.isForeignKey ? '🔗 ' : ''}**${col.name}** `;
                md += `| ${col.type} `;
                md += `| ${col.nullable ? 'Yes' : 'No'} `;
                md += `| ${col.default !== null ? col.default : '—'} `;
                md += `| ${col.extra || '—'} |\n`;
            });

            if (table.indexes && table.indexes.length > 0) {
                md += `\n### Indexes\n\n`;
                table.indexes.forEach(idx => {
                    md += `- **${idx.name}**: ${idx.columns.join(', ')} (${idx.type}${idx.isUnique ? ', Unique' : ''})\n`;
                });
            }

            if (table.foreignKeys && table.foreignKeys.length > 0) {
                md += `\n### Foreign Keys\n\n`;
                table.foreignKeys.forEach(fk => {
                    md += `- **${fk.name}**: ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
                });
            }

            md += `\n---\n\n`;
        });

        return md;
    },

    /**
     * Generate SQL DDL
     */
    generateSQLSchema() {
        let sql = `-- Database Schema\n`;
        sql += `-- Generated: ${new Date().toLocaleString()}\n\n`;

        this.state.tables.forEach(table => {
            sql += `-- Table: ${table.name}\n`;
            sql += `CREATE TABLE ${table.name} (\n`;

            const columnDefs = (table.columns || []).map(col => {
                let def = `  ${col.name} ${col.type}`;
                if (!col.nullable) def += ' NOT NULL';
                if (col.default !== null) def += ` DEFAULT ${col.default}`;
                if (col.extra) def += ` ${col.extra}`;
                return def;
            });

            sql += columnDefs.join(',\n');

            // Add primary key
            const pkColumns = (table.columns || []).filter(col => col.isPrimaryKey);
            if (pkColumns.length > 0) {
                sql += `,\n  PRIMARY KEY (${pkColumns.map(col => col.name).join(', ')})`;
            }

            sql += `\n);\n\n`;

            // Add indexes
            if (table.indexes) {
                table.indexes.forEach(idx => {
                    if (!idx.isPrimary) {
                        sql += `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${idx.name} ON ${table.name} (${idx.columns.join(', ')});\n`;
                    }
                });
                sql += `\n`;
            }

            // Add foreign keys
            if (table.foreignKeys) {
                table.foreignKeys.forEach(fk => {
                    sql += `ALTER TABLE ${table.name} ADD CONSTRAINT ${fk.name}\n`;
                    sql += `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`;
                    if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
                    if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`;
                    sql += `;\n`;
                });
                sql += `\n`;
            }
        });

        return sql;
    },

    /**
     * Export single table schema
     */
    exportTableSchema(tableName) {
        const table = this.state.tables.find(t => t.name === tableName);
        if (!table) return;

        const content = JSON.stringify(table, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tableName}-schema-${Date.now()}.json`;
        link.click();
        window.URL.revokeObjectURL(url);

        AdminComponentsV2.toast({
            type: 'success',
            message: `${tableName} schema exported`
        });
    },

    /**
     * Open query builder for table
     */
    openQueryBuilder(tableName) {
        if (window.AdminQueryBuilder) {
            // Close details panel
            this.closeDetailsPanel();

            // Navigate to query builder tab (assuming it exists)
            // This would need to be integrated with your tab navigation
            AdminComponentsV2.toast({
                type: 'info',
                message: `Opening query builder for ${tableName}...`
            });

            // Set the FROM table in query builder
            if (AdminQueryBuilder.state) {
                AdminQueryBuilder.state.query.from = tableName;
                AdminQueryBuilder.state.query.select = [];
                AdminQueryBuilder.state.query.where = [];
            }
        } else {
            AdminComponentsV2.toast({
                type: 'error',
                message: 'Query builder not available'
            });
        }
    },

    /**
     * View table data
     */
    async viewTableData(tableName) {
        AdminComponentsV2.toast({
            type: 'info',
            message: `Loading data from ${tableName}...`
        });

        try {
            const response = await fetch('/api/admin/database/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `SELECT * FROM ${tableName} LIMIT 100`
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();

            // Show data in modal using AdminTablesV2
            const modal = AdminComponentsV2.modal({
                title: `📊 ${tableName} Data (First 100 rows)`,
                content: `<div id="table-data-preview"></div>`,
                size: 'large'
            });

            modal.show();

            // Render table in modal
            setTimeout(() => {
                if (window.AdminTablesV2) {
                    AdminTablesV2.create('table-data-preview', {
                        data: data.rows || [],
                        pagination: { enabled: true, pageSize: 25 },
                        search: { enabled: true },
                        export: { enabled: true }
                    });
                }
            }, 100);
        } catch (error) {
            console.error('[SchemaViewer] Error viewing table data:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to load data: ${error.message}`
            });
        }
    }
};

// Make available globally
window.AdminSchemaViewer = AdminSchemaViewer;
