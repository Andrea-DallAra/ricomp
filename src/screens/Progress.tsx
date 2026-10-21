import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Measure, Photo } from '../db';
import { Settings } from '../lib/settings';
import { today, addDays, mondayOf, shortDate, longDate, diffDays } from '../lib/dates';
import { fmt, fmtKg } from '../lib/format';
import { e1rm, weekNumber } from '../lib/training';
import { sum } from '../lib/nutrition';
import { LineChart, movingAvg, Pt } from '../components/Chart';
import { Icon, Seg, Sheet, Stepper, TopBar, useToast, Empty, num } from '../components/ui';

type Tab = 'peso' | 'misure' | 'carichi' | 'foto' | 'checkin';

export default function Progress({ sub, settings }: { sub?: string; settings: Settings }) {
  const tab = (['peso', 'misure', 'carichi', 'foto', 'checkin'].includes(sub || '') ? sub : 'peso') as Tab;
  return (
    <>
      <TopBar title="Progressi" sub="Conta la tendenza, non il singolo giorno" />
      <Seg value={tab} onChange={(v) => (location.hash = '/progressi/' + v)} options={[{ v: 'peso', l: 'Peso' }, { v: 'misure', l: 'Misure' }, { v: 'carichi', l: 'Carichi' }, { v: 'foto', l: 'Foto' }, { v: 'checkin', l: 'Check-in' }]} />
      {tab === 'peso' && <WeightTab />}
      {tab === 'misure' && <MeasuresTab settings={settings} />}
      {tab === 'carichi' && <LoadsTab />}
      {tab === 'foto' && <PhotosTab />}
      {tab === 'checkin' && <CheckinTab settings={settings} />}
    </>
  );
}

const RANGES = [{ v: 28, l: '4 sett.' }, { v: 84, l: '12 sett.' }, { v: 9999, l: 'Tutto' }];
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export async function weekAvgs() {
  const ws = await db.weights.toArray();
  const m0 = mondayOf(today());
  const cur = avg(ws.filter((w) => w.date >= m0).map((w) => w.kg));
  const prev = avg(ws.filter((w) => w.date >= addDays(m0, -7) && w.date < m0).map((w) => w.kg));
  return { cur, prev, n: ws.filter((w) => w.date >= m0).length };
}

