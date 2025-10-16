/**
 * Admin Charts V2 - Enhanced Chart Functionality
 * Phase 2: Interactive charts with zoom, pan, and export
 */

const AdminChartsV2 = {
  /**
   * Create enhanced chart with zoom, pan, and export capabilities
   * @param {string} canvasId - Canvas element ID
   * @param {Object} config - Chart configuration
   */
  createEnhancedChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas element #${canvasId} not found`);
      return null;
    }

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    // Merge default config with provided config
    const enhancedConfig = this.enhanceChartConfig(config);

    // Create chart
    const chart = new Chart(canvas, enhancedConfig);

    // Add export functionality
    this.addExportControls(canvasId, chart);

    return chart;
  },

  /**
   * Enhance chart configuration with zoom, pan, and other features
   */
  enhanceChartConfig(config) {
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              family: "'Work Sans', sans-serif"
            }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                // Check if value should be formatted as currency
                if (context.dataset.currency) {
                  label += '£' + context.parsed.y.toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                } else {
                  label += context.parsed.y.toLocaleString();
                }
              }
              return label;
            }
          }
        },
        // Zoom plugin configuration
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
              speed: 0.1
            },
            pinch: {
              enabled: true
            },
            mode: 'xy',
          },
          pan: {
            enabled: true,
            mode: 'xy',
            speed: 10,
            threshold: 10
          },
          limits: {
            x: {min: 'original', max: 'original'},
            y: {min: 0, max: 'original'}
          }
        },
        // Crosshair plugin for precise reading
        crosshair: {
          line: {
            color: 'rgba(212, 175, 55, 0.5)',
            width: 1,
            dashPattern: [5, 5]
          },
          sync: {
            enabled: false
          },
          zoom: {
            enabled: false
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            display: true,
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            font: {
              size: 11
            }
          }
        }
      }
    };

    // Deep merge config
    return this.deepMerge(defaultOptions, config);
  },

  /**
   * Add export controls to chart
   */
  addExportControls(canvasId, chart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Check if controls already exist
    let controlsContainer = canvas.parentElement.querySelector('.chart-controls');

    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.className = 'chart-controls';
      controlsContainer.innerHTML = `
        <div class="chart-controls-group">
          <button class="btn btn-sm btn-secondary chart-btn" data-action="reset" title="Reset Zoom">
            🔄 Reset
          </button>
          <button class="btn btn-sm btn-secondary chart-btn" data-action="export-png" title="Export as PNG">
            📷 PNG
          </button>
          <button class="btn btn-sm btn-secondary chart-btn" data-action="export-csv" title="Export Data as CSV">
            📊 CSV
          </button>
          <button class="btn btn-sm btn-secondary chart-btn" data-action="toggle-animation" title="Toggle Animations">
            ⚡ Animate
          </button>
        </div>
      `;

      // Insert controls before canvas
      canvas.parentElement.insertBefore(controlsContainer, canvas);
    }

    // Add event listeners
    const buttons = controlsContainer.querySelectorAll('[data-action]');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleChartAction(action, chart, canvasId);
      });
    });
  },

  /**
   * Handle chart control actions
   */
  handleChartAction(action, chart, canvasId) {
    switch (action) {
      case 'reset':
        if (chart.resetZoom) {
          chart.resetZoom();
        }
        AdminComponentsV2.toast({
          type: 'info',
          message: 'Chart zoom reset',
          duration: 2000
        });
        break;

      case 'export-png':
        this.exportChartAsPNG(chart, canvasId);
        break;

      case 'export-csv':
        this.exportChartDataAsCSV(chart, canvasId);
        break;

      case 'toggle-animation':
        this.toggleChartAnimation(chart);
        break;
    }
  },

  /**
   * Export chart as PNG
   */
  exportChartAsPNG(chart, canvasId) {
    try {
      const canvas = document.getElementById(canvasId);
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `chart-${canvasId}-${Date.now()}.png`;
      link.href = url;
      link.click();

      AdminComponentsV2.toast({
        type: 'success',
        message: 'Chart exported as PNG',
        duration: 3000
      });
    } catch (error) {
      console.error('Export PNG error:', error);
      AdminComponentsV2.toast({
        type: 'error',
        message: 'Failed to export chart',
        duration: 3000
      });
    }
  },

  /**
   * Export chart data as CSV
   */
  exportChartDataAsCSV(chart, canvasId) {
    try {
      const data = chart.data;
      let csv = '';

      // Add header row
      csv += 'Label,' + data.datasets.map(ds => ds.label).join(',') + '\n';

      // Add data rows
      data.labels.forEach((label, i) => {
        const row = [label];
        data.datasets.forEach(dataset => {
          row.push(dataset.data[i] || '');
        });
        csv += row.join(',') + '\n';
      });

      // Create download link
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `chart-data-${canvasId}-${Date.now()}.csv`;
      link.href = url;
      link.click();
      window.URL.revokeObjectURL(url);

      AdminComponentsV2.toast({
        type: 'success',
        message: 'Chart data exported as CSV',
        duration: 3000
      });
    } catch (error) {
      console.error('Export CSV error:', error);
      AdminComponentsV2.toast({
        type: 'error',
        message: 'Failed to export data',
        duration: 3000
      });
    }
  },

  /**
   * Toggle chart animation
   */
  toggleChartAnimation(chart) {
    const currentState = chart.options.animation.duration;

    if (currentState === 0) {
      chart.options.animation = {
        duration: 750,
        easing: 'easeInOutQuart'
      };
      AdminComponentsV2.toast({
        type: 'info',
        message: 'Animations enabled',
        duration: 2000
      });
    } else {
      chart.options.animation = {
        duration: 0
      };
      AdminComponentsV2.toast({
        type: 'info',
        message: 'Animations disabled',
        duration: 2000
      });
    }

    chart.update();
  },

  /**
   * Create comparison chart (compare multiple periods)
   */
  createComparisonChart(canvasId, data, options = {}) {
    const config = {
      type: options.type || 'line',
      data: data,
      options: {
        ...options,
        plugins: {
          ...options.plugins,
          annotation: {
            annotations: {
              comparisonLine: {
                type: 'line',
                yMin: 0,
                yMax: 0,
                borderColor: 'rgba(212, 175, 55, 0.5)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: 'Comparison',
                  position: 'end'
                }
              }
            }
          }
        }
      }
    };

    return this.createEnhancedChart(canvasId, config);
  },

  /**
   * Create real-time updating chart
   */
  createRealtimeChart(canvasId, config, updateInterval = 5000) {
    const chart = this.createEnhancedChart(canvasId, config);

    const intervalId = setInterval(() => {
      if (chart && chart.data) {
        // Emit custom event for data update request
        const event = new CustomEvent('chart-update-request', {
          detail: { chartId: canvasId, chart: chart }
        });
        document.dispatchEvent(event);
      }
    }, updateInterval);

    // Store interval ID on chart for cleanup
    chart._updateIntervalId = intervalId;

    return chart;
  },

  /**
   * Update chart data
   */
  updateChartData(chart, newData) {
    if (!chart || !chart.data) return;

    // Update labels if provided
    if (newData.labels) {
      chart.data.labels = newData.labels;
    }

    // Update datasets
    if (newData.datasets) {
      newData.datasets.forEach((newDataset, index) => {
        if (chart.data.datasets[index]) {
          chart.data.datasets[index].data = newDataset.data;
          if (newDataset.label) {
            chart.data.datasets[index].label = newDataset.label;
          }
        }
      });
    }

    chart.update('none'); // Update without animation
  },

  /**
   * Add data point to chart (for real-time updates)
   */
  addDataPoint(chart, label, values) {
    if (!chart || !chart.data) return;

    // Add label
    chart.data.labels.push(label);

    // Add data to each dataset
    values.forEach((value, index) => {
      if (chart.data.datasets[index]) {
        chart.data.datasets[index].data.push(value);
      }
    });

    // Keep only last N points (e.g., 20)
    const maxPoints = 20;
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(dataset => {
        dataset.data.shift();
      });
    }

    chart.update('none');
  },

  /**
   * Destroy chart and cleanup
   */
  destroyChart(chart) {
    if (!chart) return;

    // Clear update interval if exists
    if (chart._updateIntervalId) {
      clearInterval(chart._updateIntervalId);
    }

    // Destroy chart
    chart.destroy();
  },

  /**
   * Deep merge utility
   */
  deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  },

  /**
   * Check if value is object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  },

  /**
   * Create chart with data decimation (for large datasets)
   */
  createOptimizedChart(canvasId, data, options = {}) {
    const config = {
      ...options,
      data: data,
      options: {
        ...options.options,
        parsing: false,
        normalized: true,
        datasets: {
          line: {
            pointRadius: 0 // Hide points for performance
          }
        },
        plugins: {
          ...options.options?.plugins,
          decimation: {
            enabled: true,
            algorithm: 'lttb', // Largest Triangle Three Buckets
            samples: 500
          }
        }
      }
    };

    return this.createEnhancedChart(canvasId, config);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminChartsV2 = AdminChartsV2;
}
