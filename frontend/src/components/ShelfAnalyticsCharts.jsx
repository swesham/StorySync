import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import './ShelfAnalyticsCharts.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PASTEL_BG = [
  'rgba(199, 206, 234, 0.85)',
  'rgba(181, 234, 215, 0.85)',
  'rgba(255, 218, 193, 0.85)',
  'rgba(226, 240, 203, 0.85)',
  'rgba(255, 183, 178, 0.82)',
  'rgba(212, 165, 212, 0.8)',
  'rgba(168, 216, 234, 0.85)',
  'rgba(249, 231, 159, 0.88)',
  'rgba(189, 214, 210, 0.88)',
  'rgba(230, 218, 245, 0.88)',
];

const PASTEL_BORDER = [
  'rgba(140, 150, 190, 0.45)',
  'rgba(110, 175, 150, 0.45)',
  'rgba(210, 160, 130, 0.45)',
  'rgba(150, 175, 120, 0.45)',
  'rgba(200, 130, 125, 0.45)',
  'rgba(160, 110, 160, 0.45)',
  'rgba(100, 160, 185, 0.45)',
  'rgba(195, 175, 100, 0.45)',
  'rgba(120, 155, 145, 0.45)',
  'rgba(170, 150, 200, 0.45)',
];

const MAX_SLICES = 8;

function sliceRows(genres) {
  if (!genres?.length) return null;
  const sorted = [...genres].sort(
    (a, b) => (b.count ?? b.percent ?? 0) - (a.count ?? a.percent ?? 0)
  );
  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const labels = top.map((r) => r.genre);
  const data = top.map((r) => Number(r.count ?? r.percent ?? 0));
  if (rest.length) {
    const other = rest.reduce((s, r) => s + Number(r.count ?? r.percent ?? 0), 0);
    if (other > 0) {
      labels.push('Other');
      data.push(other);
    }
  }
  if (!data.some((v) => v > 0)) return null;
  return { labels, data };
}

function GenrePie({ label, genres }) {
  const prepared = useMemo(() => sliceRows(genres), [genres]);
  const chartData = useMemo(() => {
    if (!prepared) return null;
    return {
      labels: prepared.labels,
      datasets: [
        {
          data: prepared.data,
          backgroundColor: prepared.labels.map((_, i) => PASTEL_BG[i % PASTEL_BG.length]),
          borderColor: prepared.labels.map((_, i) => PASTEL_BORDER[i % PASTEL_BORDER.length]),
          borderWidth: 1,
        },
      ],
    };
  }, [prepared]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateRotate: true,
        animateScale: false,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            padding: 8,
            font: { size: 10 },
            color: '#555',
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0];
              const meta = chart.getDatasetMeta(0);
              const labels = chart.data.labels || [];
              const values = ds.data.map((v) => Number(v));
              const total = values.reduce((a, b) => a + b, 0);
              return labels.map((label, i) => {
                const pct =
                  total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0';
                return {
                  text: `${label} — ${pct}%`,
                  fillStyle: Array.isArray(ds.backgroundColor)
                    ? ds.backgroundColor[i]
                    : ds.backgroundColor,
                  strokeStyle: Array.isArray(ds.borderColor)
                    ? ds.borderColor[i]
                    : ds.borderColor,
                  lineWidth: ds.borderWidth ?? 0,
                  hidden: meta.data[i]?.hidden ?? false,
                  index: i,
                };
              });
            },
          },
        },
        tooltip: { enabled: false },
      },
    }),
    []
  );

  return (
    <div className="db-stat-card sac-card">
      <span className="db-stat-label">{label}</span>
      {!chartData ? (
        <p className="db-stat-empty">No genres yet</p>
      ) : (
        <div className="sac-chart-wrap">
          <Pie data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

export default function ShelfAnalyticsCharts({ shelfStats }) {
  if (!shelfStats) return null;
  return (
    <div className="db-stats-grid sac-stats-grid">
      <GenrePie label="Books" genres={shelfStats.books?.genres} />
      <GenrePie label="Movies" genres={shelfStats.movies?.genres} />
      <GenrePie label="Podcasts" genres={shelfStats.podcasts?.genres} />
    </div>
  );
}
