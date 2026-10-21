import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Workout, ExLog } from '../db';
import { Exercise, Session, isDeload } from '../data/program';
import { Settings, updateSettings } from '../lib/settings';
import { today, DAYS_SHORT, mondayOf, addDays, shortDate, longDate } from '../lib/dates';
import { fmt, fmtKg } from '../lib/format';
import { weekNumber, phaseOf, targetFor, lastFor, suggest, startWorkout, activeWorkout, e1rm, volume, Suggestion } from '../lib/training';
import { Icon, Sheet, TopBar, useToast, Empty, num } from '../components/ui';
import { startRest } from '../components/RestTimer';

export default function Training({ sub, settings }: { sub: string[]; settings: Settings }) {
  const [view, arg] = sub;
  if (view === 'avvia') return <Starter sessionId={arg} settings={settings} />;
  if (view === 'sessione') return <WorkoutView id={Number(arg)} settings={settings} />;
  if (view === 'storico') return <History settings={settings} />;
  if (view === 'scheda') return <ProgramEditor settings={settings} />;
  return <Overview settings={settings} />;
}

const findEx = (settings: Settings, sessionId: string, exId: string) =>
  settings.program.sessions.find((s) => s.id === sessionId)?.exercises.find((e) => e.id === exId);

function Overview({ settings }: { settings: Settings }) {
  const week = weekNumber(settings.program.start);
  const phase = phaseOf(week);
  const active = useLiveQuery(() => activeWorkout());
  const weekStart = mondayOf(today());
  const thisWeek = useLiveQuery(() => db.workouts.where('date').between(weekStart, addDays(weekStart, 6), true, true).filter((w) => !!w.end).toArray(), [weekStart]) || [];
  const lastBySession = useLiveQuery(async () => {
    const all = await db.workouts.orderBy('date').reverse().filter((w) => !!w.end).toArray();
    const m: Record<string, string> = {};
    for (const w of all) if (!m[w.sessionId]) m[w.sessionId] = w.date;
    return m;
  }) || {};
  const dayOf = (sid: string) => Object.entries(settings.program.schedule).filter(([, v]) => v === sid).map(([d]) => DAYS_SHORT[+d]).join(', ');
  const todaySid = settings.program.schedule[new Date().getDay()];

  return (
    <>
      <TopBar title="Allenamento" sub={<>Upper/Lower · 4 giorni · {thisWeek.length} di 4 fatti questa settimana</>}
        right={<a className="iconbtn" href="#/allenamento/storico" aria-label="Storico"><Icon name="history" /></a>} />

      <div className="panel">
        <div className="row between"><div style={{ fontFamily: 'var(--cond)', fontSize: 26, fontWeight: 700 }}>Settimana {week}{week <= 12 ? ' di 12' : ''}</div><span className={`badge ${isDeload(week) ? 'warn' : 'lime'}`}>{phase.label}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>{phase.tip}</div>
        <div className="week" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <i key={i} className={`${i + 1 < week ? 'done' : i + 1 === week ? 'now' : ''} ${isDeload(i + 1) ? 'deload' : ''}`} />)}
        </div>
      </div>

      {active && (
        <a className="panel row between" href={`#/allenamento/sessione/${active.id}`} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--lime)' }}>
          <div><div style={{ fontWeight: 600 }}>{settings.program.sessions.find((s) => s.id === active.sessionId)?.name} in corso</div><div className="muted small">Tocca per riprendere</div></div>
          <Icon name="right" />
        </a>
      )}

      <div className="section-title">Sedute<small><a href="#/allenamento/scheda" style={{ color: 'var(--lime)' }}>Modifica scheda</a></small></div>
      {settings.program.sessions.map((s) => {
        const doneWeek = thisWeek.some((w) => w.sessionId === s.id);
        return (
          <div key={s.id} className="panel">
            <div className="row between">
              <div className="grow">
                <div className="row" style={{ gap: 8 }}><span style={{ fontFamily: 'var(--cond)', fontSize: 25, fontWeight: 700 }}>{s.name}</span>{todaySid === s.id && <span className="badge lime">oggi</span>}{doneWeek && <span className="badge">fatta</span>}</div>
                <div className="muted small">{s.focus} · {dayOf(s.id) || 'nessun giorno'}{lastBySession[s.id] ? ` · ultima ${shortDate(lastBySession[s.id])}` : ''}</div>
              </div>
              {!active && <a className={`btn ${todaySid === s.id ? 'primary' : 'ghost'} small`} href={`#/allenamento/avvia/${s.id}`}>Inizia</a>}
            </div>
            <ul className="list small" style={{ marginTop: 10 }}>
              {s.exercises.map((e) => { const t = targetFor(e, week); return (
                <li key={e.id} className="row between" style={{ padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                  <span className="ellipsis">{e.name}</span><span className="muted num" style={{ fontSize: 15 }}>{t.sets}×{t.repMin === t.repMax ? t.repMin : `${t.repMin}–${t.repMax}`}{e.perSide ? '/lato' : ''}</span>
                </li>); })}
            </ul>
          </div>
        );
      })}
      <div className="callout" style={{ marginBottom: 12 }}>Spalla sinistra: niente dips, tirate al mento o lento dietro la nuca. Prima di superare il 90% del massimale in panca fai la valutazione dal fisioterapista.</div>
    </>
  );
}

