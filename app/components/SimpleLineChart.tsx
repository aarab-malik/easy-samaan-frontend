'use client';

export interface LineChartPoint {
  label: string;
  value: number;
}

/** Lightweight SVG line chart (no extra dependencies). */
export default function SimpleLineChart({
  points,
  title,
  height = 180,
}: {
  points: LineChartPoint[];
  title?: string;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-black/60">
        No data for this period yet.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const maxV = Math.max(...values, 1);
  const w = 640;
  const pad = 28;
  const innerW = w - pad * 2;
  const innerH = height - pad * 2;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + innerH - (p.value / maxV) * innerH;
    return `${x},${y}`;
  });
  const polyline = coords.join(' ');

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      {title && <p className="mb-3 text-sm font-bold text-black">{title}</p>}
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full max-h-[220px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={title || 'Trend chart'}
      >
        <polyline
          fill="none"
          stroke="#c25a00"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
        {points.map((p, i) => {
          const x = pad + i * step;
          const y = pad + innerH - (p.value / maxV) * innerH;
          return <circle key={p.label + i} cx={x} cy={y} r="4" fill="#FF8D28" stroke="#1e1e1e" strokeWidth="1" />;
        })}
        {points.map((p, i) => {
          if (i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return null;
          const x = pad + i * step;
          return (
            <text key={`t-${p.label}`} x={x} y={height - 6} textAnchor="middle" className="fill-black/55 text-[10px]">
              {p.label.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
