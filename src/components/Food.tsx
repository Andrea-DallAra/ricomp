import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Food } from '../data/foods';
import { CATEGORIES } from '../data/foods';
import { macrosFor } from '../lib/nutrition';
import { fmt, uid } from '../lib/format';
import { searchOnline } from '../lib/off';
import { Icon, Stepper, num } from './ui';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function FoodPicker({ onPick, allowOnline = true }: { onPick: (f: Food) => void; allowOnline?: boolean }) {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray()) || [];
  const [q, setQ] = useState('');
  const [online, setOnline] = useState<Food[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const list = useMemo(() => {
    const k = norm(q.trim());
    const l = k ? foods.filter((f) => norm(f.name + ' ' + (f.brand || '')).includes(k)) : foods;
    return l.slice(0, 80);
  }, [foods, q]);

  const goOnline = async () => {
    setBusy(true); setErr('');
    try { setOnline(await searchOnline(q)); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="row" style={{ position: 'sticky', top: 0, background: 'var(--s1)', paddingBottom: 8, zIndex: 1 }}>
        <input placeholder="Cerca alimento" value={q} onChange={(e) => { setQ(e.target.value); setOnline(null); }} autoFocus={false} />
      </div>
      <ul className="list">
        {list.map((f) => (
          <li key={f.id} className="li tap" style={{ padding: '10px 4px' }} onClick={() => onPick(f)}>
            <div className="grow">
              <div className="t ellipsis">{f.name}</div>
              <div className="s">{f.brand ? f.brand + ' · ' : ''}{f.kcal} kcal · P {f.p} · C {f.c} · G {f.f} per 100 {f.unit || 'g'}</div>
            </div>
            <Icon name="plus" size={20} />
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="muted small">Nessun alimento salvato con questo nome.</p>}
      {allowOnline && q.trim().length >= 3 && (
        <div style={{ marginTop: 10 }}>
          {!online && <button className="btn ghost block" disabled={busy} onClick={goOnline}><Icon name="search" size={18} />{busy ? 'Cerco…' : `Cerca "${q}" su Open Food Facts`}</button>}
          {err && <p className="small" style={{ color: 'var(--warn)' }}>{err}</p>}
          {online && (
            <>
              <div className="section-title" style={{ marginTop: 10 }}>Risultati online <small>{online.length}</small></div>
              <ul className="list">
                {online.map((f) => (
                  <li key={f.id} className="li tap" style={{ padding: '10px 4px' }} onClick={async () => { await db.foods.put(f); onPick(f); }}>
                    <div className="grow"><div className="t ellipsis">{f.name}</div><div className="s">{f.brand ? f.brand + ' · ' : ''}{f.kcal} kcal · P {f.p} · C {f.c} · G {f.f}</div></div>
                    <Icon name="plus" size={20} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function GramsPicker({ food, initial, onChange }: { food: Food; initial?: number; onChange: (g: number | null) => void }) {
  const [g, setG] = useState<number | null>(initial ?? (food.piece || 100));
  const set = (v: number | null) => { setG(v); onChange(v); };
  const m = macrosFor(food, g || 0);
  const u = food.unit || 'g';
  return (
    <div className="stack">
      <div style={{ fontWeight: 600, fontSize: 17 }}>{food.name}</div>
      <Stepper value={g} onChange={set} step={food.piece ? food.piece : 10} label={`Quantità in ${u}`} />
      <div className="chips">
        {food.piece ? [1, 2, 3, 4].map((n) => <button key={n} className="chip" onClick={() => set(food.piece! * n)}>{n} {food.pieceName}</button>)
          : [50, 100, 150, 200, 300].map((n) => <button key={n} className="chip" onClick={() => set(n)}>{n} {u}</button>)}
      </div>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Mini k="kcal" v={m.kcal} /><Mini k="Prot" v={m.p} c="var(--prot)" /><Mini k="Carb" v={m.c} c="var(--carb)" /><Mini k="Grassi" v={m.f} c="var(--fat)" />
      </div>
    </div>
  );
}

const Mini = ({ k, v, c }: { k: string; v: number; c?: string }) => (
  <div style={{ background: 'var(--s2)', borderRadius: 12, padding: '8px 10px' }}>
    <div className="small muted row" style={{ gap: 6 }}>{c && <i className="dot" style={{ background: c, width: 8, height: 8 }} />}{k}</div>
    <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{fmt(v)}</div>
  </div>
);

export function FoodForm({ food, onSave, onDelete }: { food?: Food; onSave: (f: Food) => void; onDelete?: () => void }) {
  const [f, setF] = useState<any>(food || { id: 'c_' + uid(), name: '', kcal: '', p: '', c: '', f: '', cat: 'Snack e altro', custom: true });
  const field = (k: string, label: string, numeric = true) => (
    <label className="field"><span>{label}</span>
      <input inputMode={numeric ? 'decimal' : 'text'} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  const valid = f.name && num(f.kcal) != null;
  return (
    <div>
      {field('name', 'Nome', false)}
      <div className="grid2">{field('kcal', 'kcal per 100 g')}{field('p', 'Proteine (g)')}{field('c', 'Carboidrati (g)')}{field('f', 'Grassi (g)')}</div>
      <div className="grid2">{field('piece', 'Peso di un pezzo (g, facoltativo)')}{field('pieceName', 'Nome del pezzo', false)}</div>
      <label className="field"><span>Categoria</span>
        <select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <div className="row">
        {onDelete && <button className="btn danger" onClick={onDelete}><Icon name="trash" size={18} /></button>}
        <button className="btn primary grow" disabled={!valid} onClick={() => onSave({
          ...f, kcal: num(f.kcal) || 0, p: num(f.p) || 0, c: num(f.c) || 0, f: num(f.f) || 0,
          piece: num(f.piece) || undefined, pieceName: f.pieceName || undefined,
        })}>Salva alimento</button>
      </div>
    </div>
  );
}