function Starter({ sessionId, settings }: { sessionId: string; settings: Settings }) {
  useEffect(() => {
    const s = settings.program.sessions.find((x) => x.id === sessionId);
    if (!s) { location.hash = '/allenamento'; return; }
    startWorkout(s, weekNumber(settings.program.start)).then((id) => location.replace(`#/allenamento/sessione/${id}`));
  }, [sessionId]);
  return null;
}

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function WorkoutView({ id, settings }: { id: number; settings: Settings }) {
  const toast = useToast();
  const w = useLiveQuery(() => db.workouts.get(id), [id]);
  const [menu, setMenu] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const info = useLiveQuery(async () => {
    if (!w) return null;
    const out: Record<string, { last: ExLog | null; lastDate?: string; s: Suggestion }> = {};
    for (const ex of w.exercises) {
      const def = findEx(settings, w.sessionId, ex.exId);
      if (!def) continue;
      const last = await lastFor(ex.name, w.id);
      out[ex.name] = { last: last?.ex || null, lastDate: last?.w.date, s: suggest(def, targetFor(def, w.week), last?.ex || null, w.week, ex.name) };
    }
    return out;
  }, [w?.id, w?.exercises.map((e) => e.name).join('|')]);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  if (!w) return null;
  const session = settings.program.sessions.find((s) => s.id === w.sessionId);
  const save = (exercises: ExLog[]) => db.workouts.update(id, { exercises });
  const setField = (ei: number, si: number, patch: any) => {
    const ex = w.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) }));
    save(ex);
  };
  const toggleDone = (ei: number, si: number) => {
    const e = w.exercises[ei]; const s = e.sets[si];
    const def = findEx(settings, w.sessionId, e.exId);
    if (!s.done) {
      if (s.r == null) { toast('Inserisci le ripetizioni fatte'); return; }
      const wgt = s.w ?? info?.[e.name]?.s.w ?? null;
      // propaga il carico alle serie successive vuote
      const sets = e.sets.map((x, j) => (j === si ? { ...x, w: wgt, done: true } : j > si && !x.done && x.w == null ? { ...x, w: wgt } : x));
      save(w.exercises.map((x, i) => (i === ei ? { ...x, sets } : x)));
      if (def && !w.end) startRest(def.rest, si + 1 < e.sets.length ? `${e.name} · serie ${si + 2}` : (w.exercises[ei + 1]?.name || 'Ultimo esercizio fatto'));
    } else setField(ei, si, { done: false });
  };
  const finish = async () => {
    await db.workouts.update(id, { end: Date.now() });
    await db.kv.delete('rest');
    // record (1RM stimato)
    const prs: string[] = [];
    for (const e of w.exercises) {
      const best = Math.max(0, ...e.sets.filter((s) => s.done).map((s) => e1rm(s.w || 0, s.r || 0, s.rpe)));
      if (!best) continue;
      const prev = await db.workouts.filter((x) => !!x.end && x.id !== id).toArray();
      const prevBest = Math.max(0, ...prev.flatMap((x) => x.exercises.filter((y) => y.name === e.name).flatMap((y) => y.sets.filter((s) => s.done).map((s) => e1rm(s.w || 0, s.r || 0, s.rpe)))));
      if (prevBest && best > prevBest + 0.1) prs.push(`${e.name} ${fmt(best, 1)} kg`);
    }
    toast(prs.length ? <><b>Nuovi record:</b> {prs.join(', ')}</> : <>Allenamento salvato · volume {fmt(volume({ ...w }) / 1000, 1)} t</>);
    location.hash = '/allenamento';
  };
  const discard = async () => { await db.workouts.delete(id); await db.kv.delete('rest'); location.hash = '/allenamento'; };
  const mins = Math.round(((w.end || Date.now()) - w.start) / 60000);
  const doneSets = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const totSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const menuEx = menu != null ? w.exercises[menu] : null;
  const menuDef = menuEx ? findEx(settings, w.sessionId, menuEx.exId) : null;

  return (
    <>
      <TopBar title={session?.name || 'Allenamento'}
        sub={<>{w.end ? longDate(w.date) : `In corso da ${mins} min`} · {doneSets}/{totSets} serie · settimana {w.week}{isDeload(w.week) ? ' (scarico)' : ''}</>}
        right={<a className="iconbtn" href="#/allenamento" aria-label="Indietro"><Icon name="left" /></a>} />

      {w.exercises.map((e, ei) => {
        const def = findEx(settings, w.sessionId, e.exId);
        const t = def ? targetFor(def, w.week) : null;
        const inf = info?.[e.name];
        return (
          <div key={ei} className="ex">
            <div className="ex-head row between" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="name">{e.name}</div>
                {t && <div className="meta">{t.sets} × {t.repMin === t.repMax ? t.repMin : `${t.repMin}–${t.repMax}`}{def?.perSide ? ' per lato' : ''} · RPE {t.rpe} · recupero {Math.floor(def!.rest / 60)}'{def!.rest % 60 ? String(def!.rest % 60).padStart(2, '0') : ''}</div>}
              </div>
              <button className="iconbtn" style={{ background: 'var(--s2)' }} onClick={() => setMenu(ei)} aria-label="Opzioni esercizio"><Icon name="more" /></button>
            </div>
            {inf && (inf.s.text || inf.last) && (
              <div className={`sugg ${inf.s.up ? 'upw' : ''}`}>
                {inf.s.text}{inf.last ? <div className="dim" style={{ marginTop: 2 }}>Ultima volta{inf.lastDate ? ` (${shortDate(inf.lastDate)})` : ''}: {inf.last.sets.filter((s) => s.done).map((s) => `${fmtKg(s.w)}×${s.r}${s.rpe ? '@' + String(s.rpe).replace('.', ',') : ''}`).join('  ')}</div> : null}
              </div>
            )}
            {def?.note && <div className="small muted" style={{ padding: '2px 16px 4px' }}>{def.note}</div>}
            <div className="sets">
              <div className="set head"><span style={{ textAlign: 'center' }}>#</span><span style={{ textAlign: 'center' }}>{def?.id === 'chin_up' ? 'zavorra kg' : 'kg'}</span><span style={{ textAlign: 'center' }}>rip</span><span style={{ textAlign: 'center' }}>RPE</span><span /></div>
              {e.sets.map((s, si) => (
                <div key={si} className={`set ${s.done ? 'done' : ''}`}>
                  <span className="n">{si + 1}</span>
                  <input inputMode="decimal" aria-label={`Carico serie ${si + 1}`} placeholder={inf?.s.w != null ? fmtKg(inf.s.w) : def?.noLoad ? '—' : 'kg'}
                    value={s.w == null ? '' : String(s.w).replace('.', ',')} onChange={(ev) => setField(ei, si, { w: num(ev.target.value) })} />
                  <input inputMode="numeric" aria-label={`Ripetizioni serie ${si + 1}`} placeholder={t ? (t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`) : ''}
                    value={s.r == null ? '' : String(s.r)} onChange={(ev) => setField(ei, si, { r: num(ev.target.value) })} />
                  <select aria-label={`RPE serie ${si + 1}`} value={s.rpe ?? ''} onChange={(ev) => setField(ei, si, { rpe: ev.target.value ? Number(ev.target.value) : null })}>
                    <option value="">–</option>{RPES.map((r) => <option key={r} value={r}>{String(r).replace('.', ',')}</option>)}
                  </select>
                  <button className={`check ${s.done ? 'on' : ''}`} style={{ width: 40, height: 40, borderRadius: 12 }} onClick={() => toggleDone(ei, si)} aria-label={s.done ? 'Serie fatta' : 'Segna serie fatta'}>
                    {s.done ? <Icon name="check" stroke={3} /> : <Icon name="check" stroke={2} size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="row" style={{ marginBottom: 12 }}>
        {!w.end ? <>
          <button className="btn danger" onClick={() => setFinishing(true)}>Annulla</button>
          <button className="btn primary grow" onClick={finish}>Termina allenamento</button>
        </> : <>
          <button className="btn danger" onClick={() => setFinishing(true)}>Elimina</button>
          <a className="btn ghost grow" href="#/allenamento/storico">Torna allo storico</a>
        </>}
      </div>

      <Sheet open={menu != null} onClose={() => setMenu(null)} title={menuEx?.name || ''}>
        {menuEx && (
          <div className="stack">
            {menuDef && (
              <>
                <div className="muted small">Cambia variante (i carichi vengono tracciati separatamente)</div>
                <div className="chips" style={{ flexWrap: 'wrap' }}>
                  {[menuDef.name, ...menuDef.alts].map((n) => (
                    <button key={n} className={`chip ${menuEx.name === n ? 'on' : ''}`} onClick={() => { save(w.exercises.map((x, i) => (i === menu ? { ...x, name: n, sets: x.sets.map((s) => (s.done ? s : { ...s, w: null })) } : x))); setMenu(null); }}>{n}</button>
                  ))}
                </div>
              </>
            )}
            <div className="row">
              <button className="btn grow" onClick={() => { save(w.exercises.map((x, i) => (i === menu ? { ...x, sets: [...x.sets, { w: x.sets[x.sets.length - 1]?.w ?? null, r: null, rpe: null, done: false }] } : x))); setMenu(null); }}><Icon name="plus" size={18} /> Serie</button>
              <button className="btn grow" disabled={menuEx.sets.length <= 1} onClick={() => { save(w.exercises.map((x, i) => (i === menu ? { ...x, sets: x.sets.slice(0, -1) } : x))); setMenu(null); }}><Icon name="minus" size={18} /> Serie</button>
            </div>
            <button className="btn ghost block" onClick={() => { save(w.exercises.filter((_, i) => i !== menu)); setMenu(null); }}>Salta questo esercizio oggi</button>
          </div>
        )}
      </Sheet>

      <Sheet open={finishing} onClose={() => setFinishing(false)} title={w.end ? 'Eliminare l\'allenamento?' : 'Annullare l\'allenamento?'}
        footer={<><button className="btn ghost grow" onClick={() => setFinishing(false)}>No</button><button className="btn danger grow" onClick={discard}>Sì, elimina</button></>}>
        <p className="muted" style={{ marginTop: 0 }}>Le serie registrate in questa seduta andranno perse.</p>
      </Sheet>
    </>
  );
}

function History({ settings }: { settings: Settings }) {
  const list = useLiveQuery(() => db.workouts.orderBy('date').reverse().filter((w) => !!w.end).limit(100).toArray()) || [];
  return (
    <>
      <TopBar title="Storico" sub={`${list.length} allenamenti`} right={<a className="iconbtn" href="#/allenamento" aria-label="Indietro"><Icon name="left" /></a>} />
      {!list.length ? <div className="panel"><Empty title="Ancora nessun allenamento">Inizia la prima seduta: qui trovi ogni serie, con carichi e RPE.</Empty></div> : (
        <div className="panel flush"><ul className="list">
          {list.map((w) => {
            const s = settings.program.sessions.find((x) => x.id === w.sessionId);
            const main = w.exercises[0];
            const top = main?.sets.filter((x) => x.done).sort((a, b) => (b.w || 0) - (a.w || 0))[0];
            return (
              <li key={w.id} className="li tap" onClick={() => (location.hash = `/allenamento/sessione/${w.id}`)}>
                <div className="grow">
                  <div className="t">{s?.name || w.sessionId} <span className="muted small">· {longDate(w.date)}</span></div>
                  <div className="s ellipsis">{top ? `${main.name}: ${fmtKg(top.w)} kg × ${top.r}` : ''} · {Math.round(((w.end || 0) - w.start) / 60000)} min · {fmt(volume(w) / 1000, 1)} t</div>
                </div>
                <Icon name="right" size={18} />
              </li>
            );
          })}
        </ul></div>
      )}
    </>
  );
}

function ProgramEditor({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(settings.program)) as Settings['program']);
  const [edit, setEdit] = useState<{ si: number; ei: number } | null>(null);
  const ex = edit ? p.sessions[edit.si].exercises[edit.ei] : null;
  const setEx = (patch: Partial<Exercise>) => {
    if (!edit) return;
    const sessions = p.sessions.map((s, i) => (i !== edit.si ? s : { ...s, exercises: s.exercises.map((e, j) => (j !== edit.ei ? e : { ...e, ...patch })) }));
    setP({ ...p, sessions });
  };
  const save = async () => { await updateSettings({ program: p }); toast('Scheda salvata'); location.hash = '/allenamento'; };
  const field = (k: keyof Exercise, label: string) => (
    <label className="field"><span>{label}</span><input inputMode="decimal" value={String((ex as any)?.[k] ?? '')} onChange={(e) => setEx({ [k]: num(e.target.value) ?? 0 } as any)} /></label>
  );

  return (
    <>
      <TopBar title="Modifica scheda" right={<a className="iconbtn" href="#/allenamento" aria-label="Indietro"><Icon name="left" /></a>} />
      <div className="panel">
        <h2>Programma</h2>
        <label className="field"><span>Inizio settimana 1 (lunedì)</span><input type="date" value={p.start} onChange={(e) => setP({ ...p, start: e.target.value })} /></label>
        <div className="muted small" style={{ marginBottom: 8 }}>Giorni di allenamento</div>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <div key={d} className="row" style={{ marginBottom: 6 }}>
            <div style={{ width: 44 }}>{DAYS_SHORT[d]}</div>
            <select value={p.schedule[d] || ''} onChange={(e) => { const sc = { ...p.schedule }; if (e.target.value) sc[d] = e.target.value; else delete sc[d]; setP({ ...p, schedule: sc }); }}>
              <option value="">Riposo</option>{p.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ))}
      </div>
      {p.sessions.map((s, si) => (
        <section key={s.id}>
          <div className="section-title">{s.name}<small>{s.focus}</small></div>
          <div className="panel flush"><ul className="list">
            {s.exercises.map((e, ei) => (
              <li key={ei} className="li tap" onClick={() => setEdit({ si, ei })}>
                <div className="grow"><div className="t">{e.name}</div><div className="s">{e.sets}×{e.repMin}–{e.repMax} · RPE {e.rpe} · {e.rest}" · +{e.inc} kg</div></div>
                <Icon name="edit" size={18} />
              </li>
            ))}
            <li className="li tap" style={{ color: 'var(--lime)', fontWeight: 600 }} onClick={() => {
              const id = 'x_' + Date.now().toString(36);
              const sessions = p.sessions.map((x, i) => (i !== si ? x : { ...x, exercises: [...x.exercises, { id, name: 'Nuovo esercizio', alts: [], sets: 3, repMin: 8, repMax: 12, rpe: '8', rpeMax: 8, rest: 90, inc: 2.5 }] }));
              setP({ ...p, sessions }); setEdit({ si, ei: s.exercises.length });
            }}><Icon name="plus" /> Aggiungi esercizio</li>
          </ul></div>
        </section>
      ))}
      <div className="row" style={{ margin: '12px 0' }}>
        <button className="btn ghost" onClick={() => { if (confirm('Ripristinare la scheda originale?')) { import('../lib/settings').then(({ defaultSettings }) => setP({ ...defaultSettings().program, start: p.start })); } }}>Ripristina</button>
        <button className="btn primary grow" onClick={save}>Salva scheda</button>
      </div>
      <Sheet open={!!ex} onClose={() => setEdit(null)} title="Esercizio"
        footer={<><button className="btn danger" onClick={() => { const sessions = p.sessions.map((s, i) => (i !== edit!.si ? s : { ...s, exercises: s.exercises.filter((_, j) => j !== edit!.ei) })); setP({ ...p, sessions }); setEdit(null); }} aria-label="Elimina esercizio"><Icon name="trash" size={18} /></button><button className="btn primary grow" onClick={() => setEdit(null)}>Fatto</button></>}>
        {ex && (
          <>
            <label className="field"><span>Nome</span><input value={ex.name} onChange={(e) => setEx({ name: e.target.value })} /></label>
            <div className="grid3">{field('sets', 'Serie')}{field('repMin', 'Rip min')}{field('repMax', 'Rip max')}</div>
            <div className="grid3">
              <label className="field"><span>RPE</span><input value={ex.rpe} onChange={(e) => setEx({ rpe: e.target.value, rpeMax: num(e.target.value.split(/[–-]/).pop() || '') ?? 8 })} /></label>
              {field('rest', 'Recupero (s)')}{field('inc', 'Aumento kg')}
            </div>
            <label className="field"><span>Alternative (separate da virgola)</span><input value={ex.alts.join(', ')} onChange={(e) => setEx({ alts: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
            <label className="field"><span>Nota tecnica</span><textarea rows={2} value={ex.note || ''} onChange={(e) => setEx({ note: e.target.value })} /></label>
          </>
        )}
      </Sheet>
    </>
  );
}