function WeightTab() {
  const toast = useToast();
  const [range, setRange] = useState(84);
  const all = useLiveQuery(() => db.weights.orderBy('date').toArray()) || [];
  const wk = useLiveQuery(() => weekAvgs(), [all.length]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [kg, setKg] = useState<number | null>(null);
  const from = addDays(today(), -range);
  const pts: Pt[] = all.filter((w) => w.date >= from).map((w) => ({ x: w.date, y: w.kg }));
  const ma = movingAvg(all.map((w) => ({ x: w.date, y: w.kg }))).filter((p) => p.x >= from);
  // tendenza: media ultimi 14 gg vs 14 precedenti
  const t0 = today();
  const a1 = avg(all.filter((w) => w.date > addDays(t0, -14)).map((w) => w.kg));
  const a0 = avg(all.filter((w) => w.date <= addDays(t0, -14) && w.date > addDays(t0, -28)).map((w) => w.kg));
  const trend = a1 != null && a0 != null ? (a1 - a0) / 2 : null;
  const delta = wk?.cur != null && wk?.prev != null ? wk.cur - wk.prev : null;

  return (
    <>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div className="stat"><div className="k">Media questa settimana</div><div className="v">{fmt(wk?.cur, 1)}<small>kg</small></div><div className="d">{wk?.n || 0} pesate</div></div>
        <div className="stat"><div className="k">Rispetto alla scorsa</div>
          <div className="v">{delta == null ? '–' : (delta > 0 ? '+' : '') + fmt(delta, 2)}<small>kg</small></div>
          <div className="d">{trend == null ? 'Servono 4 settimane di dati' : `Tendenza ${trend > 0 ? '+' : ''}${fmt(trend, 2)} kg/sett.`}</div></div>
      </div>
      <div className="panel">
        <div className="chips" style={{ marginBottom: 10 }}>{RANGES.map((r) => <button key={r.v} className={`chip ${range === r.v ? 'on' : ''}`} onClick={() => setRange(r.v)}>{r.l}</button>)}</div>
        <LineChart unit=" kg" series={[
          { name: 'Pesate', color: 'var(--dim)', points: pts, line: false, dots: true, dotColor: '#5f6863' },
          { name: 'Media 7 giorni', color: 'var(--lime)', points: ma },
        ]} />
        <p className="small muted" style={{ marginBottom: 0 }}>In ricomposizione il peso resta circa stabile: guarda anche la vita nelle Misure.</p>
      </div>
      <button className="btn primary block" onClick={() => { setDate(today()); setKg(all[all.length - 1]?.kg ?? 69); setOpen(true); }}><Icon name="plus" size={18} /> Registra peso</button>
      <div className="section-title">Storico</div>
      <div className="panel flush"><ul className="list">
        {[...all].reverse().slice(0, 60).map((w) => (
          <li key={w.date} className="li tap" onClick={() => { setDate(w.date); setKg(w.kg); setOpen(true); }}>
            <div className="grow t">{longDate(w.date)}</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmt(w.kg, 1)} kg</div>
          </li>
        ))}
      </ul></div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Peso"
        footer={<>
          {all.some((w) => w.date === date) && <button className="btn danger" onClick={async () => { await db.weights.delete(date); setOpen(false); toast('Pesata eliminata'); }} aria-label="Elimina"><Icon name="trash" size={18} /></button>}
          <button className="btn primary grow" onClick={async () => { if (kg) { await db.weights.put({ date, kg: Math.round(kg * 10) / 10 }); setOpen(false); toast('Peso salvato'); } }}>Salva</button></>}>
        <label className="field"><span>Data</span><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        <Stepper value={kg} onChange={setKg} step={0.1} dec={1} label="Peso in kg" />
      </Sheet>
    </>
  );
}

const MFIELDS: { k: keyof Measure; l: string; hint: string }[] = [
  { k: 'vita', l: 'Vita', hint: "All'ombelico, a fine espirazione" },
  { k: 'fianchi', l: 'Fianchi', hint: 'Punto più largo dei glutei' },
  { k: 'collo', l: 'Collo', hint: "Sotto il pomo d'Adamo" },
  { k: 'petto', l: 'Petto', hint: 'Sui capezzoli, a riposo' },
  { k: 'braccio', l: 'Braccio a riposo', hint: 'Metà braccio, rilassato' },
  { k: 'braccioC', l: 'Braccio contratto', hint: 'Punto più alto del bicipite' },
  { k: 'coscia', l: 'Coscia', hint: 'Metà coscia, in piedi' },
];

export const navyBF = (m: Measure, height: number) =>
  m.vita && m.collo && m.vita > m.collo ? 495 / (1.0324 - 0.19077 * Math.log10(m.vita - m.collo) + 0.15456 * Math.log10(height)) - 450 : null;

