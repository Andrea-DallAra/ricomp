import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parse, shortDate } from '../lib/dates';
import { fmt } from '../lib/format';

export type Pt = { x: string; y: number };
export type Series = { name: string; color: string; points: Pt[]; line?: boolean; dots?: boolean; dotColor?: string };

function niceTicks(min: number, max: number, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks, step };
}

export function LineChart({ series, height = 200, unit = '', dec = 1, goal }: { series: Series[]; height?: number; unit?: string; dec?: number; goal?: { y: number; label: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  const dates = useMemo(() => [...new Set(all.map((p) => p.x))].sort(), [series]);
  if (all.length === 0) return <div ref={ref} className="empty small">Ancora nessun dato da mostrare.</div>;

  const pad = { l: 38, r: 12, t: 26, b: 24 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const t0 = parse(dates[0]).getTime(), t1 = parse(dates[dates.length - 1]).getTime();
  const span = Math.max(t1 - t0, 86400000);
  const ys = all.map((p) => p.y).concat(goal ? [goal.y] : []);
  const { lo, hi, ticks } = niceTicks(Math.min(...ys), Math.max(...ys));
  const X = (d: string) => pad.l + (dates.length === 1 ? iw / 2 : ((parse(d).getTime() - t0) / span) * iw);
  const Y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = dates[0], bd = Infinity;
    for (const d of dates) { const dd = Math.abs(X(d) - px); if (dd < bd) { bd = dd; best = d; } }
    setHover(best);
  };

  const xLabels = dates.length <= 2 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]];
  const hv = hover ? series.map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((x) => x.p) : [];

  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Grafico ${series.map((s) => s.name).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end">{fmt(t, ticks.some((x) => x % 1) ? 1 : 0)}</text>
          </g>
        ))}
        {goal && (
          <g>
            <line x1={pad.l} x2={w - pad.r} y1={Y(goal.y)} y2={Y(goal.y)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1.5} />
            <text x={w - pad.r} y={Y(goal.y) - 6} textAnchor="end" style={{ fill: 'var(--muted)' }}>{goal.label}</text>
          </g>
        )}
        {xLabels.map((d, i) => (
          <text key={d} x={X(d)} y={height - 6} textAnchor={i === 0 && xLabels.length > 1 ? 'start' : i === xLabels.length - 1 && xLabels.length > 1 ? 'end' : 'middle'}>{shortDate(d)}</text>
        ))}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => (a.x < b.x ? -1 : 1));
          const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
          return (
            <g key={s.name}>
              {s.line !== false && pts.length > 1 && <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {(s.dots || pts.length === 1) && pts.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={4} fill={s.dotColor || s.color} stroke="var(--s1)" strokeWidth={2} />)}
            </g>
          );
        })}
        {hover && (
          <g pointerEvents="none">
            <line x1={X(hover)} x2={X(hover)} y1={pad.t - 4} y2={pad.t + ih} stroke="var(--muted)" strokeWidth={1} />
            {hv.map(({ s, p }) => <circle key={s.name} cx={X(hover)} cy={Y(p!.y)} r={5} fill={s.color} stroke="var(--s1)" strokeWidth={2} />)}
            <text className="tip" x={Math.min(Math.max(X(hover), pad.l + 60), w - pad.r - 60)} y={14} textAnchor="middle">
              {shortDate(hover)} · {hv.map(({ p }) => `${fmt(p!.y, dec)}${unit}`).join(' / ')}
            </text>
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <div className="row small muted" style={{ gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
          {series.map((s) => <span key={s.name} className="row" style={{ gap: 6 }}><i className="dot" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
    </div>
  );
}

/** Media mobile su 7 giorni (calendario, non 7 misure). */
export function movingAvg(points: Pt[], days = 7): Pt[] {
  const sorted = [...points].sort((a, b) => (a.x < b.x ? -1 : 1));
  return sorted.map((p) => {
    const t = parse(p.x).getTime();
    const win = sorted.filter((q) => { const tq = parse(q.x).getTime(); return tq <= t && tq > t - days * 86400000; });
    return { x: p.x, y: win.reduce((a, b) => a + b.y, 0) / win.length };
  });
}
