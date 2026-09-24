// Chart theme — reads the v3 "Poster" design tokens off CSS custom properties
// so every Chart.js chart matches the page in both themes. Falls back to
// sensible values on pages that have not migrated to the design system yet.
// Axes, grid, legends and tooltips come from Chart.defaults (set here); a
// chart's own series take their colours from ChartTheme.colors().
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
            fontFamily: cssVar('--font-sans', "'Archivo', system-ui, sans-serif"),
            // Series colours: the tokens the page's own CSS uses for the same meanings
            accent: cssVar('--accent', dark ? '#E3C25A' : '#8A6912'),
            gain: cssVar('--gain', dark ? '#4ADE80' : '#177A4C'),
            loss: cssVar('--loss', dark ? '#F87171' : '#C22B1F'),
            warn: cssVar('--warn', dark ? '#FBBF24' : '#8A5A00'),
            info: cssVar('--info', dark ? '#8FBEF5' : '#1F5FA8'),
            muted: cssVar('--text-3', '#8B8371')
        };
    }

    /**
     * The same colour with an alpha channel, for fills and gradients: a token's
     * '#RRGGBB', '#RGB', 'rgb(...)' or 'rgba(...)' in, 'rgba(r, g, b, alpha)' out.
     * Anything else (a colour name) comes back unchanged.
     */
    function withAlpha(color, alpha) {
        const value = String(color == null ? '' : color).trim();
        let rgb = null;
        const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            const digits = hex[1].length === 3 ? hex[1].replace(/./g, d => d + d) : hex[1];
            rgb = [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
        } else {
            const fn = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
            if (fn) rgb = fn.slice(1, 4).map(Number);
        }
        return rgb ? 'rgba(' + rgb.join(', ') + ', ' + alpha + ')' : value;
    }

    // An exit reason's colour is fixed by the reason, never by its place in a chart:
    // the Simulator's doughnut drops the reasons nobody exited for, so a positional
    // list gave a slice its neighbour's colour. Each reason has one role, and a role
    // is one token, so a reason keeps its colour in both themes (in that theme's shade).
    const EXIT_REASON_ROLES = {
        'Take Profit': 'gain',    // hit the +8% target
        'Target Reached': 'gain',
        'Stop Loss': 'loss',      // hit the stop
        'Stop Loss Hit': 'loss',
        'Max Days': 'warn',       // ran out of time
        'Time Exit': 'warn',
        'Manual Exit': 'info',    // sold by hand
        'Other': 'muted'          // anything else
    };

    function exitReasonColor(reason) {
        const role = Object.prototype.hasOwnProperty.call(EXIT_REASON_ROLES, reason) ? EXIT_REASON_ROLES[reason] : 'muted';
        return paletteForTheme()[role];
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

    // Charts whose series colours come from the tokens redraw through these after a
    // theme change; the axes, grid, legends and tooltips are repainted above already
    const themeListeners = [];

    function onThemeChange(listener) {
        if (typeof listener === 'function') themeListeners.push(listener);
    }

    function handleThemeChange() {
        updateChartDefaults();
        updateExistingCharts();
        themeListeners.forEach(listener => {
            try {
                listener(getCurrentTheme());
            } catch (error) {
                console.error('[ChartTheme] a chart could not redraw in the new theme:', error);
            }
        });
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
        updateCharts: updateExistingCharts,
        colors: paletteForTheme,
        withAlpha: withAlpha,
        exitReasonColor: exitReasonColor,
        onThemeChange: onThemeChange
    };
})();
