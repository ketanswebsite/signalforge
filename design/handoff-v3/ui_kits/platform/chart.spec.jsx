// Spec reference only — renamed from Chart.jsx so the design-system compiler ignores it.
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function useChart(ref, build, deps = []) {
  React.useEffect(() => {
    if (!ref.current || typeof Chart === 'undefined') return;
    const c = new Chart(ref.current, build());
    const obs = new MutationObserver(() => { c.destroy(); });
    return () => { obs.disconnect(); c.destroy(); };
  }, deps);
}

function grid() {
  return { color: cssVar('--line') || 'rgba(0,0,0,.08)', drawBorder: false };
}
function ticks() {
  return { color: cssVar('--text-3') || '#8A8479', font: { family: 'Archivo', size: 10, weight: 600 }, maxTicksLimit: 6 };
}

function LineChart({ data, height = 220, theme }) {
  const ref = React.useRef(null);
  useChart(ref, () => ({
    type: 'line',
    data: {
      labels: data.map((_, i) => 'D' + (i + 1)),
      datasets: [{
        data, borderColor: cssVar('--accent'), borderWidth: 2, pointRadius: 0, tension: .3, fill: true,
        backgroundColor: ctx => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return 'transparent';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          const a = cssVar('--accent');
          g.addColorStop(0, a + '33'); g.addColorStop(1, a + '00');
          return g;
        }
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: ticks() }, y: { grid: grid(), ticks: ticks() } } }
  }), [theme]);
  return <div style={{ height }}><canvas ref={ref} /></div>;
}

function Bars({ labels, values, colors, height = 200, theme, horizontal }) {
  const ref = React.useRef(null);
  useChart(ref, () => ({
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 5, barPercentage: .65 }] },
    options: { indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: horizontal ? grid() : { display: false }, ticks: ticks() }, y: { grid: horizontal ? { display: false } : grid(), ticks: ticks() } } }
  }), [theme]);
  return <div style={{ height }}><canvas ref={ref} /></div>;
}

Object.assign(window, { LineChart, Bars, cssVar });