function MeasuresTab({ settings }: { settings: Settings }) {
  const toast = useToast();
  const all = useLiveQuery(() => db.measures.orderBy('date').toArray()) || [];
  const [key, setKey] = useState<keyof Measure | 'bf'>('vita');
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const last = all[all.length - 1];
  const first = all[0];
  const h = settings.profile.height;
  const pts: Pt[] = key === 'bf'
    ? all.map((m) => ({ x: m.date, y: navyBF(m, h) as number })).filter((p) => p.y != null)
    : all.filter((m) => m[key] != null).map((m) => ({ x: m.date, y: m[key] as number }));

  const openForm = () => {
    const f: Record<string, string> = { date: today() };
    for (const x of MFIELDS) f[x.k] = last?.[x.k] != null ? String(last[x.k]).replace('.', ',') : '';
    setForm(f);
  };
  const save = async () => {
    if (!form) return;
    const m: Measure = { date: form.date };
    for (const x of MFIELDS) { const v = num(form[x.k]); if (v != null) (m as any)[x.k] = v; }
    await db.measures.put(m); setForm(null); toast('Misure salvate');
  };

  return (
    <>
      <div className="panel">
        <div className="chips" style={{ marginBottom: 12 }}>
          {MFIELDS.map((f) => <button key={f.k} className={`chip ${key === f.k ? 'on' : ''}`} onClick={() => setKey(f.k)}>{f.l}</button>)}
          <button className={`chip ${key === 'bf' ? 'on' : ''}`} onClick={() => setKey('bf')}>% grasso</button>
        </div>
        <LineChart series={[{ name: key === 'bf' ? '% grasso' : MFIELDS.find((f) => f.k === key)!.l, color: 'var(--lime)', points: pts, dots: true }]} unit={key === 'bf' ? '%' : ' cm'} />
        {key === 'bf' && <p className="small muted" style={{ marginBottom: 0 }}>Stima con il metodo della Marina USA (vita, collo, altezza). Margine ±3–4%: utile per la tendenza, non come numero esatto.</p>}
      </div>
      <button className="btn primary block" onClick={openForm}><Icon name="plus" size={18} /> Nuove misure</button>
      {last && first && (
        <>
          <div className="section-title">Dal {shortDate(first.date)} a oggi</div>
          <div className="panel flush"><ul className="list">
            {MFIELDS.map((f) => {
              const a = first[f.k] as number, b = last[f.k] as number;
              const d = a != null && b != null ? b - a : null;
              const good = f.k === 'vita' || f.k === 'fianchi' ? (d || 0) < 0 : (d || 0) > 0;
              return (
                <li key={f.k} className="li">
                  <div className="grow t">{f.l}</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmt(b, 1)} cm</div>
                  <div className={`small ${d ? (good ? 'up' : 'down') : 'muted'}`} style={{ width: 54, textAlign: 'right' }}>{d == null || d === 0 ? '=' : (d > 0 ? '+' : '') + fmt(d, 1)}</div>
                </li>
              );
            })}
            <li className="li"><div className="grow t">% grasso stimata</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmt(navyBF(last, h), 1)}%</div><div className="small muted" style={{ width: 54, textAlign: 'right' }}>{navyBF(first, h) != null && navyBF(last, h) != null && Math.abs(navyBF(last, h)! - navyBF(first, h)!) >= 0.05 ? fmt(navyBF(last, h)! - navyBF(first, h)!, 1) : '='}</div></li>
          </ul></div>
          <p className="small muted">Misura la vita ogni settimana (stesso giorno, al mattino) e il resto ogni 2 settimane.</p>
        </>
      )}
      <Sheet open={!!form} onClose={() => setForm(null)} title="Nuove misure" footer={<button className="btn primary block" onClick={save}>Salva misure</button>}>
        {form && (
          <>
            <label className="field"><span>Data</span><input type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            {MFIELDS.map((f) => (
              <label key={f.k} className="field"><span>{f.l} (cm) · {f.hint}</span>
                <input inputMode="decimal" value={form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} /></label>
            ))}
          </>
        )}
      </Sheet>
    </>
  );
}

