import { addDays } from '../lib/dates';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  oggi: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  dieta: <><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M7 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M17 7c0-2 2-2 2-4" /></>,
  spesa: <><path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  allenamento: <><path d="M2 12h20" /><rect x="5" y="6" width="3" height="12" rx="1" /><rect x="16" y="6" width="3" height="12" rx="1" /><path d="M3 9v6M21 9v6" /></>,
  progressi: <><path d="M3 20h18" /><path d="m4 15 5-5 4 3 7-7" /><path d="M15 6h5v5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>,
  swap: <><path d="M7 4 3 8l4 4M3 8h14" /><path d="m17 20 4-4-4-4M21 16H7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 3" /></>,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  share: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
};

export function Icon({ name, size = 22, stroke = 1.9 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    // il tasto indietro di Android chiude il pannello
    history.pushState({ sheet: true }, '');
    const onPop = () => onClose();
    addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      removeEventListener('keydown', onKey);
      removeEventListener('popstate', onPop);
      if (history.state?.sheet) history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <header>
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.v} role="tab" aria-selected={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 100000, dec = 0, label }: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; max?: number; dec?: number; label?: string }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value).replace('.', ','));
  useEffect(() => { setTxt(value == null ? '' : String(value).replace('.', ',')); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, +n.toFixed(Math.max(dec, 2))));
  return (
    <div className="stepper">
      <button type="button" aria-label="Diminuisci" onClick={() => onChange(clamp((value || 0) - step))}>−</button>
      <input inputMode="decimal" aria-label={label} value={txt} onChange={(e) => {
        setTxt(e.target.value);
        const n = parseFloat(e.target.value.replace(',', '.'));
        onChange(isNaN(n) ? null : n);
      }} />
      <button type="button" aria-label="Aumenta" onClick={() => onChange(clamp((value || 0) + step))}>+</button>
    </div>
  );
}

export const num = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? null : n; };

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button className={`check ${on ? 'on' : ''}`} onClick={onClick} role="checkbox" aria-checked={on} aria-label={label}>
      {on && <Icon name="check" stroke={3} />}
    </button>
  );
}

export function MacroBar({ label, value, target, color, unit = 'g' }: { label: string; value: number; target: number; color: string; unit?: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="macro">
      <div className="lbl"><span className="muted">{label}</span><span><b>{Math.round(value)}</b><span className="muted"> / {target} {unit}</span></span></div>
      <div className="bar"><i style={{ width: pct + '%', background: color }} /></div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

type ToastFn = (msg: ReactNode, action?: { label: string; run: () => void }) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: ReactNode; action?: { label: string; run: () => void }; id: number } | null>(null);
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 3800); return () => clearTimeout(id); }, [t]);
  return (
    <ToastCtx.Provider value={(msg, action) => setT({ msg, action, id: Date.now() })}>
      {children}
      {t && (
        <div className="toast" role="status" key={t.id}>
          <div className="grow">{t.msg}</div>
          {t.action && <button className="btn small primary" onClick={() => { t.action!.run(); setT(null); }}>{t.action.label}</button>}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function TopBar({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="grow"><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {right}
    </div>
  );
}

export function DateNav({ date, setDate, label }: { date: string; setDate: (d: string) => void; label: string }) {
  const shift = (n: number) => setDate(addDays(date, n));
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="iconbtn" onClick={() => shift(-1)} aria-label="Giorno precedente"><Icon name="left" /></button>
      <div className="grow" style={{ textAlign: 'center', fontWeight: 600 }}>{label}</div>
      <button className="iconbtn" onClick={() => shift(1)} aria-label="Giorno successivo"><Icon name="right" /></button>
    </div>
  );
}
