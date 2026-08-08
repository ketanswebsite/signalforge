// Chart theme — reads the v3 "Poster" design tokens off CSS custom properties
// so every Chart.js chart matches the page in both themes. Falls back to
// sensible values on pages that have not migrated to the design system yet.
(function() {
    'use strict';

    function cssVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function paletteForTheme() {
        const dark = getCurrentTheme() === 'dark';
        return {
            gridColor: cssVar('--line', dark ? 'rgba(243,239,230,.16)' : '#DED8C8'),
            textColor: cssVar('--text-2', dark ? '#C9C2B0' : '#5B564A'),
            backgroundColor: cssVar('--surface', dark ? '#1D1A16' : '#FDFBF5'),
            borderColor: cssVar('--line-strong', dark ? 'rgba(243,239,230,.32)' : '#C9C2B0'),
            tooltipBg: cssVar('--text', dark ? '#F3EFE6' : '#141210'),
            tooltipText: cssVar('--bg', dark ? '#141210' : '#F3EFE6'),
            fontFamily: cssVar('--font-sans', "'Archivo', system-ui, sans-serif")
        };
    }

    // Function to update chart defaults
    function updateChartDefaults() {
        if (typeof Chart === 'undefined') return;

        const colors = paletteForTheme();

        Chart.defaults.color = colors.textColor;
        Chart.defaults.borderColor = colors.borderColor;
        Chart.defaults.backgroundColor = colors.backgroundColor;
        Chart.defaults.font.family = colors.fontFamily;
        Chart.defaults.font.size = 11;
        Chart.defaults.font.weight = 600;

        Chart.defaults.scale.grid.color = colors.gridColor;
        Chart.defaults.scale.ticks.color = colors.textColor;
        Chart.defaults.scale.title.color = colors.textColor;

        if (Chart.defaults.plugins.legend) {
            Chart.defaults.plugins.legend.labels.color = colors.textColor;
        }

        if (Chart.defaults.plugins.tooltip) {
            Chart.defaults.plugins.tooltip.backgroundColor = colors.tooltipBg;
            Chart.defaults.plugins.tooltip.titleColor = colors.tooltipText;
            Chart.defaults.plugins.tooltip.bodyColor = colors.tooltipText;
            Chart.defaults.plugins.tooltip.borderColor = colors.borderColor;
            Chart.defaults.plugins.tooltip.borderWidth = 1;
            Chart.defaults.plugins.tooltip.cornerRadius = 0;
        }
    }

    // Function to update all existing charts
    function updateExistingCharts() {
        if (typeof Chart === 'undefined') return;

        const colors = paletteForTheme();

        Object.keys(Chart.instances).forEach(key => {
            const chart = Chart.instances[key];
            if (!chart) return;

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
                    chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                    chart.options.plugins.tooltip.titleColor = colors.tooltipText;
                    chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
                    chart.options.plugins.tooltip.borderColor = colors.borderColor;
                }
            }

            chart.update('none');
        });
    }

    function handleThemeChange() {
        updateChartDefaults();
        updateExistingCharts();
    }

    // Initialize chart theme
    function initializeChartTheme() {
        updateChartDefaults();

        // The v3 shell flips data-theme on <html>; watch it directly.
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'data-theme') {
                    handleThemeChange();
                    return;
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Kept for pages that still fire the legacy event.
        window.addEventListener('themechange', handleThemeChange);

        // Also update when Chart.js is loaded
        if (typeof Chart === 'undefined') {
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
