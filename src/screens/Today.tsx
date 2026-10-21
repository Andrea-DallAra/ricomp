import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Settings } from '../lib/settings';
import { useNow } from '../lib/hooks';
import { today, longDate, diffDays, weekday, mondayOf } from '../lib/dates';
import { fmt } from '../lib/format';
import { sum, upcomingPlan, computeNeeds, foodMap, recipeMacros, logRecipe, qtyLabel, buyQty } from '../lib/nutrition';
import { weekNumber, phaseOf, activeWorkout } from '../lib/training';
import { MEALS } from '../data/recipes';
import { Icon, MacroBar, Sheet, Stepper, TopBar, Check, useToast } from '../components/ui';

export default function Today({ settings }: { settings: Settings }) {
  useNow();
  const d = today();
  const toast = useToast();
  const t = settings.targets;
  const week = weekNumber(settings.program.start, d);
  const phase = phaseOf(week);
  const sessionId = settings.program.schedule[weekday(d)];
  const session = settings.program.sessions.find((s) => s.id === sessionId);

  const logs = useLiveQuery(() => db.logs.where('date').equals(d).toArray(), [d]) || [];
  const day = useLiveQuery(() => db.days.get(d), [d]);
  const weightToday = useLiveQuery(() => db.weights.get(d), [d]);
  const lastWeight = useLiveQuery(() => db.weights.orderBy('date').last());
  const active = useLiveQuery(() => activeWorkout());
  const doneToday = useLiveQuery(async () => (await db.workouts.where('date').equals(d).toArray()).find((w) => w.end), [d]);
  const checkinThisWeek = useLiveQuery(() => db.checkins.where('date').aboveOrEqual(mondayOf(d)).count(), [d]);
  const next = useLiveQuery(async () => {
    const plan = await upcomingPlan(2, settings.mealTimes);
    const p = plan[0];
    if (!p) return null;
    const r = await db.recipes.get(p.recipeId);
    if (!r) return null;
    const foods = await foodMap();
    const missing = (await computeNeeds([p])).filter((n) => n.missing > 0).map((n) => ({ food: foods.get(n.foodId), g: n.missing }));
    return { p, r, m: recipeMacros(r, foods, p.servings), missing };
  }, [settings.mealTimes, logs.length]);

  const [sheet, setSheet] = useState<'' | 'peso' | 'passi'>('');
  const [val, setVal] = useState<number | null>(null);

  const tot = sum(logs);
  const left = t.kcal - tot.kcal;
  const water = day?.water || 0;
  const glasses = Math.ceil(t.water / t.glass);
  const filled = Math.floor(water / t.glass);

  const setDay = async (patch: any) => db.days.put({ ...(day || { date: d }), ...patch, date: d });

  const openSheet = (k: 'peso' | 'passi') => {
    setVal(k === 'peso' ? (weightToday?.kg ?? lastWeight?.kg ?? 69) : (day?.steps ?? null));
    setSheet(k);
  };
  const saveSheet = async () => {
    if (val == null) return;
    if (sheet === 'peso') await db.weights.put({ date: d, kg: Math.round(val * 10) / 10 });
    if (sheet === 'passi') await setDay({ steps: Math.round(val) });
    setSheet('');
    toast(sheet === 'peso' ? 'Peso salvato' : 'Passi salvati');
  };

  const backupDays = settings.lastBackup ? diffDays(d, settings.lastBackup) : 999;
  const wd = weekday(d);

  return (
    <>
      <TopBar
        title={longDate(d).replace(/^\w/, (c) => c.toUpperCase())}
        sub={<>Settimana {week} di 12 · {phase.label}{session ? ` · ${session.name}` : ' · riposo'}</>}
        right={<a className="iconbtn" href="#/impostazioni" aria-label="Impostazioni"><Icon name="gear" /></a>}
      />

      <section className="hero" aria-label="Calorie di oggi">
        <div className={`big ${left < 0 ? 'over' : ''}`}>{fmt(Math.abs(left))}</div>
        <div className="cap">{left >= 0 ? 'kcal rimaste' : 'kcal oltre il target'} · <b>{fmt(tot.kcal)}</b> mangiate su {fmt(t.kcal)}</div>
      </section>

      <div className="panel stack">
        <MacroBar label="Proteine" value={tot.p} target={t.p} color="var(--prot)" />
        <MacroBar label="Carboidrati" value={tot.c} target={t.c} color="var(--carb)" />
        <MacroBar label="Grassi" value={tot.f} target={t.f} color="var(--fat)" />
      </div>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="stat" onClick={() => openSheet('peso')}>
          <div className="k">Peso di oggi</div>
          <div className="v">{weightToday ? fmt(weightToday.kg, 1) : '—'}<small>kg</small></div>
          <div className="d">{weightToday ? 'Tocca per correggere' : lastWeight ? `Ultimo: ${fmt(lastWeight.kg, 1)} kg` : 'Tocca per registrare'}</div>
        </button>
        <button className="stat" onClick={() => openSheet('passi')}>
          <div className="k">Passi</div>
          <div className="v">{day?.steps ? fmt(day.steps) : '—'}</div>
          <div className="d">Obiettivo {fmt(t.steps)}</div>
        </button>
      </div>

      <div className="panel">
        <h2>Acqua <small>{fmt(water / 1000, 2)} / {fmt(t.water / 1000, 1)} L</small></h2>
        <div className="drops" aria-hidden="true">{Array.from({ length: glasses }, (_, i) => <i key={i} className={`drop ${i < filled ? 'on' : ''}`} />)}</div>
        <div className="row">
          <button className="btn primary grow" onClick={() => setDay({ water: water + t.glass })}><Icon name="drop" size={18} /> Bevuto {t.glass} ml</button>
          <button className="btn" onClick={() => setDay({ water: water + 500 })}>+500</button>
          <button className="iconbtn" onClick={() => setDay({ water: Math.max(0, water - t.glass) })} aria-label="Togli un bicchiere"><Icon name="minus" /></button>
        </div>
      </div>

      <div className="panel">
        <h2>Allenamento <small>{phase.tip}</small></h2>
        {active ? (
          <div className="row between">
            <div><div className="t">{settings.program.sessions.find((s) => s.id === active.sessionId)?.name} in corso</div><div className="s muted small">Iniziato alle {new Date(active.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div></div>
            <a className="btn primary" href={`#/allenamento/sessione/${active.id}`}>Riprendi</a>
          </div>
        ) : doneToday ? (
          <div className="callout ok">Fatto: {settings.program.sessions.find((s) => s.id === doneToday.sessionId)?.name}. Ora mangia le proteine e dormi bene.</div>
        ) : session ? (
          <div className="row between">
            <div><div style={{ fontFamily: 'var(--cond)', fontSize: 24, fontWeight: 600 }}>{session.name}</div><div className="muted small">{session.focus} · {session.exercises.length} esercizi</div></div>
            <a className="btn primary" href={`#/allenamento/avvia/${session.id}`}>Inizia</a>
          </div>
        ) : (
          <div className="row between">
            <div className="muted">Giorno di riposo: punta a {fmt(t.steps)} passi.</div>
            <a className="btn small ghost" href="#/allenamento">Scheda</a>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Prossimo pasto {next && <small>{next.p.date === d ? '' : 'domani · '}{MEALS.find((m) => m.key === next.p.meal)?.label} {settings.mealTimes[next.p.meal]}</small>}</h2>
        {next ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{next.r.name}</div>
            <div className="muted small" style={{ marginBottom: 10 }}>{fmt(next.m.kcal)} kcal · P {fmt(next.m.p)} · C {fmt(next.m.c)} · G {fmt(next.m.f)}</div>
            {next.missing.length > 0 && (
              <div className="callout" style={{ marginBottom: 10 }}>
                Ti manca: {next.missing.map((x) => `${x.food?.name || '?'} (${qtyLabel(x.food, buyQty(x.food, x.g)).split(' · ')[0]})`).join(', ')}.{' '}
                <a href="#/spesa" style={{ color: 'inherit', fontWeight: 600 }}>Apri la spesa</a>
              </div>
            )}
            <div className="row">
              <button className="btn primary grow" onClick={async () => { await logRecipe(next.p.date, next.p.meal, next.r, next.p.servings); toast(<><b>{next.r.name}</b> registrato</>); }}>Mangiato</button>
              <a className="btn ghost" href="#/dieta/piano">Cambia</a>
            </div>
          </>
        ) : (
          <div className="row between"><div className="muted">Nessun pasto pianificato.</div><a className="btn small primary" href="#/dieta/piano">Pianifica</a></div>
        )}
      </div>

      <div className="panel flush">
        <div className="li">
          <Check on={!!day?.creatina} onClick={() => setDay({ creatina: !day?.creatina })} label="Creatina presa" />
          <div className="grow"><div className="t">Creatina {t.creatina} g</div><div className="s">Tutti i giorni, a qualsiasi ora</div></div>
        </div>
      </div>

      {(wd === 0 || wd === 6) && !checkinThisWeek && (
        <a className="panel row between" href="#/progressi/checkin" style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--lime)' }}>
          <div><div style={{ fontWeight: 600 }}>Check-in della settimana {week}</div><div className="muted small">Si compila quasi da solo: copialo e mandalo al coach</div></div>
          <Icon name="right" />
        </a>
      )}

      {backupDays > 14 && (
        <a className="panel row between" href="#/impostazioni" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div><div style={{ fontWeight: 600 }}>Fai un backup dei dati</div><div className="muted small">{settings.lastBackup ? `Ultimo backup ${backupDays} giorni fa` : 'I dati sono solo su questo telefono'}</div></div>
          <Icon name="share" />
        </a>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet('')} title={sheet === 'peso' ? 'Peso di oggi' : 'Passi di oggi'}
        footer={<button className="btn primary block" onClick={saveSheet}>Salva</button>}>
        {sheet === 'peso' && <p className="muted small" style={{ marginTop: 0 }}>Al mattino, dopo il bagno, prima di mangiare. Conta la media settimanale, non il singolo giorno.</p>}
        <Stepper value={val} onChange={setVal} step={sheet === 'peso' ? 0.1 : 500} dec={sheet === 'peso' ? 1 : 0} label={sheet === 'peso' ? 'Peso in kg' : 'Passi'} />
        {sheet === 'passi' && <p className="muted small">Leggili dall'app contapassi del telefono (Google Fit, Samsung Health…).</p>}
      </Sheet>
    </>
  );
}
