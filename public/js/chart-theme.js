// Chart Theme Configuration for Dark Mode
(function() {
    'use strict';
    
    // Default chart colors for light and dark themes
    const chartThemes = {
        light: {
            gridColor: 'rgba(0, 0, 0, 0.1)',
            textColor: '#111827',
            backgroundColor: 'white',
            borderColor: '#e5e7eb'
        },
        dark: {
            gridColor: 'rgba(255, 255, 255, 0.1)',
            textColor: '#f1f5f9',
            backgroundColor: '#1e293b',
            borderColor: '#334155'
        }
    };
    
    // Function to get current theme
    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    
    // Function to update chart defaults
    function updateChartDefaults() {
        if (typeof Chart === 'undefined') return;
        
        const theme = getCurrentTheme();
        const colors = chartThemes[theme];
        
        // Update Chart.js defaults
        Chart.defaults.color = colors.textColor;
        Chart.defaults.borderColor = colors.borderColor;
        Chart.defaults.backgroundColor = colors.backgroundColor;
        
        // Update scale defaults
        Chart.defaults.scale.grid.color = colors.gridColor;
        Chart.defaults.scale.ticks.color = colors.textColor;
        Chart.defaults.scale.title.color = colors.textColor;
        
        // Update plugin defaults
        if (Chart.defaults.plugins.legend) {
            Chart.defaults.plugins.legend.labels.color = colors.textColor;
        }
        
        if (Chart.defaults.plugins.tooltip) {
            Chart.defaults.plugins.tooltip.backgroundColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(0, 0, 0, 0.8)';
            Chart.defaults.plugins.tooltip.titleColor = theme === 'dark' ? '#f1f5f9' : 'white';
            Chart.defaults.plugins.tooltip.bodyColor = theme === 'dark' ? '#f1f5f9' : 'white';
            Chart.defaults.plugins.tooltip.borderColor = theme === 'dark' ? '#334155' : '#e5e7eb';
            Chart.defaults.plugins.tooltip.borderWidth = 1;
        }
    }
    
    // Function to update all existing charts
    function updateExistingCharts() {
        if (typeof Chart === 'undefined') return;
        
        const theme = getCurrentTheme();
        const colors = chartThemes[theme];
        
        // Get all chart instances
        Object.keys(Chart.instances).forEach(key => {
            const chart = Chart.instances[key];
            if (!chart) return;
            
            // Update chart options
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(scaleKey => {
                    const scale = chart.options.scales[scaleKey];
                    if (scale.grid) {
                        scale.grid.color = colors.gridColor;
                    }
                    if (scale.ticks) {
                        scale.ticks.color = colors.textColor;
                    }
                    if (scale.title) {
                        scale.title.color = colors.textColor;
                    }
                });
            }
            
            if (chart.options.plugins) {
                if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                    chart.options.plugins.legend.labels.color = colors.textColor;
                }
                
                if (chart.options.plugins.tooltip) {
                    chart.options.plugins.tooltip.backgroundColor = theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(0, 0, 0, 0.8)';
                    chart.options.plugins.tooltip.titleColor = theme === 'dark' ? '#f1f5f9' : 'white';
                    chart.options.plugins.tooltip.bodyColor = theme === 'dark' ? '#f1f5f9' : 'white';
                    chart.options.plugins.tooltip.borderColor = theme === 'dark' ? '#334155' : '#e5e7eb';
                }
            }
            
            // Update the chart
            chart.update('none');
        });
    }
    
    // Initialize chart theme
    function initializeChartTheme() {
        updateChartDefaults();
        
        // Listen for theme changes
        window.addEventListener('themechange', function(e) {
            updateChartDefaults();
            updateExistingCharts();
        });
        
        // Also update when Chart.js is loaded
        if (typeof Chart === 'undefined') {
            // Wait for Chart.js to load
            const checkChart = setInterval(() => {
                if (typeof Chart !== 'undefined') {
                    clearInterval(checkChart);
                    updateChartDefaults();
                }
            }, 100);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeChartTheme);
    } else {
        initializeChartTheme();
    }
    
    // Expose API for manual chart theme updates
    window.ChartTheme = {
        updateDefaults: updateChartDefaults,
        updateCharts: updateExistingCharts
    };
})();