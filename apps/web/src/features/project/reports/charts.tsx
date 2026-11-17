import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { niceScale } from './chartLogic';

/* ---------- Cifra clave ---------- */
export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="qr-stat">
      <span className="qr-stat-label">{label}</span>
      <strong className="qr-stat-value">{value}</strong>
      {note ? <span className="qr-stat-note">{note}</span> : null}
    </div>
  );
}

/* ---------- Tarjeta de gráfico con leyenda y vista de tabla ---------- */
export type Series = { key: string; label: string; slot: 1 | 2 };

type ChartCardProps = {
  title: string;
  series?: Series[];
  /** Si existe, la tarjeta ofrece "Ver tabla" (el dato nunca depende solo del gráfico). */
  table?: { columns: string[]; rows: Array<Array<string | number>> };
  children: ReactNode;
  note?: string;
};

export function ChartCard({ title, series, table, children, note }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  return (
    <section className="qr-card" aria-labelledby={titleId}>
      <header className="qr-card-head">
        <h3 id={titleId}>{title}</h3>
        {table ? (
          <button type="button" className="qr-link" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}>
            {showTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        ) : null}
      </header>

      {series && series.length > 1 && !showTable ? (
        <ul className="qr-legend" aria-label="Leyenda">
          {series.map((item) => (
            <li key={item.key}>
              <span className={`qr-swatch qr-swatch--${item.slot}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {showTable && table ? (
        <table className="qr-table">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={cellIndex}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}

      {note ? <p className="qr-note">{note}</p> : null}
    </section>
  );
}

/* ---------- Columnas agrupadas (1–2 series) ---------- */
export type ColumnPoint = { label: string; tooltipLabel: string; values: Record<string, number> };

const DEFAULT_W = 520;
const H = 200;

/** Ancho real del contenedor: el SVG se dibuja a ese tamaño para que el texto no se encoja en móvil. */
function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_W);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) {
        setWidth(Math.max(260, next));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
const PAD = { top: 18, right: 8, bottom: 26, left: 30 };

function roundedColumn(x: number, width: number, baseline: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  const top = baseline - height;
  // Punta redondeada (4px) y base recta, apoyada en la línea base.
  return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${baseline} Z`;
}

export function ColumnChart({ series, points, ariaLabel }: { series: Series[]; points: ColumnPoint[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const { ref: wrapRef, width: W } = useChartWidth();

  const maxValue = Math.max(0, ...points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0)));
  const { max, ticks } = niceScale(maxValue);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const band = plotW / Math.max(1, points.length);
  const barW = Math.min(12, (band * 0.7) / series.length);
  // Si las fechas no caben, se muestra una sí y otra no (la última siempre).
  const labelEvery = band < 46 ? 2 : 1;
  const showLabel = (index: number) => index === points.length - 1 || (points.length - 1 - index) % labelEvery === 0;
  const gap = 2;
  const y = (value: number) => (value / max) * plotH;

  // Etiqueta selectiva: solo la banda con más actividad lleva sus valores.
  const peakIndex = points.reduce(
    (best, point, index) => {
      const total = series.reduce((sum, item) => sum + (point.values[item.key] ?? 0), 0);
      return total > best.total ? { index, total } : best;
    },
    { index: -1, total: 0 },
  ).index;

  const activePoint = active !== null ? points[active] : null;
  const tooltipLeft = active !== null ? ((PAD.left + band * active + band / 2) / W) * 100 : 0;

  return (
    <div className="qr-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="qr-svg">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="qr-gridline" x1={PAD.left} x2={W - PAD.right} y1={baseline - y(tick)} y2={baseline - y(tick)} />
            <text className="qr-axis" x={PAD.left - 6} y={baseline - y(tick) + 3} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line className="qr-baseline" x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} />

        {points.map((point, index) => {
          const center = PAD.left + band * index + band / 2;
          const groupW = series.length * barW + (series.length - 1) * gap;
          const isActive = active === index;
          return (
            <g key={point.label} className={isActive ? 'is-active' : undefined}>
              {series.map((item, seriesIndex) => {
                const value = point.values[item.key] ?? 0;
                if (value <= 0) {
                  return null;
                }
                const x = center - groupW / 2 + seriesIndex * (barW + gap);
                const height = y(value);
                return (
                  <g key={item.key}>
                    <path className={`qr-bar qr-bar--${item.slot}`} d={roundedColumn(x, barW, baseline, height)} />
                    {index === peakIndex ? (
                      <text className="qr-value" x={x + barW / 2} y={baseline - height - 5} textAnchor="middle">
                        {value}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {showLabel(index) ? (
                <text className="qr-axis" x={center} y={H - 8} textAnchor="middle">
                  {point.label}
                </text>
              ) : null}
              {/* Zona de interacción: toda la banda, más grande que la barra. */}
              <rect
                className="qr-hit"
                x={PAD.left + band * index}
                y={PAD.top}
                width={band}
                height={plotH}
                tabIndex={0}
                aria-label={`${point.tooltipLabel}: ${series.map((item) => `${point.values[item.key] ?? 0} ${item.label.toLowerCase()}`).join(', ')}`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>

      {activePoint ? (
        <div className="qr-tooltip" style={{ left: `${tooltipLeft}%` }} role="presentation">
          <span className="qr-tooltip-title">{activePoint.tooltipLabel}</span>
          {series.map((item) => (
            <span key={item.key} className="qr-tooltip-row">
              <span className={`qr-key qr-key--${item.slot}`} aria-hidden="true" />
              <strong>{activePoint.values[item.key] ?? 0}</strong> {item.label.toLowerCase()}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Burndown (línea) ---------- */
export function BurndownChart({ points, ariaLabel }: { points: Array<{ label: string; value: number }>; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const { ref: wrapRef, width: W } = useChartWidth();
  const maxValue = Math.max(0, ...points.map((point) => point.value));
  const { max, ticks } = niceScale(maxValue);
  const plotW = W - PAD.left - PAD.right - 30;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (index: number) => PAD.left + 10 + index * step;
  const y = (value: number) => baseline - (value / max) * plotH;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
  const last = points[points.length - 1];
  const activePoint = active !== null ? points[active] : null;

  return (
    <div className="qr-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="qr-svg">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="qr-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="qr-axis" x={PAD.left - 6} y={y(tick) + 3} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line className="qr-baseline" x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} />
        {points.length > 1 ? <path className="qr-line" d={path} /> : null}
        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              className={`qr-dot${index === points.length - 1 || active === index ? ' is-shown' : ''}`}
              cx={x(index)}
              cy={y(point.value)}
              r={4}
            />
            {index === 0 || index === points.length - 1 ? (
              <text className="qr-axis" x={x(index)} y={H - 8} textAnchor="middle">
                {point.label}
              </text>
            ) : null}
            <rect
              className="qr-hit"
              x={x(index) - Math.max(12, step / 2)}
              y={PAD.top}
              width={Math.max(24, step)}
              height={plotH}
              tabIndex={0}
              aria-label={`${point.label}: ${point.value} pendientes`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        {last ? (
          <text className="qr-value" x={x(points.length - 1) + 10} y={y(last.value) - 8}>
            {last.value} pendientes
          </text>
        ) : null}
      </svg>
      {activePoint && active !== null ? (
        <div className="qr-tooltip" style={{ left: `${(x(active) / W) * 100}%` }} role="presentation">
          <span className="qr-tooltip-title">{activePoint.label}</span>
          <span className="qr-tooltip-row">
            <strong>{activePoint.value}</strong> pendientes
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Lista de barras (un solo color) ---------- */
export function MeterList({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="qr-meters">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="qr-meter-label">{row.label}</span>
          <span className="qr-meter-track" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="qr-meter-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