function LoadsTab() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').filter((w) => !!w.end).toArray()) || [];
  const names = useMemo(() => {
    const c = new Map<string, number>();
    for (const w of workouts) for (const e of w.exercises) if (e.sets.some((s) => s.done && s.w)) c.set(e.name, (c.get(e.name) || 0) + 1);
    return [...c.entries()].sort((a, b) => (a[0] === 'Panca piana bilanciere' ? -1 : b[0] === 'Panca piana bilanciere' ? 1 : b[1] - a[1])).map((x) => x[0]);
  }, [workouts]);
  const [sel, setSel] = useState<string>('');
  const name = sel || names[0];
  const rows = workouts.map((w) => {
    const e = w.exercises.find((x) => x.name === name);
    const sets = e?.sets.filter((s) => s.done && s.w && s.r) || [];
    if (!sets.length) return null;
    const best = sets.reduce((a, s) => (e1rm(s.w!, s.r!, s.rpe) > e1rm(a.w!, a.r!, a.rpe) ? s : a));
    return { date: w.date, e1: e1rm(best.w!, best.r!, best.rpe), top: best, vol: sets.reduce((a, s) => a + s.w! * s.r!, 0) };
  }).filter(Boolean) as { date: string; e1: number; top: any; vol: number }[];
  const isBench = name === 'Panca piana bilanciere';
  const max = rows.length ? Math.max(...rows.map((r) => r.e1)) : 0;

  if (!names.length) return <div className="panel"><Empty title="Ancora nessun carico">Dopo il primo allenamento trovi qui il massimale stimato di ogni esercizio.</Empty></div>;
  return (
    <>
      <select value={name} onChange={(e) => setSel(e.target.value)} style={{ marginBottom: 12 }}>{names.map((n) => <option key={n}>{n}</option>)}</select>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div className="stat"><div className="k">Massimale stimato</div><div className="v">{fmt(max, 1)}<small>kg</small></div><div className="d">{isBench ? `Mancano ${fmt(Math.max(0, 100 - max), 1)} kg ai 100` : 'Miglior serie (Epley + RPE)'}</div></div>
        <div className="stat"><div className="k">Ultima serie migliore</div><div className="v">{rows.length ? `${fmtKg(rows[rows.length - 1].top.w)}×${rows[rows.length - 1].top.r}` : '–'}</div><div className="d">{rows.length ? shortDate(rows[rows.length - 1].date) : ''}</div></div>
      </div>
      <div className="panel">
        <h2>Massimale stimato <small>kg</small></h2>
        <LineChart unit=" kg" series={[{ name: '1RM stimato', color: 'var(--lime)', points: rows.map((r) => ({ x: r.date, y: Math.round(r.e1 * 10) / 10 })), dots: true }]} goal={isBench ? { y: 100, label: 'Obiettivo 100 kg' } : undefined} />
      </div>
      <div className="section-title">Sedute</div>
      <div className="panel flush"><ul className="list">
        {[...rows].reverse().map((r) => (
          <li key={r.date} className="li"><div className="grow"><div className="t">{longDate(r.date)}</div><div className="s">Volume {fmt(r.vol)} kg</div></div>
            <div style={{ textAlign: 'right' }}><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtKg(r.top.w)} × {r.top.r}</div><div className="small muted">1RM ~{fmt(r.e1, 1)}</div></div></li>
        ))}
      </ul></div>
    </>
  );
}

async function resizeImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.82));
}

function useObjectURL(blob?: Blob) {
  const [u, setU] = useState('');
  useEffect(() => { if (!blob) return; const x = URL.createObjectURL(blob); setU(x); return () => URL.revokeObjectURL(x); }, [blob]);
  return u;
}
const Thumb = ({ p, onClick }: { p: Photo; onClick?: () => void }) => {
  const u = useObjectURL(p.blob);
  return <button className="ph" onClick={onClick}>{u && <img src={u} alt={`${p.pose} ${p.date}`} />}<span>{p.pose} · {shortDate(p.date)}</span></button>;
};

