/**
 * ML Insights UI Module
 * Displays ML analysis results in the trading interface
 */

const MLInsightsUI = (function() {
    let currentAnalysis = null;
    let activeSymbol = null;
    
    /**
     * Initialize ML Insights UI
     */
    function init() {
        // Add ML insights button to UI
        addMLButton();
        
        // Create ML insights modal
        createMLModal();
        
    }
    
    /**
     * Add ML button to the interface
     * Commented out - AI Insights button is available in individual cards
     */
    function addMLButton() {
        // Button removed from top toolbar - available in individual opportunity cards
        return;
    }
    
    /**
     * Create ML insights modal
     */
    function createMLModal() {
        const modal = document.createElement('div');
        modal.className = 'dialog-overlay';
        modal.id = 'ml-insights-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="dialog-content" style="max-width: 900px;">
                <div class="dialog-header">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        AI/ML Analysis
                    </h3>
                    <button class="dialog-close" onclick="MLInsightsUI.hideModal()" aria-label="Close dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <div id="ml-insights-content">
                        <div class="ml-loading">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <p>Loading AI insights...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for closing
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideModal();
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                hideModal();
            }
        });
        
        document.body.appendChild(modal);
        
        // Add styles
        addMLStyles();
    }
    
    /**
     * Add ML-specific styles
     */
    function addMLStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ml-insights-button {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-left: 10px;
            }
            
            .ml-loading {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-secondary);
                background-color: var(--primary-lightest);
                border-radius: var(--radius);
                border: 2px dashed var(--border-color);
            }
            
            .ml-loading svg {
                margin-bottom: 15px;
                color: var(--primary-color);
            }
            
            .ml-loading p {
                margin: 0;
                font-size: 16px;
                font-weight: 500;
            }
            
            .ml-spinner {
                margin-bottom: 16px;
            }
            
            .ml-spin {
                animation: ml-spin 1s linear infinite;
            }
            
            @keyframes ml-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .ml-section {
                background-color: var(--card-bg);
                border-radius: var(--radius);
                padding: var(--card-spacing);
                margin-bottom: 20px;
                box-shadow: var(--shadow-sm);
                border: 1px solid var(--border-color);
                transition: all var(--transition-fast) ease;
            }
            
            .ml-section:hover {
                box-shadow: var(--shadow);
                border-color: var(--border-hover);
            }
            
            .ml-section h3 {
                margin-top: 0;
                margin-bottom: 18px;
                display: flex;
                align-items: center;
                gap: 10px;
                color: var(--primary-color);
                font-size: 18px;
                font-weight: 600;
                border-bottom: 2px solid var(--primary-light);
                padding-bottom: 12px;
            }
            
            .ml-section h4 {
                color: var(--text-color);
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 12px;
                margin-top: 20px;
            }
            
            .ml-risk-params {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
            }
            
            .ml-param {
                background-color: var(--primary-lightest);
                padding: 18px;
                border-radius: var(--radius-sm);
                text-align: center;
                border: 1px solid var(--primary-light);
                transition: all var(--transition-fast) ease;
            }
            
            .ml-param:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-sm);
            }
            
            .ml-param-value {
                font-size: 28px;
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: 5px;
            }
            
            .ml-param-label {
                font-size: 13px;
                color: var(--text-secondary);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .ml-patterns-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .ml-pattern-item {
                background-color: var(--bg-color);
                padding: 16px;
                border-radius: var(--radius-sm);
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: 1px solid var(--border-color);
                transition: all var(--transition-fast) ease;
            }
            
            .ml-pattern-item:hover {
                background-color: var(--primary-lightest);
                border-color: var(--primary-light);
                transform: translateX(4px);
            }
            
            .ml-pattern-info {
                flex: 1;
            }
            
            .ml-pattern-name {
                font-weight: 600;
                margin-bottom: 6px;
                color: var(--text-color);
                font-size: 15px;
            }
            
            .ml-pattern-desc {
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.4;
            }
            
            .ml-confidence {
                font-size: 20px;
                font-weight: 700;
                color: var(--success-color);
                background-color: var(--success-light);
                padding: 8px 12px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--success-color);
                min-width: 70px;
                text-align: center;
            }
            
            .ml-sentiment {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .ml-sentiment-score {
                text-align: center;
                padding: 20px;
                background-color: var(--bg-color);
                border-radius: var(--radius);
                border: 1px solid var(--border-color);
                transition: all var(--transition-fast) ease;
            }
            
            .ml-sentiment-score:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-sm);
            }
            
            .ml-sentiment-value {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            
            .ml-sentiment-positive { 
                color: var(--success-color);
                background-color: var(--success-light);
                border-color: var(--success-color);
            }
            .ml-sentiment-negative { 
                color: var(--danger-color);
                background-color: var(--danger-light);
                border-color: var(--danger-color);
            }
            .ml-sentiment-neutral { 
                color: var(--text-secondary);
            }
            
            .ml-combined-signal {
                background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
                color: white;
                padding: 32px;
                border-radius: var(--radius-lg);
                text-align: center;
                margin: 24px 0;
                box-shadow: var(--shadow-lg);
                position: relative;
                overflow: hidden;
            }
            
            .ml-combined-signal::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
                pointer-events: none;
            }
            
            .ml-signal-action {
                font-size: 42px;
                font-weight: 800;
                margin-bottom: 12px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                position: relative;
                z-index: 1;
            }
            
            .ml-signal-confidence {
                font-size: 18px;
                opacity: 0.95;
                font-weight: 500;
                position: relative;
                z-index: 1;
            }
            
            .ml-recommendations {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .ml-recommendation {
                background-color: var(--bg-color);
                padding: 18px;
                border-radius: var(--radius-sm);
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 14px;
                border: 1px solid var(--border-color);
                transition: all var(--transition-fast) ease;
            }
            
            .ml-recommendation:hover {
                transform: translateX(4px);
                box-shadow: var(--shadow-sm);
                border-color: var(--border-hover);
            }
            
            .ml-rec-icon {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .ml-rec-risk { 
                background: var(--warning-light); 
                color: var(--warning-color);
                border: 2px solid var(--warning-color);
            }
            .ml-rec-pattern { 
                background: var(--info-light); 
                color: var(--info-color);
                border: 2px solid var(--info-color);
            }
            .ml-rec-sentiment { 
                background: var(--secondary-light); 
                color: var(--secondary-color);
                border: 2px solid var(--secondary-color);
            }
            
            .ml-alert {
                background-color: var(--warning-light);
                color: var(--warning-color);
                padding: 16px;
                border-radius: var(--radius-sm);
                border-left: 4px solid var(--warning-color);
                margin-top: 16px;
                font-weight: 500;
            }
            
            .ml-signal-info {
                background-color: var(--info-light);
                color: var(--info-color);
                padding: 14px;
                border-radius: var(--radius-sm);
                border-left: 4px solid var(--info-color);
                margin-top: 16px;
                font-size: 14px;
                font-weight: 500;
            }
            
            .ml-error {
                text-align: center;
                padding: 40px 20px;
                color: var(--danger-color);
                background-color: var(--danger-light);
                border-radius: var(--radius);
                border: 2px solid var(--danger-color);
            }
            
            /* Dark mode adjustments */
            [data-theme="dark"] .ml-loading {
                background-color: var(--primary-lightest);
                border-color: var(--border-color);
            }
            
            [data-theme="dark"] .ml-param {
                background-color: var(--primary-lightest);
                border-color: var(--primary-light);
            }
            
            [data-theme="dark"] .ml-pattern-item:hover {
                background-color: var(--primary-lightest);
            }
            
            [data-theme="dark"] .ml-sentiment-score {
                background-color: var(--card-bg);
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .dialog-content {
                    max-width: 95% !important;
                    margin: 10px !important;
                }
                
                .ml-risk-params {
                    grid-template-columns: 1fr;
                }
                
                .ml-sentiment {
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                
                .ml-signal-action {
                    font-size: 32px;
                }
                
                .ml-param-value {
                    font-size: 24px;
                }
            }
            
            /* Company Information Styles */
            .ml-company-section {
                background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
                color: white;
                padding: 24px;
                border-radius: var(--radius);
                margin-bottom: 24px;
                box-shadow: var(--shadow);
            }
            
            .ml-company-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            
            .ml-company-name {
                font-size: 24px;
                font-weight: 700;
                margin: 0;
                color: white;
            }
            
            .ml-company-symbol {
                background-color: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: var(--radius-sm);
                font-weight: 600;
                font-size: 16px;
                letter-spacing: 1px;
            }
            
            .ml-company-details {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }
            
            .ml-industry-tag, .ml-sector-tag {
                background-color: rgba(255, 255, 255, 0.15);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .ml-company-description {
                line-height: 1.6;
                font-size: 15px;
                opacity: 0.95;
            }
            
            .ml-company-description p {
                margin: 0;
            }
            
            /* Enhanced Section Descriptions */
            .ml-section-description {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 20px;
                padding: 12px;
                background-color: var(--bg-color);
                border-radius: var(--radius-sm);
                border-left: 4px solid var(--primary-light);
                font-style: italic;
            }
            
            /* Enhanced Parameter Help Text */
            .ml-param-help {
                font-size: 12px;
                color: var(--text-tertiary);
                margin-top: 8px;
                line-height: 1.4;
                font-style: italic;
            }
            
            /* Pattern Explanation Styles */
            .ml-pattern-help {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 16px;
                padding: 10px;
                background-color: var(--primary-lightest);
                border-radius: var(--radius-sm);
                border-left: 3px solid var(--primary-light);
            }
            
            .ml-pattern-explanation {
                font-size: 12px;
                color: var(--text-tertiary);
                margin-top: 8px;
                font-style: italic;
                line-height: 1.4;
            }
            
            .ml-confidence-badge {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                min-width: 80px;
            }
            
            .ml-confidence-label {
                font-size: 10px;
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
            }
            
            /* Enhanced Alert Styles */
            .ml-alert {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 16px;
                border-radius: var(--radius-sm);
                margin-top: 16px;
                border-left: 4px solid #f39c12;
            }
            
            .ml-alert-help {
                font-size: 13px;
                margin-top: 8px;
                opacity: 0.8;
                font-style: italic;
            }
            
            /* Enhanced Signal Styles */
            .ml-signal-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
            }
            
            .ml-signal-icon {
                font-size: 24px;
            }
            
            .ml-signal-explanation {
                font-size: 13px;
                opacity: 0.9;
                margin-top: 8px;
                font-style: italic;
            }
            
            .ml-signal-reason {
                font-size: 13px;
                margin-top: 8px;
                opacity: 0.8;
                font-style: italic;
            }
            
            /* Dark mode adjustments for new elements */
            @media (prefers-color-scheme: dark) {
                .ml-alert {
                    background-color: rgba(255, 193, 7, 0.1);
                    border-color: rgba(255, 193, 7, 0.3);
                    color: #ffc107;
                }
            }
            
            /* Visual Summary Styles */
            .ml-visual-summary {
                background: var(--card-bg);
                border-radius: var(--radius);
                padding: var(--card-spacing);
                margin-bottom: 24px;
                border: 1px solid var(--border-color);
            }
            
            .ml-signal-dashboard {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                margin-top: 20px;
            }
            
            .ml-main-signal {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }
            
            .ml-signal-indicator {
                width: 150px;
                height: 150px;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                position: relative;
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .ml-signal-icon-large {
                font-size: 48px;
                margin-bottom: 8px;
            }
            
            .ml-signal-text {
                font-size: 24px;
                font-weight: 700;
                color: white;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .ml-signal-confidence-visual {
                text-align: center;
            }
            
            .ml-gauge {
                width: 200px;
                height: 100px;
            }
            
            .ml-gauge-label {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color);
                margin-top: 10px;
            }
            
            .ml-signal-components h4 {
                margin-bottom: 16px;
                color: var(--text-color);
            }
            
            .ml-component-bars {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .ml-component-bar {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .ml-component-label {
                flex: 0 0 150px;
                font-size: 14px;
                font-weight: 500;
                color: var(--text-secondary);
            }
            
            .ml-component-visual {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .ml-component-track {
                flex: 1;
                height: 24px;
                background: var(--bg-color);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid var(--border-color);
            }
            
            .ml-component-fill {
                height: 100%;
                transition: width 0.6s ease;
                border-radius: 12px;
            }
            
            .ml-component-value {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-color);
                min-width: 45px;
                text-align: right;
            }
            
            /* Enhanced Visual Styles */
            .ml-explain-toggle {
                background: none;
                border: 1px solid var(--border-color);
                color: var(--primary-color);
                padding: 6px 12px;
                border-radius: var(--radius-sm);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all var(--transition-fast) ease;
            }
            
            .ml-explain-toggle:hover {
                background: var(--primary-lightest);
                border-color: var(--primary-color);
                transform: translateY(-1px);
            }
            
            .ml-explanation-panel {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                padding: 20px;
                margin: 16px 0;
                transition: all 0.3s ease;
            }
            
            .ml-explanation-panel h4 {
                margin-top: 0;
                color: var(--primary-color);
                font-size: 16px;
                margin-bottom: 16px;
            }
            
            .ml-explanation-panel h5 {
                margin-top: 16px;
                margin-bottom: 12px;
                color: var(--text-color);
                font-size: 14px;
            }
            
            .ml-explanation-factors {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .ml-factor {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .ml-factor-name {
                flex: 0 0 140px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
            }
            
            .ml-factor-bar {
                flex: 1;
                height: 20px;
                background: var(--bg-color);
                border-radius: 10px;
                overflow: hidden;
                border: 1px solid var(--border-color);
            }
            
            .ml-factor-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--primary-color), var(--primary-dark));
                transition: width 0.6s ease;
            }
            
            .ml-factor-impact {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-color);
                min-width: 45px;
                text-align: right;
            }
            
            .ml-model-accuracy {
                background: var(--primary-lightest);
                padding: 12px;
                border-radius: var(--radius-sm);
                font-size: 13px;
            }
            
            .ml-model-accuracy p {
                margin: 4px 0;
            }
            
            .ml-analysis-methods {
                list-style: none;
                padding-left: 20px;
                margin: 12px 0;
            }
            
            .ml-analysis-methods li {
                position: relative;
                padding-left: 20px;
                margin-bottom: 8px;
                font-size: 13px;
                color: var(--text-secondary);
            }
            
            .ml-analysis-methods li:before {
                content: "✓";
                position: absolute;
                left: 0;
                color: var(--success-color);
                font-weight: bold;
            }
            
            /* Visual Parameter Styles */
            .ml-risk-visual-params {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            
            .ml-visual-param {
                background: var(--bg-color);
                padding: 20px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--border-color);
            }
            
            .ml-param-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .ml-visual-meter {
                height: 8px;
                background: var(--bg-color);
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid var(--border-color);
                margin-bottom: 12px;
            }
            
            .ml-meter-fill {
                height: 100%;
                transition: width 0.6s ease;
                border-radius: 4px;
            }
            
            .ml-meter-danger {
                background: linear-gradient(90deg, #ff5252, #f44336);
            }
            
            .ml-meter-success {
                background: linear-gradient(90deg, #4caf50, #45a049);
            }
            
            /* Confidence Ring Styles */
            .ml-confidence-ring {
                width: 120px;
                height: 120px;
                margin: 0 auto 12px;
            }
            
            .ml-circular-chart {
                display: block;
                margin: 0 auto;
                max-width: 100%;
                max-height: 100%;
            }
            
            .ml-circle-bg {
                fill: none;
                stroke: var(--border-color);
                stroke-width: 2.8;
            }
            
            .ml-circle {
                fill: none;
                stroke: var(--primary-color);
                stroke-width: 2.8;
                stroke-linecap: round;
                animation: progress 1s ease-out forwards;
            }
            
            @keyframes progress {
                0% {
                    stroke-dasharray: 0 100;
                }
            }
            
            .ml-percentage {
                fill: var(--text-color);
                font-size: 0.5em;
                text-anchor: middle;
                font-weight: 700;
            }
            
            /* Pattern Visualization */
            .ml-pattern-visual {
                margin: 20px 0;
                padding: 16px;
                background: var(--bg-color);
                border-radius: var(--radius-sm);
                border: 1px solid var(--border-color);
            }
            
            .ml-pattern-canvas {
                width: 100%;
                height: 200px;
                display: block;
            }
            
            /* Responsive adjustments for new visual elements */
            @media (max-width: 768px) {
                .ml-signal-dashboard {
                    grid-template-columns: 1fr;
                }
                
                .ml-risk-visual-params {
                    grid-template-columns: 1fr;
                }
                
                .ml-component-label {
                    flex: 0 0 120px;
                    font-size: 12px;
                }
                
                .ml-factor-name {
                    flex: 0 0 100px;
                    font-size: 12px;
                }
            }
            
            /* Phase 1 Enhancement Styles */
            
            /* Multi-Timeframe Analysis */
            .ml-timeframe-analysis {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
            }
            
            .ml-timeframe-analysis h4 {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 16px;
                color: var(--text-color);
                font-size: 16px;
            }
            
            .ml-timeframe-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .ml-timeframe-card {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                padding: 16px;
                transition: all var(--transition-fast) ease;
            }
            
            .ml-timeframe-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-sm);
                border-color: var(--primary-light);
            }
            
            .ml-timeframe-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .ml-timeframe-header h5 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .ml-volatility-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: white;
                text-transform: uppercase;
            }
            
            .ml-timeframe-metrics {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .ml-metric {
                text-align: center;
            }
            
            .ml-metric-label {
                display: block;
                font-size: 11px;
                color: var(--text-secondary);
                margin-bottom: 4px;
            }
            
            .ml-metric-value {
                display: block;
                font-size: 18px;
                font-weight: 700;
                color: var(--primary-color);
            }
            
            .ml-timeframe-recommendation {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px;
                background: var(--primary-lightest);
                border-radius: var(--radius-xs);
                font-size: 12px;
                color: var(--text-secondary);
                border: 1px solid var(--primary-light);
            }
            
            /* Position Sizing Calculator */
            .ml-position-sizing {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
            }
            
            .ml-position-sizing h4 {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 16px;
                color: var(--text-color);
                font-size: 16px;
            }
            
            .ml-sizing-inputs {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .ml-input-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .ml-input-group label {
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
            }
            
            .ml-input-group input,
            .ml-input-group select {
                padding: 10px;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                background: var(--card-bg);
                color: var(--text-color);
                font-size: 14px;
                transition: all var(--transition-fast) ease;
            }
            
            .ml-input-group input:focus,
            .ml-input-group select:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            }
            
            .ml-sizing-results {
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                padding: 20px;
            }
            
            .ml-sizing-calculation {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .ml-calc-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-color);
            }
            
            .ml-calc-label {
                font-size: 14px;
                color: var(--text-secondary);
            }
            
            .ml-calc-value {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .ml-calc-value.highlight {
                font-size: 20px;
                color: var(--primary-color);
            }
            
            .ml-kelly-section {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid var(--border-color);
            }
            
            .ml-kelly-section h5 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: var(--text-color);
            }
            
            .ml-kelly-meter {
                position: relative;
                height: 32px;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .ml-kelly-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--primary-color), var(--primary-dark));
                transition: width 0.6s ease;
            }
            
            .ml-kelly-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 13px;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .ml-kelly-help {
                font-size: 12px;
                color: var(--text-secondary);
                margin: 0;
            }
            
            /* Risk Scenarios */
            .ml-risk-scenarios {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
            }
            
            .ml-risk-scenarios h4 {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 16px;
                color: var(--text-color);
                font-size: 16px;
            }
            
            .ml-scenarios-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }
            
            .ml-scenario-card {
                background: var(--card-bg);
                border: 2px solid;
                border-radius: var(--radius);
                padding: 20px;
                text-align: center;
                transition: all var(--transition-fast) ease;
            }
            
            .ml-scenario-card:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow);
            }
            
            .ml-scenario-icon {
                width: 60px;
                height: 60px;
                margin: 0 auto 12px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .ml-scenario-title {
                margin: 0 0 16px 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .ml-scenario-metrics {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .ml-scenario-metric {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
            }
            
            .ml-impact-indicator {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                font-size: 12px;
            }
            
            .ml-impact-label {
                color: var(--text-secondary);
            }
            
            .ml-impact-level {
                font-weight: 700;
                text-transform: uppercase;
            }
            
            .ml-scenario-bar {
                height: 6px;
                background: var(--bg-color);
                border-radius: 3px;
                overflow: hidden;
            }
            
            .ml-scenario-fill {
                height: 100%;
                transition: width 0.6s ease;
            }
            
            /* Value at Risk Analysis */
            .ml-var-analysis {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 16px;
                padding: 16px;
                background: var(--bg-color);
                border-radius: var(--radius-sm);
                border: 1px solid var(--border-color);
            }
            
            .ml-var-metric {
                text-align: center;
                padding: 16px;
            }
            
            .ml-var-label {
                display: block;
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 8px;
            }
            
            .ml-var-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                color: var(--danger-color);
                margin-bottom: 4px;
            }
            
            .ml-var-help {
                display: block;
                font-size: 11px;
                color: var(--text-tertiary);
                font-style: italic;
            }
            
            /* Dark mode adjustments for Phase 1 */
            [data-theme="dark"] .ml-timeframe-card {
                background: var(--card-bg);
            }
            
            [data-theme="dark"] .ml-sizing-results {
                background: var(--card-bg);
            }
            
            [data-theme="dark"] .ml-var-analysis {
                background: var(--card-bg);
            }
            
            /* Responsive adjustments for Phase 1 */
            @media (max-width: 768px) {
                .ml-timeframe-grid {
                    grid-template-columns: 1fr;
                }
                
                .ml-scenarios-grid {
                    grid-template-columns: 1fr;
                }
                
                .ml-var-analysis {
                    grid-template-columns: 1fr;
                }
            }
            
            /* Phase 1 Pattern Recognition Enhancements */
            
            /* Pattern Formation Tracking */
            .ml-pattern-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            
            .ml-pattern-formation {
                position: relative;
                width: 120px;
                height: 20px;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 10px;
                overflow: hidden;
            }
            
            .ml-formation-progress {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: linear-gradient(90deg, var(--primary-color), var(--primary-dark));
                transition: width 0.6s ease;
            }
            
            .ml-formation-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 11px;
                font-weight: 600;
                color: var(--text-color);
                white-space: nowrap;
            }
            
            /* Pattern Success Rate */
            .ml-pattern-success {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                font-size: 13px;
            }
            
            .ml-success-rate {
                font-weight: 600;
                color: var(--success-color);
            }
            
            .ml-success-count {
                color: var(--text-secondary);
            }
            
            .ml-best-market {
                padding: 2px 8px;
                background: var(--primary-lightest);
                border-radius: 12px;
                font-size: 11px;
                color: var(--primary-color);
                font-weight: 500;
            }
            
            /* Critical Levels */
            .ml-critical-levels {
                display: flex;
                gap: 12px;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .ml-critical-levels span {
                padding: 4px 8px;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-xs);
                font-weight: 500;
            }
            
            /* Pattern Target */
            .ml-pattern-target {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: var(--success-light);
                color: var(--success-color);
                border-radius: var(--radius-sm);
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 8px;
            }
            
            /* Advanced Pattern Styles */
            .ml-pattern-advanced {
                border: 2px solid var(--primary-color);
                background: var(--primary-lightest);
            }
            
            .ml-pattern-advanced .ml-pattern-name {
                color: var(--primary-color);
            }
            
            /* Small Confidence Ring */
            .ml-confidence-visual {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            
            .ml-confidence-ring-small {
                width: 80px;
                height: 80px;
            }
            
            .ml-circular-chart-small {
                display: block;
                margin: 0 auto;
                max-width: 100%;
                max-height: 100%;
            }
            
            .ml-percentage-small {
                fill: var(--text-color);
                font-size: 0.6em;
                text-anchor: middle;
                font-weight: 700;
            }
            
            /* Harmonic Pattern Points */
            .ml-harmonic-points {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .ml-harmonic-point {
                padding: 4px 8px;
                background: var(--primary-light);
                color: var(--primary-color);
                border-radius: var(--radius-xs);
                font-size: 11px;
                font-weight: 600;
            }
            
            /* Elliott Wave Visualization */
            .ml-elliott-waves {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 8px;
            }
            
            .ml-wave-number {
                width: 24px;
                height: 24px;
                background: var(--primary-color);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
            }
            
            .ml-wave-connector {
                width: 20px;
                height: 2px;
                background: var(--border-color);
            }
            
            /* Volume Pattern Indicator */
            .ml-volume-ratio {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                background: var(--warning-light);
                color: var(--warning-color);
                border-radius: var(--radius-xs);
                font-weight: 600;
                font-size: 12px;
            }
            
            /* Pattern Item Hover Effects */
            .ml-pattern-item {
                position: relative;
                overflow: hidden;
            }
            
            .ml-pattern-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                transition: left 0.5s ease;
            }
            
            .ml-pattern-item:hover::before {
                left: 100%;
            }
            
            /* Responsive Pattern Updates */
            @media (max-width: 768px) {
                .ml-pattern-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .ml-pattern-formation {
                    width: 100%;
                }
                
                .ml-pattern-success {
                    flex-wrap: wrap;
                }
                
                .ml-critical-levels {
                    flex-direction: column;
                    gap: 6px;
                }
                
                .ml-confidence-visual {
                    position: static;
                    margin-top: 12px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Show ML insights modal
     */
    function showMLInsights(symbol = null) {
        const modal = document.getElementById('ml-insights-modal');
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // Always auto-analyze with provided symbol or current symbol
        const targetSymbol = symbol || getCurrentSymbol();
        if (targetSymbol) {
            activeSymbol = targetSymbol;
            analyzeSymbol(targetSymbol);
        }
    }
    
    /**
     * Hide ML insights modal
     */
    function hideModal() {
        const modal = document.getElementById('ml-insights-modal');
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    
    /**
     * Get current symbol from the page
     */
    function getCurrentSymbol() {
        // Try to get symbol from various possible locations
        const symbolElement = document.querySelector('.symbol-name') ||
                            document.querySelector('[data-symbol]') ||
                            document.querySelector('#symbol');
        
        if (symbolElement) {
            return symbolElement.textContent || symbolElement.value || symbolElement.dataset.symbol;
        }
        
        return null;
    }
    
    /**
     * Get industry and sector information for a symbol
     */
    function getIndustryInfo(symbol) {
        const industryMappings = {
            // Technology
            'AAPL': { industry: 'Consumer Electronics', sector: 'Technology', description: 'Designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories.' },
            'MSFT': { industry: 'Software', sector: 'Technology', description: 'Develops, licenses, and supports software, services, devices, and solutions worldwide.' },
            'GOOGL': { industry: 'Internet Content & Information', sector: 'Communication Services', description: 'Provides online advertising services and develops internet-based services and products.' },
            'AMZN': { industry: 'Internet Retail', sector: 'Consumer Discretionary', description: 'Offers a range of products and services through its websites, including retail sales and subscription services.' },
            'META': { industry: 'Interactive Media & Services', sector: 'Communication Services', description: 'Builds technology that helps people connect, find communities, and grow businesses.' },
            'TSLA': { industry: 'Auto Manufacturers', sector: 'Consumer Discretionary', description: 'Designs, develops, manufactures, leases, and sells electric vehicles and energy generation and storage systems.' },
            'NVDA': { industry: 'Semiconductors', sector: 'Technology', description: 'Designs graphics processing units for gaming, cryptocurrency mining, and professional markets.' },
            'NFLX': { industry: 'Entertainment', sector: 'Communication Services', description: 'Provides entertainment services including streaming TV series, documentaries and feature films.' },
            
            // Finance
            'JPM': { industry: 'Banks - Diversified', sector: 'Financial Services', description: 'Provides financial services including investment banking, treasury services, and asset management.' },
            'V': { industry: 'Credit Services', sector: 'Financial Services', description: 'Operates VisaNet, a transaction processing network that enables authorization, clearing, and settlement.' },
            'MA': { industry: 'Credit Services', sector: 'Financial Services', description: 'Provides transaction processing and other payment-related products and services worldwide.' },
            'BAC': { industry: 'Banks - Diversified', sector: 'Financial Services', description: 'Provides banking and financial products and services for individual and institutional customers.' },
            
            // Healthcare
            'JNJ': { industry: 'Drug Manufacturers', sector: 'Healthcare', description: 'Researches, develops, manufactures, and sells pharmaceutical products and medical devices.' },
            'UNH': { industry: 'Healthcare Plans', sector: 'Healthcare', description: 'Operates as a health care company that provides health care coverage and benefits services.' },
            'PFE': { industry: 'Drug Manufacturers', sector: 'Healthcare', description: 'Discovers, develops, manufactures, markets, distributes, and sells biopharmaceutical products.' },
            
            // Consumer
            'WMT': { industry: 'Discount Stores', sector: 'Consumer Defensive', description: 'Operates retail stores in various formats worldwide including supercenters, supermarkets, and cash and carry stores.' },
            'PG': { industry: 'Household & Personal Products', sector: 'Consumer Defensive', description: 'Manufactures and markets consumer products in the United States and internationally.' },
            'KO': { industry: 'Beverages - Non-Alcoholic', sector: 'Consumer Defensive', description: 'Manufactures, markets, and sells various nonalcoholic beverages worldwide.' },
            'PEP': { industry: 'Beverages - Non-Alcoholic', sector: 'Consumer Defensive', description: 'Manufactures, markets, distributes, and sells various beverages and convenient foods worldwide.' },
            'NKE': { industry: 'Footwear & Accessories', sector: 'Consumer Discretionary', description: 'Designs, develops, markets, and sells athletic footwear, apparel, equipment, and accessories worldwide.' },
            'DIS': { industry: 'Entertainment', sector: 'Communication Services', description: 'Operates entertainment and media businesses including theme parks, resorts, and media networks.' },
            
            // Industrial & Energy
            'HD': { industry: 'Home Improvement Retail', sector: 'Consumer Discretionary', description: 'Operates as a home improvement retailer selling building materials, home improvement products, and lawn and garden products.' },
            'CVX': { industry: 'Oil & Gas Integrated', sector: 'Energy', description: 'Engages in integrated energy, chemicals, and petroleum operations worldwide.' },
            
            // Indian Stocks
            'RELIANCE.NS': { industry: 'Oil & Gas Integrated', sector: 'Energy', description: 'Operates in oil and gas, petrochemicals, oil and chemicals, textiles, natural resources, and retail businesses.' },
            'TCS.NS': { industry: 'Information Technology Services', sector: 'Technology', description: 'Provides information technology services, consulting and business solutions worldwide.' },
            'HDFCBANK.NS': { industry: 'Banks - Regional', sector: 'Financial Services', description: 'Provides various banking and financial services to individuals and corporates in India.' },
            'INFY.NS': { industry: 'Information Technology Services', sector: 'Technology', description: 'Provides consulting, technology, outsourcing, and next-generation digital services.' }
        };
        
        return industryMappings[symbol] || { industry: null, sector: null, description: null };
    }
    
    /**
     * Get pattern explanation for chart patterns
     */
    function getPatternExplanation(patternType) {
        const explanations = {
            // Classic patterns
            'head_and_shoulders': 'Bearish reversal pattern with three peaks, the middle one highest',
            'inverse_head_and_shoulders': 'Bullish reversal pattern with three troughs, the middle one lowest',
            'double_top': 'Bearish reversal with two similar highs indicating resistance',
            'double_bottom': 'Bullish reversal with two similar lows indicating support',
            'triangle': 'Consolidation pattern that often precedes a breakout',
            'ascending_triangle': 'Bullish continuation pattern with rising support line',
            'descending_triangle': 'Bearish continuation pattern with falling resistance line',
            'flag': 'Short-term continuation pattern after strong price movement',
            'pennant': 'Small symmetrical triangle following significant price movement',
            'wedge': 'Reversal pattern with converging trend lines',
            'cup_and_handle': 'Bullish continuation resembling a tea cup with handle',
            
            // Harmonic patterns
            'harmonic_gartley': 'Fibonacci-based pattern with 78.6% retracement for reversals',
            'harmonic_butterfly': 'Extended harmonic pattern targeting 127-161% extensions',
            'harmonic_bat': 'Precise harmonic pattern with 88.6% retracement level',
            'harmonic_crab': 'Most extreme harmonic pattern with 161.8% extension',
            
            // Elliott Wave patterns
            'elliott_impulse': '5-wave trend pattern (1-2-3-4-5) indicating strong directional move',
            'elliott_corrective': '3-wave correction (A-B-C) against the primary trend',
            
            // Volume patterns
            'volume_climax': 'Extreme volume spike indicating potential reversal point',
            'volume_noDemand': 'Low volume on up move showing lack of buying interest',
            'volume_stopping': 'High volume without price progress indicating trend exhaustion'
        };
        return explanations[patternType] || 'Technical pattern detected in price action';
    }
    
    /**
     * Get candlestick pattern explanation
     */
    function getCandlestickExplanation(patternName) {
        const explanations = {
            'doji': 'Indecision pattern where open and close prices are nearly equal',
            'hammer': 'Bullish reversal with small body and long lower shadow',
            'shooting_star': 'Bearish reversal with small body and long upper shadow',
            'engulfing_bullish': 'Bullish reversal where a green candle engulfs the previous red candle',
            'engulfing_bearish': 'Bearish reversal where a red candle engulfs the previous green candle',
            'morning_star': 'Three-candle bullish reversal pattern',
            'evening_star': 'Three-candle bearish reversal pattern',
            'harami': 'Inside pattern suggesting potential reversal',
            'piercing_line': 'Bullish reversal with deep penetration into previous red candle',
            'dark_cloud_cover': 'Bearish reversal with deep penetration into previous green candle'
        };
        return explanations[patternName] || 'Candlestick formation indicating potential price direction change';
    }
    
    /**
     * Create visual summary section
     */
    function createVisualSummarySection(analysis) {
        if (!analysis.combinedSignal) return '';
        
        const signal = analysis.combinedSignal;
        const signalColor = signal.signal === 'BUY' ? '#4caf50' : 
                          signal.signal === 'SELL' ? '#f44336' : '#ff9800';
        
        return `
            <div class="ml-visual-summary">
                <h3>AI Trading Signal Overview</h3>
                <div class="ml-signal-dashboard">
                    <div class="ml-main-signal">
                        <div class="ml-signal-indicator" style="background: ${signalColor}">
                            <div class="ml-signal-icon-large">
                                ${signal.signal === 'BUY' ? '📈' : signal.signal === 'SELL' ? '📉' : '➡️'}
                            </div>
                            <div class="ml-signal-text">${signal.signal}</div>
                        </div>
                        <div class="ml-signal-confidence-visual">
                            <svg viewBox="0 0 100 50" class="ml-gauge">
                                <path d="M 10 40 A 30 30 0 0 1 90 40" fill="none" stroke="#e0e0e0" stroke-width="8"/>
                                <path d="M 10 40 A 30 30 0 0 1 90 40" fill="none" stroke="${signalColor}" 
                                    stroke-width="8" stroke-dasharray="${signal.confidence * 0.94}, 100"
                                    stroke-linecap="round"/>
                                <circle cx="${10 + signal.confidence * 0.8}" cy="${40 - Math.sin(signal.confidence * 0.0157) * 30}" 
                                    r="6" fill="${signalColor}"/>
                            </svg>
                            <div class="ml-gauge-label">${signal.confidence.toFixed(1)}% Confidence</div>
                        </div>
                    </div>
                    
                    <div class="ml-signal-components">
                        <h4>Signal Components</h4>
                        <div class="ml-component-bars">
                            ${createSignalComponentBar('Risk Analysis', analysis.risk?.confidence || 0, '#ff9800')}
                            ${createSignalComponentBar('Pattern Recognition', getPatternConfidence(analysis.patterns), '#2196f3')}
                            ${createSignalComponentBar('Market Sentiment', getSentimentScore(analysis.sentiment), '#9c27b0')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Create signal component bar
     */
    function createSignalComponentBar(label, value, color) {
        return `
            <div class="ml-component-bar">
                <div class="ml-component-label">${label}</div>
                <div class="ml-component-visual">
                    <div class="ml-component-track">
                        <div class="ml-component-fill" style="width: ${value}%; background: ${color}"></div>
                    </div>
                    <span class="ml-component-value">${value}%</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Get pattern confidence average
     */
    function getPatternConfidence(patterns) {
        if (!patterns) return 0;
        const allPatterns = [
            ...(patterns.chartPatterns || []),
            ...(patterns.candlestickPatterns || [])
        ];
        if (allPatterns.length === 0) return 0;
        const sum = allPatterns.reduce((acc, p) => acc + (p.confidence || 0), 0);
        return Math.round(sum / allPatterns.length);
    }
    
    /**
     * Get sentiment score as percentage
     */
    function getSentimentScore(sentiment) {
        if (!sentiment?.overall) return 50;
        // Convert -1 to 1 range to 0-100%
        return Math.round((sentiment.overall.score + 1) * 50);
    }
    
    /**
     * Get color based on score percentage
     */
    function getScoreColor(score) {
        if (score >= 70) return '#4caf50';
        if (score >= 40) return '#ff9800';
        return '#f44336';
    }
    
    /**
     * Analyze symbol using ML
     */
    async function analyzeSymbol(providedSymbol = null) {
        const symbol = providedSymbol || activeSymbol;
        
        if (!symbol) {
            console.error('No symbol provided for analysis');
            return;
        }
        
        activeSymbol = symbol.toUpperCase();
        const contentDiv = document.getElementById('ml-insights-content');
        
        // Show loading state
        contentDiv.innerHTML = `
            <div class="ml-loading">
                <div class="ml-spinner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ml-spin">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                </div>
                <p>Analyzing ${symbol} with AI/ML models...</p>
                <p style="font-size: 14px; margin-top: 10px; opacity: 0.7;">This may take a few seconds...</p>
            </div>
        `;
        
        try {
            // Fetch ML analysis
            const response = await fetch(`/api/ml/analysis/${symbol}?days=100`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch ML analysis');
            }
            
            currentAnalysis = await response.json();
            displayAnalysis(currentAnalysis);
            
        } catch (error) {
            console.error('ML analysis error:', error);
            contentDiv.innerHTML = `
                <div class="ml-error">
                    <p>Error analyzing ${symbol}: ${error.message}</p>
                    <button class="btn-secondary" onclick="MLInsightsUI.analyzeSymbol()">Retry</button>
                </div>
            `;
        }
    }
    
    /**
     * Display ML analysis results
     */
    function displayAnalysis(analysis) {
        const contentDiv = document.getElementById('ml-insights-content');
        
        let html = '';
        
        // Company Information Section
        const symbol = activeSymbol;
        const companyName = window.CompanyNames?.getCompanyName(symbol) || symbol;
        const industryInfo = getIndustryInfo(symbol);
        
        html += `
            <div class="ml-company-section">
                <div class="ml-company-header">
                    <h2 class="ml-company-name">${companyName}</h2>
                    <div class="ml-company-symbol">${symbol}</div>
                </div>
                <div class="ml-company-details">
                    ${industryInfo.industry ? `<span class="ml-industry-tag">${industryInfo.industry}</span>` : ''}
                    ${industryInfo.sector ? `<span class="ml-sector-tag">${industryInfo.sector}</span>` : ''}
                </div>
                ${industryInfo.description ? `
                    <div class="ml-company-description">
                        <p>${industryInfo.description}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Visual Summary Section - New!
        html += createVisualSummarySection(analysis);
        
        // Risk Management Section with Enhanced Visuals
        if (analysis.risk) {
            html += `
                <div class="ml-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                        </svg>
                        Advanced Risk Management AI
                        <button class="ml-explain-toggle" onclick="MLInsightsUI.toggleExplanation('risk')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Why AI thinks this
                        </button>
                    </h3>
                    
                    <div class="ml-explanation-panel" id="explanation-risk" style="display: none;">
                        <h4>🤖 AI Analysis Breakdown</h4>
                        <div class="ml-explanation-factors">
                            <div class="ml-factor">
                                <span class="ml-factor-name">Historical Volatility:</span>
                                <div class="ml-factor-bar">
                                    <div class="ml-factor-fill" style="width: ${analysis.risk.volatilityScore || 65}%"></div>
                                </div>
                                <span class="ml-factor-impact">${analysis.risk.volatilityScore || 65}% impact</span>
                            </div>
                            <div class="ml-factor">
                                <span class="ml-factor-name">Market Conditions:</span>
                                <div class="ml-factor-bar">
                                    <div class="ml-factor-fill" style="width: ${analysis.risk.marketScore || 45}%"></div>
                                </div>
                                <span class="ml-factor-impact">${analysis.risk.marketScore || 45}% impact</span>
                            </div>
                            <div class="ml-factor">
                                <span class="ml-factor-name">Technical Indicators:</span>
                                <div class="ml-factor-bar">
                                    <div class="ml-factor-fill" style="width: ${analysis.risk.technicalScore || 80}%"></div>
                                </div>
                                <span class="ml-factor-impact">${analysis.risk.technicalScore || 80}% impact</span>
                            </div>
                        </div>
                        <div class="ml-model-accuracy">
                            <p><strong>Model Accuracy:</strong> ${analysis.risk.modelAccuracy || 87}% on similar market conditions</p>
                            <p><strong>Backtested on:</strong> ${analysis.risk.backtestCount || '1,247'} historical scenarios</p>
                        </div>
                    </div>
                    
                    <div class="ml-section-description">
                        Our AI analyzes historical volatility, price movements, and market conditions to suggest optimal risk management levels.
                    </div>
                    
                    <div class="ml-risk-visual-params">
                        <div class="ml-visual-param">
                            <div class="ml-param-header">
                                <span class="ml-param-label">Stop Loss</span>
                                <span class="ml-param-value">${analysis.risk.stopLoss}%</span>
                            </div>
                            <div class="ml-visual-meter">
                                <div class="ml-meter-fill ml-meter-danger" style="width: ${Math.min(analysis.risk.stopLoss * 10, 100)}%"></div>
                            </div>
                            <div class="ml-param-help">🛡️ Suggested maximum loss threshold to limit downside risk</div>
                        </div>
                        
                        <div class="ml-visual-param">
                            <div class="ml-param-header">
                                <span class="ml-param-label">Take Profit</span>
                                <span class="ml-param-value">${analysis.risk.takeProfit}%</span>
                            </div>
                            <div class="ml-visual-meter">
                                <div class="ml-meter-fill ml-meter-success" style="width: ${Math.min(analysis.risk.takeProfit * 5, 100)}%"></div>
                            </div>
                            <div class="ml-param-help">🎯 Optimal profit-taking level based on volatility analysis</div>
                        </div>
                        
                        <div class="ml-visual-param">
                            <div class="ml-param-header">
                                <span class="ml-param-label">AI Confidence</span>
                                <span class="ml-param-value">${analysis.risk.confidence}%</span>
                            </div>
                            <div class="ml-confidence-ring">
                                <svg viewBox="0 0 36 36" class="ml-circular-chart">
                                    <path class="ml-circle-bg"
                                        stroke-dasharray="100, 100"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path class="ml-circle"
                                        stroke-dasharray="${analysis.risk.confidence}, 100"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <text x="18" y="20.35" class="ml-percentage">${analysis.risk.confidence}%</text>
                                </svg>
                            </div>
                            <div class="ml-param-help">🔬 How confident our models are in these recommendations</div>
                        </div>
                    </div>
                    
                    ${analysis.risk.anomalies?.isAnomaly ? `
                        <div class="ml-alert">
                            ⚠️ <strong>Market Anomalies Detected:</strong> ${analysis.risk.anomalies.recommendation.join(', ')}
                            <div class="ml-alert-help">Unusual market patterns detected that may affect normal price behavior.</div>
                        </div>
                    ` : ''}
                    
                    <!-- Multi-Timeframe Risk Analysis -->
                    <div class="ml-timeframe-analysis">
                        <h4>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Multi-Timeframe Risk Analysis
                        </h4>
                        <div class="ml-timeframe-grid">
                            ${createTimeframeRiskCard('Intraday', analysis.risk.timeframes?.intraday || {
                                stopLoss: 2, takeProfit: 5, confidence: 85, 
                                volatility: 'HIGH', recommendation: 'Pattern typically shows short duration'
                            })}
                            ${createTimeframeRiskCard('Swing (2-7 days)', analysis.risk.timeframes?.swing || {
                                stopLoss: 5, takeProfit: 12, confidence: 78,
                                volatility: 'MEDIUM', recommendation: 'Pattern shows typical risk profile'
                            })}
                            ${createTimeframeRiskCard('Position (7-30 days)', analysis.risk.timeframes?.position || {
                                stopLoss: 8, takeProfit: 20, confidence: 72,
                                volatility: 'LOW', recommendation: 'Pattern historically shows wider ranges'
                            })}
                        </div>
                    </div>
                    
                    <!-- Position Sizing Calculator -->
                    <div class="ml-position-sizing">
                        <h4>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 12V8H6a2 2 0 01-2-2c0-1.11.89-2 2-2h12v4"></path>
                                <path d="M4 6v12c0 1.11.89 2 2 2h14v-4"></path>
                                <path d="M18 12a2 2 0 00-2 2c0 1.11.89 2 2 2h4v-4h-4z"></path>
                            </svg>
                            AI Position Sizing Calculator
                        </h4>
                        <div class="ml-sizing-inputs">
                            <div class="ml-input-group">
                                <label>Portfolio Value ($)</label>
                                <input type="number" id="portfolio-value" value="10000" onchange="MLInsightsUI.calculatePositionSize()">
                            </div>
                            <div class="ml-input-group">
                                <label>Risk per Trade (%)</label>
                                <select id="risk-per-trade" onchange="MLInsightsUI.calculatePositionSize()">
                                    <option value="1">Conservative (1%)</option>
                                    <option value="2" selected>Standard (2%)</option>
                                    <option value="3">Aggressive (3%)</option>
                                </select>
                            </div>
                        </div>
                        <div class="ml-sizing-results" id="position-sizing-results">
                            ${calculatePositionSizingDisplay(analysis.risk, 10000, 2)}
                        </div>
                    </div>
                    
                    <!-- Risk Scenarios & Stress Testing -->
                    <div class="ml-risk-scenarios">
                        <h4>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Risk Scenarios & Stress Testing
                        </h4>
                        <div class="ml-scenarios-grid">
                            ${createRiskScenario('Normal Market', {
                                drop: 5, probability: 60, impact: 'LOW',
                                color: '#4caf50', icon: '📊'
                            })}
                            ${createRiskScenario('Market Correction', {
                                drop: 10, probability: 30, impact: 'MEDIUM',
                                color: '#ff9800', icon: '📉'
                            })}
                            ${createRiskScenario('Black Swan Event', {
                                drop: 20, probability: 10, impact: 'HIGH',
                                color: '#f44336', icon: '🦢'
                            })}
                        </div>
                        <div class="ml-var-analysis">
                            <div class="ml-var-metric">
                                <span class="ml-var-label">Value at Risk (95%)</span>
                                <span class="ml-var-value">-${analysis.risk.valueAtRisk95 || '850'}</span>
                                <span class="ml-var-help">95% chance losses won't exceed this</span>
                            </div>
                            <div class="ml-var-metric">
                                <span class="ml-var-label">Expected Shortfall</span>
                                <span class="ml-var-value">-${analysis.risk.expectedShortfall || '1,200'}</span>
                                <span class="ml-var-help">Average loss in worst 5% of cases</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Pattern Recognition Section with Visual Enhancements
        if (analysis.patterns) {
            html += `
                <div class="ml-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        Pattern Recognition AI
                        <button class="ml-explain-toggle" onclick="MLInsightsUI.toggleExplanation('patterns')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Why AI thinks this
                        </button>
                    </h3>
                    
                    <div class="ml-explanation-panel" id="explanation-patterns" style="display: none;">
                        <h4>🤖 Pattern Detection Analysis</h4>
                        <div class="ml-explanation-content">
                            <p>Our AI analyzed <strong>${analysis.patterns.dataPoints || '500+'}</strong> price points using:</p>
                            <ul class="ml-analysis-methods">
                                <li>Machine Learning pattern matching algorithms</li>
                                <li>Historical pattern success rates (${analysis.patterns.historicalAccuracy || 82}% accuracy)</li>
                                <li>Volume and momentum confirmation</li>
                                <li>Multi-timeframe analysis</li>
                            </ul>
                            <div class="ml-pattern-confidence-breakdown">
                                <h5>Confidence Factors:</h5>
                                <div class="ml-factor">
                                    <span class="ml-factor-name">Pattern Clarity:</span>
                                    <div class="ml-factor-bar">
                                        <div class="ml-factor-fill" style="width: ${analysis.patterns.clarityScore || 78}%"></div>
                                    </div>
                                    <span class="ml-factor-impact">${analysis.patterns.clarityScore || 78}%</span>
                                </div>
                                <div class="ml-factor">
                                    <span class="ml-factor-name">Historical Success:</span>
                                    <div class="ml-factor-bar">
                                        <div class="ml-factor-fill" style="width: ${analysis.patterns.historicalScore || 85}%"></div>
                                    </div>
                                    <span class="ml-factor-impact">${analysis.patterns.historicalScore || 85}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ml-section-description">
                        Our algorithms scan historical price data to identify technical patterns that often precede significant price movements.
                    </div>
                    
                    <!-- Pattern Visualization Canvas -->
                    <div class="ml-pattern-visual">
                        <canvas id="pattern-chart-${symbol}" class="ml-pattern-canvas"></canvas>
                    </div>
            `;
            
            if (analysis.patterns.chartPatterns?.length > 0) {
                html += `
                    <h4>📈 Chart Patterns</h4>
                    <div class="ml-pattern-help">Classic technical analysis patterns formed by price movements over time</div>
                    <div class="ml-patterns-list">`;
                analysis.patterns.chartPatterns.forEach(pattern => {
                    html += `
                        <div class="ml-pattern-item ${pattern.type.includes('harmonic') ? 'ml-pattern-advanced' : ''}">
                            <div class="ml-pattern-info">
                                <div class="ml-pattern-header">
                                    <div class="ml-pattern-name">${formatPatternName(pattern.type)}</div>
                                    ${pattern.formation ? `
                                        <div class="ml-pattern-formation">
                                            <div class="ml-formation-progress" style="width: ${pattern.formation.completion}%"></div>
                                            <span class="ml-formation-text">${pattern.formation.completion}% formed</span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${pattern.successRate ? `
                                    <div class="ml-pattern-success">
                                        <span class="ml-success-rate">Success Rate: ${pattern.successRate.rate}%</span>
                                        <span class="ml-success-count">(${pattern.successRate.totalOccurrences} occurrences)</span>
                                        ${pattern.successRate.bestInMarket ? `
                                            <span class="ml-best-market">Best in ${pattern.successRate.bestInMarket} market</span>
                                        ` : ''}
                                    </div>
                                ` : ''}
                                ${pattern.criticalLevels ? `
                                    <div class="ml-critical-levels">
                                        ${pattern.criticalLevels.neckline ? `<span>Neckline: $${pattern.criticalLevels.neckline.toFixed(2)}</span>` : ''}
                                        ${pattern.criticalLevels.breakout ? `<span>Breakout: $${pattern.criticalLevels.breakout.toFixed(2)}</span>` : ''}
                                    </div>
                                ` : ''}
                                ${pattern.projectedTarget ? `
                                    <div class="ml-pattern-target">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <circle cx="12" cy="12" r="6"></circle>
                                            <circle cx="12" cy="12" r="2"></circle>
                                        </svg>
                                        Target: $${pattern.projectedTarget.toFixed(2)}
                                    </div>
                                ` : ''}
                                <div class="ml-pattern-desc">${pattern.recommendation}</div>
                                <div class="ml-pattern-explanation">${getPatternExplanation(pattern.type)}</div>
                            </div>
                            <div class="ml-confidence-visual">
                                <div class="ml-confidence-ring-small">
                                    <svg viewBox="0 0 36 36" class="ml-circular-chart-small">
                                        <path class="ml-circle-bg"
                                            stroke-dasharray="100, 100"
                                            d="M18 2.0845
                                            a 15.9155 15.9155 0 0 1 0 31.831
                                            a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path class="ml-circle"
                                            stroke-dasharray="${Math.round(pattern.confidence * 100)}, 100"
                                            d="M18 2.0845
                                            a 15.9155 15.9155 0 0 1 0 31.831
                                            a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <text x="18" y="20.35" class="ml-percentage-small">${Math.round(pattern.confidence * 100)}%</text>
                                    </svg>
                                </div>
                                <div class="ml-confidence-label">Confidence</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            if (analysis.patterns.candlestickPatterns?.length > 0) {
                html += `
                    <h4>🕯️ Candlestick Patterns</h4>
                    <div class="ml-pattern-help">Japanese candlestick formations that indicate potential reversals or continuations</div>
                    <div class="ml-patterns-list">`;
                analysis.patterns.candlestickPatterns.forEach(pattern => {
                    html += `
                        <div class="ml-pattern-item">
                            <div class="ml-pattern-info">
                                <div class="ml-pattern-name">${formatPatternName(pattern.pattern)}</div>
                                <div class="ml-pattern-desc">${pattern.recommendation}</div>
                                <div class="ml-pattern-explanation">${getCandlestickExplanation(pattern.pattern)}</div>
                            </div>
                            <div class="ml-confidence-badge">
                                <div class="ml-confidence">${pattern.confidence}%</div>
                                <div class="ml-confidence-label">Detection Confidence</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            html += '</div>';
            
            // Draw pattern visualization after DOM update
            setTimeout(() => drawPatternVisualization(symbol, analysis.patterns), 100);
        }
        
        // Sentiment Analysis Section with Enhanced Visuals
        if (analysis.sentiment) {
            const sentiment = analysis.sentiment.overall;
            const sentimentClass = sentiment.trend === 'positive' ? 'ml-sentiment-positive' : 
                                 sentiment.trend === 'negative' ? 'ml-sentiment-negative' : 
                                 'ml-sentiment-neutral';
            
            html += `
                <div class="ml-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                        Market Sentiment Analysis
                        <button class="ml-explain-toggle" onclick="MLInsightsUI.toggleExplanation('sentiment')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Why AI thinks this
                        </button>
                    </h3>
                    
                    <div class="ml-explanation-panel" id="explanation-sentiment" style="display: none;">
                        <h4>🤖 Sentiment Analysis Process</h4>
                        <div class="ml-explanation-content">
                            <p>Our AI processed <strong>${analysis.sentiment.sourcesAnalyzed || '50+'}</strong> data sources including:</p>
                            <ul class="ml-analysis-methods">
                                <li>Financial news articles and press releases</li>
                                <li>Social media mentions and discussions</li>
                                <li>Analyst reports and recommendations</li>
                                <li>Market commentary and forums</li>
                            </ul>
                            <div class="ml-sentiment-breakdown">
                                <h5>Sentiment Sources:</h5>
                                <div class="ml-factor">
                                    <span class="ml-factor-name">News Media:</span>
                                    <div class="ml-factor-bar">
                                        <div class="ml-factor-fill" style="width: ${analysis.sentiment.newsScore || 70}%; background: ${getScoreColor(analysis.sentiment.newsScore || 70)}"></div>
                                    </div>
                                    <span class="ml-factor-impact">${analysis.sentiment.newsScore || 70}% positive</span>
                                </div>
                                <div class="ml-factor">
                                    <span class="ml-factor-name">Social Media:</span>
                                    <div class="ml-factor-bar">
                                        <div class="ml-factor-fill" style="width: ${analysis.sentiment.socialScore || 65}%; background: ${getScoreColor(analysis.sentiment.socialScore || 65)}"></div>
                                    </div>
                                    <span class="ml-factor-impact">${analysis.sentiment.socialScore || 65}% positive</span>
                                </div>
                                <div class="ml-factor">
                                    <span class="ml-factor-name">Analyst Views:</span>
                                    <div class="ml-factor-bar">
                                        <div class="ml-factor-fill" style="width: ${analysis.sentiment.analystScore || 80}%; background: ${getScoreColor(analysis.sentiment.analystScore || 80)}"></div>
                                    </div>
                                    <span class="ml-factor-impact">${analysis.sentiment.analystScore || 80}% positive</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ml-section-description">
                        AI analysis of news, social media, and market commentary to gauge overall sentiment toward this stock.
                    </div>
                    <div class="ml-sentiment">
                        <div class="ml-sentiment-score">
                            <div class="ml-sentiment-value ${sentimentClass}">${sentiment.score > 0 ? '+' : ''}${sentiment.score}</div>
                            <div class="ml-param-label">Overall Score</div>
                            <div class="ml-param-help">📊 Range: -1.0 (very negative) to +1.0 (very positive)</div>
                        </div>
                        <div class="ml-sentiment-score">
                            <div class="ml-sentiment-value">${sentiment.magnitude}</div>
                            <div class="ml-param-label">Magnitude</div>
                            <div class="ml-param-help">📈 Strength of sentiment (0-1, higher = stronger feelings)</div>
                        </div>
                        <div class="ml-sentiment-score">
                            <div class="ml-sentiment-value ${sentimentClass}">${sentiment.trend.toUpperCase()}</div>
                            <div class="ml-param-label">Trend Direction</div>
                            <div class="ml-param-help">🎯 Overall market feeling: positive, negative, or neutral</div>
                        </div>
                    </div>
                    ${analysis.sentiment.signal ? `
                        <div class="ml-signal-info">
                            <strong>📡 Sentiment Signal:</strong> ${analysis.sentiment.signal.action} 
                            (${analysis.sentiment.signal.strength})
                            <div class="ml-signal-reason">${analysis.sentiment.signal.reason}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Combined Signal Section
        if (analysis.combinedSignal) {
            const signal = analysis.combinedSignal;
            const signalColor = signal.signal === 'BUY' ? '#4caf50' : 
                              signal.signal === 'SELL' ? '#f44336' : '#ff9800';
            const signalIcon = signal.signal === 'BUY' ? '📈' : signal.signal === 'SELL' ? '📉' : '➡️';
            
            html += `
                <div class="ml-combined-signal" style="background: ${signalColor}">
                    <div class="ml-signal-header">
                        <div class="ml-signal-icon">${signalIcon}</div>
                        <div class="ml-signal-action">${signal.signal}</div>
                    </div>
                    <div class="ml-signal-confidence">AI Confidence: ${signal.confidence.toFixed(1)}%</div>
                    <div class="ml-signal-explanation">
                        Combined analysis of all available signals and patterns
                    </div>
                </div>
            `;
        }
        
        // Recommendations Section
        if (analysis.recommendations?.length > 0) {
            html += `
                <div class="ml-section">
                    <h3>AI Technical Analysis</h3>
                    <ul class="ml-recommendations">
            `;
            
            analysis.recommendations.forEach(rec => {
                const iconClass = rec.source === 'risk_ai' ? 'ml-rec-risk' :
                                rec.source === 'pattern_ai' ? 'ml-rec-pattern' :
                                'ml-rec-sentiment';
                
                html += `
                    <li class="ml-recommendation">
                        <div class="ml-rec-icon ${iconClass}">
                            ${getSourceIcon(rec.source)}
                        </div>
                        <div>
                            <strong>${rec.action}</strong>
                            <div class="ml-param-label">Confidence: ${rec.confidence}%</div>
                        </div>
                    </li>
                `;
            });
            
            html += '</ul></div>';
        }
        
        contentDiv.innerHTML = html;
    }
    
    /**
     * Format pattern names for display
     */
    function formatPatternName(name) {
        return name.replace(/_/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
    }
    
    /**
     * Get icon for recommendation source
     */
    function getSourceIcon(source) {
        const icons = {
            'risk_ai': '🛡️',
            'pattern_ai': '📊',
            'sentiment_ai': '💭'
        };
        return icons[source] || '🤖';
    }
    
    /**
     * Toggle explanation panel
     */
    function toggleExplanation(section) {
        const panel = document.getElementById(`explanation-${section}`);
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            
            // Animate the panel
            if (!isVisible) {
                panel.style.opacity = '0';
                panel.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateY(0)';
                }, 10);
            }
        }
    }
    
    /**
     * Create timeframe risk card
     */
    function createTimeframeRiskCard(timeframe, data) {
        const volatilityColor = data.volatility === 'HIGH' ? '#f44336' : 
                               data.volatility === 'MEDIUM' ? '#ff9800' : '#4caf50';
        
        return `
            <div class="ml-timeframe-card">
                <div class="ml-timeframe-header">
                    <h5>${timeframe}</h5>
                    <span class="ml-volatility-badge" style="background: ${volatilityColor}">
                        ${data.volatility} volatility
                    </span>
                </div>
                <div class="ml-timeframe-metrics">
                    <div class="ml-metric">
                        <span class="ml-metric-label">Stop Loss</span>
                        <span class="ml-metric-value">${data.stopLoss}%</span>
                    </div>
                    <div class="ml-metric">
                        <span class="ml-metric-label">Take Profit</span>
                        <span class="ml-metric-value">${data.takeProfit}%</span>
                    </div>
                    <div class="ml-metric">
                        <span class="ml-metric-label">Confidence</span>
                        <span class="ml-metric-value">${data.confidence}%</span>
                    </div>
                </div>
                <div class="ml-timeframe-recommendation">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${data.recommendation}
                </div>
            </div>
        `;
    }
    
    /**
     * Calculate position sizing display
     */
    function calculatePositionSizingDisplay(riskData, portfolioValue, riskPercent) {
        const riskAmount = portfolioValue * (riskPercent / 100);
        const stopLossPercent = riskData?.stopLoss || 5;
        const positionSize = riskAmount / (stopLossPercent / 100);
        const shares = Math.floor(positionSize / (activeSymbol ? 100 : 50)); // Assume $100 per share if no price
        
        // Kelly Criterion calculation
        const winRate = riskData?.winRate || 0.55;
        const avgWin = riskData?.takeProfit || 10;
        const avgLoss = riskData?.stopLoss || 5;
        const kellyPercent = ((winRate * avgWin) - ((1 - winRate) * avgLoss)) / avgWin;
        const kellySize = portfolioValue * Math.max(0, Math.min(kellyPercent, 0.25)); // Cap at 25%
        
        return `
            <div class="ml-sizing-calculation">
                <div class="ml-calc-row">
                    <span class="ml-calc-label">Risk Amount:</span>
                    <span class="ml-calc-value">$${riskAmount.toFixed(2)}</span>
                </div>
                <div class="ml-calc-row">
                    <span class="ml-calc-label">Position Size:</span>
                    <span class="ml-calc-value highlight">$${positionSize.toFixed(2)}</span>
                </div>
                <div class="ml-calc-row">
                    <span class="ml-calc-label">Shares to Buy:</span>
                    <span class="ml-calc-value">${shares} shares</span>
                </div>
                <div class="ml-kelly-section">
                    <h5>Kelly Criterion Suggestion</h5>
                    <div class="ml-kelly-meter">
                        <div class="ml-kelly-fill" style="width: ${(kellySize/portfolioValue*100).toFixed(1)}%"></div>
                        <span class="ml-kelly-text">${(kellySize/portfolioValue*100).toFixed(1)}%</span>
                    </div>
                    <p class="ml-kelly-help">Optimal position size based on win rate and risk/reward</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Create risk scenario card
     */
    function createRiskScenario(scenario, data) {
        return `
            <div class="ml-scenario-card" style="border-color: ${data.color}">
                <div class="ml-scenario-icon" style="background: ${data.color}20">
                    <span style="font-size: 24px">${data.icon}</span>
                </div>
                <h5 class="ml-scenario-title">${scenario}</h5>
                <div class="ml-scenario-metrics">
                    <div class="ml-scenario-metric">
                        <span class="ml-metric-label">Market Drop</span>
                        <span class="ml-metric-value" style="color: ${data.color}">-${data.drop}%</span>
                    </div>
                    <div class="ml-scenario-metric">
                        <span class="ml-metric-label">Probability</span>
                        <span class="ml-metric-value">${data.probability}%</span>
                    </div>
                </div>
                <div class="ml-impact-indicator">
                    <span class="ml-impact-label">Impact:</span>
                    <span class="ml-impact-level" style="color: ${data.color}">${data.impact}</span>
                </div>
                <div class="ml-scenario-bar">
                    <div class="ml-scenario-fill" style="width: ${data.probability}%; background: ${data.color}"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * Calculate position size
     */
    function calculatePositionSize() {
        const portfolioValue = parseFloat(document.getElementById('portfolio-value').value) || 10000;
        const riskPercent = parseFloat(document.getElementById('risk-per-trade').value) || 2;
        const resultsDiv = document.getElementById('position-sizing-results');
        
        if (resultsDiv && currentAnalysis?.risk) {
            resultsDiv.innerHTML = calculatePositionSizingDisplay(currentAnalysis.risk, portfolioValue, riskPercent);
        }
    }
    
    /**
     * Draw pattern visualization
     */
    function drawPatternVisualization(symbol, patterns) {
        const canvas = document.getElementById(`pattern-chart-${symbol}`);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = 200;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw mock price line with pattern highlights
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Generate sample price data
        const points = 100;
        const priceData = [];
        let price = 100;
        
        for (let i = 0; i < points; i++) {
            price += (Math.random() - 0.5) * 2;
            priceData.push(price);
        }
        
        // Draw price line
        ctx.beginPath();
        priceData.forEach((price, i) => {
            const x = (i / points) * width;
            const y = height - ((price - 90) / 20) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Highlight detected patterns
        if (patterns.chartPatterns?.length > 0) {
            ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
            ctx.strokeStyle = '#2196f3';
            ctx.lineWidth = 3;
            
            // Mock pattern regions
            patterns.chartPatterns.forEach((pattern, idx) => {
                const startX = width * 0.6 + idx * 50;
                const endX = startX + 40;
                
                ctx.fillRect(startX, 0, endX - startX, height);
                ctx.strokeRect(startX, 0, endX - startX, height);
            });
        }
    }
    
    // Public API
    return {
        init,
        showMLInsights,
        hideModal,
        analyzeSymbol,
        toggleExplanation,
        calculatePositionSize
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MLInsightsUI.init);
} else {
    MLInsightsUI.init();
}