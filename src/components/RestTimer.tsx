import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { vibrate } from '../lib/format';
import { showNow } from '../lib/push';

export async function startRest(seconds: number, label: string) {
  await db.kv.put({ key: 'rest', value: { end: Date.now() + seconds * 1000, total: seconds, label, notified: false } });
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}

export function RestTimer() {
  const rest = useLiveQuery(async () => (await db.kv.get('rest'))?.value);
  const [now, setNow] = useState(Date.now());
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest?.end]);

  const left = rest ? Math.round((rest.end - now) / 1000) : 0;
  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.end) return;
    fired.current = rest.end;
    if (!rest.notified) {
      vibrate([300, 120, 300, 120, 300]);
      beep();
      if (document.visibilityState !== 'visible') showNow('Recupero finito', `Prossima serie: ${rest.label}`, 'rest');
      db.kv.put({ key: 'rest', value: { ...rest, notified: true } });
    }
  }, [left, rest]);

  if (!rest) return null;
  if (left < -60) { db.kv.delete('rest'); return null; }
  const over = left <= 0;
  const a = Math.abs(left);
  const mm = Math.floor(a / 60), ss = String(a % 60).padStart(2, '0');
  return (
    <div className={`timer ${over ? 'over' : ''}`} role="timer" aria-live="polite">
      <div className="clock">{over ? '+' : ''}{mm}:{ss}</div>
      <div className="grow small" style={{ fontWeight: 600, lineHeight: 1.2 }}>{over ? 'Vai con la serie' : 'Recupero'}<div style={{ fontWeight: 500, opacity: 0.75 }} className="ellipsis">{rest.label}</div></div>
      {!over && <button onClick={() => db.kv.put({ key: 'rest', value: { ...rest, end: rest.end + 30000 } })}>+30"</button>}
      <button onClick={() => db.kv.delete('rest')}>{over ? 'Ok' : 'Salta'}</button>
    </div>
  );
}