function PhotosTab() {
  const toast = useToast();
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray()) || [];
  const [pose, setPose] = useState<Photo['pose']>('fronte');
  const [view, setView] = useState<Photo | null>(null);
  const [cmp, setCmp] = useState(false);
  const dates = [...new Set(photos.filter((p) => p.pose === pose).map((p) => p.date))].sort();
  const [a, setA] = useState(''); const [b, setB] = useState('');
  const [cut, setCut] = useState(50);
  const pa = photos.find((p) => p.pose === pose && p.date === (a || dates[0]));
  const pb = photos.find((p) => p.pose === pose && p.date === (b || dates[dates.length - 1]));
  const ua = useObjectURL(pa?.blob), ub = useObjectURL(pb?.blob), uv = useObjectURL(view?.blob);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) await db.photos.add({ date: today(), pose, blob: await resizeImage(f) });
    toast('Foto salvata');
  };
  const last = photos[0]?.date;

  return (
    <>
      <Seg value={pose} onChange={(v) => setPose(v as any)} options={[{ v: 'fronte', l: 'Fronte' }, { v: 'lato', l: 'Lato' }, { v: 'retro', l: 'Retro' }]} />
      <div className="callout ok" style={{ marginBottom: 12 }}>Ogni 2 settimane: stessa luce, telefono all'altezza del petto (non dal basso), timer, posa rilassata.{last ? ` Ultime foto: ${shortDate(last)}${diffDays(today(), last) >= 14 ? ' — è ora di rifarle.' : '.'}` : ''}</div>
      <label className="btn primary block" style={{ marginBottom: 12 }}>
        <Icon name="camera" size={18} /> Aggiungi foto {pose}
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </label>
      {dates.length >= 2 && <button className="btn ghost block" style={{ marginBottom: 12 }} onClick={() => setCmp(true)}>Confronta prima e dopo</button>}
      {photos.filter((p) => p.pose === pose).length ? (
        <div className="photos">{photos.filter((p) => p.pose === pose).map((p) => <Thumb key={p.id} p={p} onClick={() => setView(p)} />)}</div>
      ) : <div className="panel"><Empty title="Nessuna foto">Le foto restano solo su questo telefono, dentro l'app.</Empty></div>}

      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${view.pose} · ${longDate(view.date)}` : ''}
        footer={<button className="btn danger block" onClick={async () => { await db.photos.delete(view!.id!); setView(null); toast('Foto eliminata'); }}>Elimina foto</button>}>
        {uv && <img src={uv} alt="" style={{ width: '100%', borderRadius: 16 }} />}
      </Sheet>
      <Sheet open={cmp} onClose={() => setCmp(false)} title="Prima e dopo">
        <div className="grid2" style={{ marginBottom: 10 }}>
          <select value={a || dates[0]} onChange={(e) => setA(e.target.value)}>{dates.map((d) => <option key={d} value={d}>{shortDate(d)}</option>)}</select>
          <select value={b || dates[dates.length - 1]} onChange={(e) => setB(e.target.value)}>{dates.map((d) => <option key={d} value={d}>{shortDate(d)}</option>)}</select>
        </div>
        <div className="compare" style={{ ['--cut' as any]: cut + '%' }}>
          {ua && <img src={ua} alt="prima" />}
          {ub && <img src={ub} alt="dopo" className="after" />}
          <div className="handle" />
          <span className="lab" style={{ left: 10 }}>{shortDate(a || dates[0])}</span>
          <span className="lab" style={{ right: 10 }}>{shortDate(b || dates[dates.length - 1])}</span>
        </div>
        <input type="range" min={0} max={100} value={cut} onChange={(e) => setCut(+e.target.value)} style={{ marginTop: 12, padding: 0, background: 'transparent', border: 0 }} aria-label="Scorri per confrontare" />
      </Sheet>
    </>
  );
}

function CheckinTab({ settings }: { settings: Settings }) {
  const toast = useToast();
  const week = weekNumber(settings.program.start);
  const m0 = mondayOf(today());
  const [f, setF] = useState({ sleep: 7, energy: 7, hunger: 5, adherence: 'più o meno', pain: '' });
  const data = useLiveQuery(async () => {
    const wk = await weekAvgs();
    const ms = await db.measures.orderBy('date').toArray();
    const lastM = ms[ms.length - 1];
    const ws = await db.workouts.where('date').between(m0, addDays(m0, 6), true, true).filter((w) => !!w.end).toArray();
    const best = (names: string[]) => {
      let out = '';
      let bestE = 0;
      for (const w of ws) for (const e of w.exercises) if (names.includes(e.name)) {
        const done = e.sets.filter((s) => s.done && s.w && s.r);
        for (const s of done) { const x = e1rm(s.w!, s.r!, s.rpe); if (x > bestE) { bestE = x; out = `${e.name.split(' ')[0]} ${done.map((d) => `${fmtKg(d.w)}×${d.r}${d.rpe ? '@' + d.rpe : ''}`).join(', ')}`; } }
      }
      return out || '–';
    };
    const days = await db.days.where('date').between(m0, addDays(m0, 6), true, true).toArray();
    const steps = avg(days.filter((d) => d.steps).map((d) => d.steps!));
    const logs = await db.logs.where('date').between(m0, addDays(m0, 6), true, true).toArray();
    const byDay = new Map<string, number>();
    for (const l of logs) byDay.set(l.date, (byDay.get(l.date) || 0) + l.kcal);
    const kcalAvg = avg([...byDay.values()]);
    const ok = [...byDay.values()].filter((k) => Math.abs(k - settings.targets.kcal) <= settings.targets.kcal * 0.1).length;
    const protAvg = avg([...new Set(logs.map((l) => l.date))].map((d) => sum(logs.filter((l) => l.date === d)).p));
    return { wk, lastM, ws, bench: best(['Panca piana bilanciere', 'Panca con fermo 1" al petto', 'Panca piana manubri']), squat: best(['Squat bilanciere', 'Hack squat', 'Safety bar squat']), dead: best(['Stacco da terra', 'Stacco con trap bar']), steps, kcalAvg, ok, nDays: byDay.size, protAvg };
  }, [m0]);
  const history = useLiveQuery(() => db.checkins.orderBy('date').reverse().toArray()) || [];

  if (!data) return null;
  const text = [
    `Settimana n°: ${week}`,
    `Peso medio: ${fmt(data.wk.cur, 1)} kg (settimana prima: ${fmt(data.wk.prev, 1)})`,
    `Vita: ${fmt(data.lastM?.vita, 1)} cm | Fianchi: ${fmt(data.lastM?.fianchi, 1)} cm${data.lastM ? ` (misurate il ${shortDate(data.lastM.date)})` : ''}`,
    `Panca: ${data.bench}`,
    `Squat / Stacco: ${data.squat} / ${data.dead}`,
    `Allenamenti fatti: ${data.ws.length} di 4`,
    `Passi medi: ${data.steps ? fmt(data.steps) : '–'}`,
    `Calorie rispettate: ${f.adherence} (media ${fmt(data.kcalAvg)} kcal su ${data.nDays} giorni registrati, ${data.ok} nel ±10%; proteine medie ${fmt(data.protAvg)} g)`,
    `Sonno, energia, fame (1–10): ${f.sleep}, ${f.energy}, ${f.hunger}`,
    `Fastidi alla spalla o altro: ${f.pain || 'nessuno'}`,
  ].join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    await db.checkins.add({ date: today(), week, text, sleep: f.sleep, energy: f.energy, hunger: f.hunger, adherence: f.adherence, pain: f.pain });
    toast('Copiato: incollalo nella chat con il coach');
  };
  const scale = (k: 'sleep' | 'energy' | 'hunger', l: string) => (
    <div className="field"><span>{l}: <b className="num" style={{ color: 'var(--text)', fontSize: 18 }}>{f[k]}</b></span>
      <input type="range" min={1} max={10} value={f[k]} onChange={(e) => setF({ ...f, [k]: +e.target.value })} style={{ padding: 0, background: 'transparent', border: 0 }} /></div>
  );

  return (
    <>
      <div className="panel">
        <h2>Le tue sensazioni</h2>
        {scale('sleep', 'Sonno')}{scale('energy', 'Energia')}{scale('hunger', 'Fame')}
        <div className="field"><span>Calorie rispettate</span>
          <div className="chips">{['sì', 'più o meno', 'no'].map((x) => <button key={x} className={`chip ${f.adherence === x ? 'on' : ''}`} onClick={() => setF({ ...f, adherence: x })}>{x}</button>)}</div></div>
        <label className="field" style={{ marginBottom: 0 }}><span>Fastidi alla spalla o altro</span><input value={f.pain} onChange={(e) => setF({ ...f, pain: e.target.value })} placeholder="nessuno" /></label>
      </div>
      <div className="panel">
        <h2>Aggiornamento <small>compilato in automatico</small></h2>
        <pre className="report">{text}</pre>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={copy}><Icon name="copy" size={18} /> Copia e salva</button>
      </div>
      {history.length > 0 && (
        <>
          <div className="section-title">Check-in precedenti</div>
          <div className="panel flush"><ul className="list">
            {history.map((c) => (
              <li key={c.id} className="li tap" onClick={async () => { await navigator.clipboard?.writeText(c.text).catch(() => {}); toast('Copiato'); }}>
                <div className="grow"><div className="t">Settimana {c.week}</div><div className="s">{longDate(c.date)} · tocca per copiare</div></div><Icon name="copy" size={18} />
              </li>
            ))}
          </ul></div>
        </>
      )}
    </>
  );
}
