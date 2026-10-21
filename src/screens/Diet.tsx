import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LogEntry } from '../db';
import type { Food } from '../data/foods';
import { MEALS, MealKey, Recipe } from '../data/recipes';
import { Settings } from '../lib/settings';
import { today, relDay, longDate, addDays } from '../lib/dates';
import { fmt, uid } from '../lib/format';
import { sum, recipeMacros, foodMap, logRecipe, logFood, logQuick, macrosFor, qtyLabel } from '../lib/nutrition';
import { lookupBarcode } from '../lib/off';
import { DateNav, Icon, Seg, Sheet, Stepper, TopBar, useToast, Empty, num } from '../components/ui';
import { FoodPicker, GramsPicker, FoodForm } from '../components/Food';
import { Scanner } from '../components/Scanner';

type Sub = 'diario' | 'piano' | 'ricette' | 'alimenti';

export default function Diet({ sub, settings }: { sub?: string; settings: Settings }) {
  const tab = (['diario', 'piano', 'ricette', 'alimenti'].includes(sub || '') ? sub : 'diario') as Sub;
  return (
    <>
      <TopBar title="Dieta" sub={`${fmt(settings.targets.kcal)} kcal · P ${settings.targets.p} · C ${settings.targets.c} · G ${settings.targets.f}`} />
      <Seg value={tab} onChange={(v) => (location.hash = '/dieta/' + v)} options={[{ v: 'diario', l: 'Diario' }, { v: 'piano', l: 'Piano' }, { v: 'ricette', l: 'Ricette' }, { v: 'alimenti', l: 'Alimenti' }]} />
      {tab === 'diario' && <Diary settings={settings} />}
      {tab === 'piano' && <Planner settings={settings} />}
      {tab === 'ricette' && <Recipes />}
      {tab === 'alimenti' && <Foods />}
    </>
  );
}

/* ---------------- Diario ---------------- */
function Diary({ settings }: { settings: Settings }) {
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<MealKey | null>(null);
  const toast = useToast();
  const logs = useLiveQuery(() => db.logs.where('date').equals(date).toArray(), [date]) || [];
  const plan = useLiveQuery(() => db.plan.where('date').equals(date).toArray(), [date]) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const rmap = new Map(recipes.map((r) => [r.id, r]));
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const t = settings.targets;
  const tot = sum(logs);

  const remove = async (items: LogEntry[]) => {
    await db.logs.bulkDelete(items.map((x) => x.id!));
    const recipeId = items[0]?.recipeId;
    if (recipeId) { const p = plan.find((x) => x.recipeId === recipeId && x.meal === items[0].meal); if (p) await db.plan.update(p.id, { done: false }); }
    toast('Voce eliminata', { label: 'Annulla', run: () => db.logs.bulkAdd(items.map(({ id, ...r }) => r)) });
  };

  return (
    <>
      <DateNav date={date} setDate={setDate} label={relDay(date) === 'Oggi' ? 'Oggi' : longDate(date)} />
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row between">
          <div><span className="num" style={{ fontSize: 34, fontWeight: 700 }}>{fmt(tot.kcal)}</span><span className="muted"> / {fmt(t.kcal)} kcal</span></div>
          <div className="small muted" style={{ textAlign: 'right' }}>
            <div><i className="dot" style={{ background: 'var(--prot)', width: 8, height: 8 }} /> P {fmt(tot.p)}/{t.p}</div>
            <div><i className="dot" style={{ background: 'var(--carb)', width: 8, height: 8 }} /> C {fmt(tot.c)}/{t.c}</div>
            <div><i className="dot" style={{ background: 'var(--fat)', width: 8, height: 8 }} /> G {fmt(tot.f)}/{t.f}</div>
          </div>
        </div>
      </div>

      {MEALS.map((m) => {
        const items = logs.filter((l) => l.meal === m.key);
        const groups = new Map<string, LogEntry[]>();
        for (const it of items) { const k = it.group || 'x' + it.id; groups.set(k, [...(groups.get(k) || []), it]); }
        const p = plan.find((x) => x.meal === m.key);
        const pr = p && !p.done ? rmap.get(p.recipeId) : null;
        return (
          <section key={m.key}>
            <div className="section-title">{m.label}<small>{fmt(sum(items).kcal)} kcal</small></div>
            <div className="panel flush">
              <ul className="list">
                {[...groups.values()].map((g) => {
                  const gm = sum(g);
                  const isRecipe = !!g[0].group;
                  return (
                    <li key={g[0].id} className="li">
                      <div className="grow">
                        <div className="t ellipsis">{isRecipe ? rmap.get(g[0].recipeId!)?.name || 'Ricetta' : g[0].name}</div>
                        <div className="s ellipsis">{isRecipe ? `${g.length} ingredienti · ` : g[0].g ? `${Math.round(g[0].g)} g · ` : ''}{fmt(gm.kcal)} kcal · P {fmt(gm.p)} · C {fmt(gm.c)} · G {fmt(gm.f)}</div>
                      </div>
                      <button className="iconbtn" style={{ background: 'transparent' }} onClick={() => remove(g)} aria-label="Elimina"><Icon name="trash" size={19} /></button>
                    </li>
                  );
                })}
                {pr && (
                  <li className="li">
                    <div className="grow"><div className="t">{pr.name}</div><div className="s">In programma · {fmt(recipeMacros(pr, fm, p!.servings).kcal)} kcal</div></div>
                    <button className="btn small primary" onClick={async () => { await logRecipe(date, m.key, pr, p!.servings); toast(<><b>{pr.name}</b> registrato</>); }}>Mangiato</button>
                  </li>
                )}
                <li className="li tap" onClick={() => setAdding(m.key)} style={{ color: 'var(--lime)', fontWeight: 600 }}>
                  <Icon name="plus" /> Aggiungi a {m.label.toLowerCase()}
                </li>
              </ul>
            </div>
          </section>
        );
      })}
      {adding && <AddSheet date={date} meal={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function AddSheet({ date, meal, onClose }: { date: string; meal: MealKey; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'ricette' | 'alimenti' | 'scanner' | 'rapido'>('ricette');
  const [food, setFood] = useState<Food | null>(null);
  const [g, setG] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [quick, setQuick] = useState({ name: '', kcal: '', p: '', c: '', f: '' });
  const [scanMsg, setScanMsg] = useState('');
  const [newFood, setNewFood] = useState<Food | null>(null);
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const label = MEALS.find((m) => m.key === meal)!.label;
  const sorted = [...recipes].sort((a, b) => (a.meal === meal ? -1 : 0) - (b.meal === meal ? -1 : 0));

  const done = (msg: string) => { toast(msg); onClose(); };

  const onCode = async (code: string) => {
    setScanMsg('Cerco il prodotto…');
    try {
      const f = await lookupBarcode(code);
      if (f) { await db.foods.put(f); setFood(f); setG(f.piece || 100); setScanMsg(''); }
      else { setScanMsg(''); setNewFood({ id: 'bc_' + code, barcode: code, name: '', kcal: 0, p: 0, c: 0, f: 0, cat: 'Snack e altro', custom: true }); }
    } catch (e: any) { setScanMsg(e.message); }
  };

  let footer: React.ReactNode = null;
  if (food) footer = <><button className="btn ghost" onClick={() => setFood(null)}>Indietro</button><button className="btn primary grow" disabled={!g} onClick={async () => { await logFood(date, meal, food, g!); done(`${food.name} aggiunto`); }}>Aggiungi</button></>;
  else if (recipe) footer = <><button className="btn ghost" onClick={() => setRecipe(null)}>Indietro</button><button className="btn primary grow" disabled={!servings} onClick={async () => { await logRecipe(date, meal, recipe, servings!); done(`${recipe.name} aggiunto`); }}>Aggiungi</button></>;
  else if (mode === 'rapido') footer = <button className="btn primary block" disabled={num(quick.kcal) == null} onClick={async () => { await logQuick(date, meal, quick.name, { kcal: num(quick.kcal) || 0, p: num(quick.p) || 0, c: num(quick.c) || 0, f: num(quick.f) || 0 }); done('Voce aggiunta'); }}>Aggiungi</button>;

  return (
    <Sheet open onClose={onClose} title={`Aggiungi a ${label.toLowerCase()}`} footer={footer}>
      {food ? <GramsPicker food={food} onChange={setG} /> : recipe ? (
        <div className="stack">
          <div style={{ fontWeight: 600, fontSize: 18 }}>{recipe.name}</div>
          <span className="muted small">Porzioni</span>
          <Stepper value={servings} onChange={setServings} step={0.25} label="Porzioni" dec={2} />
          <RecipeDetail recipe={recipe} servings={servings || 1} fm={fm} />
        </div>
      ) : newFood ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>Prodotto non trovato su Open Food Facts. Copia i valori per 100 g dall'etichetta: la prossima volta lo riconosce subito.</p>
          <FoodForm food={newFood} onSave={async (f) => { await db.foods.put(f); setNewFood(null); setFood(f); setG(f.piece || 100); }} />
        </>
      ) : (
        <>
          <Seg value={mode} onChange={(v) => setMode(v as any)} options={[{ v: 'ricette', l: 'Ricette' }, { v: 'alimenti', l: 'Alimenti' }, { v: 'scanner', l: 'Scanner' }, { v: 'rapido', l: 'Rapido' }]} />
          {mode === 'ricette' && (
            <ul className="list">
              {sorted.map((r) => { const m = recipeMacros(r, fm); return (
                <li key={r.id} className="li tap" style={{ padding: '10px 4px' }} onClick={() => { setRecipe(r); setServings(1); }}>
                  <div className="grow"><div className="t">{r.name}</div><div className="s">{MEALS.find((x) => x.key === r.meal)?.label} · {fmt(m.kcal)} kcal · P {fmt(m.p)}</div></div>
                  <Icon name="right" size={18} />
                </li>); })}
            </ul>
          )}
          {mode === 'alimenti' && <FoodPicker onPick={(f) => { setFood(f); setG(f.piece || 100); }} />}
          {mode === 'scanner' && <>{scanMsg ? <p className="muted">{scanMsg}</p> : <Scanner onCode={onCode} />}</>}
          {mode === 'rapido' && (
            <div>
              <p className="muted small" style={{ marginTop: 0 }}>Per un pasto fuori casa: stima calorie e proteine.</p>
              <label className="field"><span>Descrizione</span><input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} placeholder="Es. menù mensa" /></label>
              <div className="grid2">
                {(['kcal', 'p', 'c', 'f'] as const).map((k) => (
                  <label key={k} className="field"><span>{{ kcal: 'kcal', p: 'Proteine (g)', c: 'Carboidrati (g)', f: 'Grassi (g)' }[k]}</span>
                    <input inputMode="decimal" value={quick[k]} onChange={(e) => setQuick({ ...quick, [k]: e.target.value })} /></label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function RecipeDetail({ recipe, servings, fm }: { recipe: Recipe; servings: number; fm: Map<string, Food> }) {
  const m = recipeMacros(recipe, fm, servings);
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>{fmt(m.kcal)} kcal · P {fmt(m.p)} · C {fmt(m.c)} · G {fmt(m.f)}</div>
      <ul className="list">
        {recipe.ingredients.map((i) => <li key={i.foodId} className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}><span>{fm.get(i.foodId)?.name || i.foodId}</span><span className="muted">{qtyLabel(fm.get(i.foodId), i.g * servings)}</span></li>)}
      </ul>
      {recipe.note && <p className="small muted">{recipe.note}</p>}
    </div>
  );
}

/* ---------------- Piano pasti ---------------- */
function Planner({ settings }: { settings: Settings }) {
  const toast = useToast();
  const start = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const plan = useLiveQuery(() => db.plan.where('date').between(start, days[6], true, true).toArray(), [start]) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const byMeal = (m: MealKey) => recipes.filter((r) => r.meal === m);
  const get = (d: string, m: MealKey) => plan.find((p) => p.id === `${d}_${m}`);

  const setSlot = async (d: string, m: MealKey, recipeId: string) => {
    if (!recipeId) await db.plan.delete(`${d}_${m}`);
    else await db.plan.put({ id: `${d}_${m}`, date: d, meal: m, recipeId, servings: 1, done: false });
  };

  const autofill = async () => {
    let n = 0;
    for (const [di, d] of days.entries()) for (const m of MEALS) {
      if (get(d, m.key)) continue;
      const opts = byMeal(m.key);
      if (!opts.length) continue;
      // rotazione: lo stesso piatto torna ogni 2–3 giorni, comodo per cucinare in anticipo
      const r = opts[Math.floor(di / 2) % opts.length];
      await db.plan.put({ id: `${d}_${m.key}`, date: d, meal: m.key, recipeId: r.id, servings: 1, done: false });
      n++;
    }
    toast(n ? `${n} pasti pianificati` : 'La settimana è già piena');
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary grow" onClick={autofill}>Riempi i giorni vuoti</button>
        <a className="btn ghost" href="#/spesa">Lista spesa</a>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>I piatti si ripetono ogni 2 giorni: cucini una volta per due giorni, senza freezer. La lista della spesa usa questo piano.</p>
      {days.map((d) => {
        const dayPlan = plan.filter((p) => p.date === d);
        const kcal = sum(dayPlan.map((p) => { const r = recipes.find((x) => x.id === p.recipeId); return r ? recipeMacros(r, fm, p.servings) : { kcal: 0, p: 0, c: 0, f: 0 }; }));
        return (
          <section key={d}>
            <div className="section-title">{relDay(d)}<small>{dayPlan.length ? `${fmt(kcal.kcal)} kcal · P ${fmt(kcal.p)} g` : 'vuoto'}</small></div>
            <div className="panel flush">
              {MEALS.map((m) => {
                const p = get(d, m.key);
                return (
                  <div key={m.key} className="li" style={{ gap: 10 }}>
                    <div style={{ width: 82 }} className="small muted">{m.label}</div>
                    <select className="grow" value={p?.recipeId || ''} onChange={(e) => setSlot(d, m.key, e.target.value)} style={{ opacity: p?.done ? 0.5 : 1 }}>
                      <option value="">—</option>
                      {byMeal(m.key).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      <optgroup label="Altre ricette">{recipes.filter((r) => r.meal !== m.key).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
                    </select>
                    {p?.done && <Icon name="check" size={18} />}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------------- Ricette ---------------- */
function Recipes() {
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const [edit, setEdit] = useState<Recipe | null>(null);
  return (
    <>
      <button className="btn primary block" style={{ marginBottom: 6 }} onClick={() => setEdit({ id: 'r_' + uid(), name: '', meal: 'pranzo', ingredients: [], custom: true })}><Icon name="plus" size={18} /> Nuova ricetta</button>
      {MEALS.map((m) => (
        <section key={m.key}>
          <div className="section-title">{m.label}</div>
          <div className="panel flush"><ul className="list">
            {recipes.filter((r) => r.meal === m.key).map((r) => { const mm = recipeMacros(r, fm); return (
              <li key={r.id} className="li tap" onClick={() => setEdit(r)}>
                <div className="grow"><div className="t">{r.name}</div><div className="s">{fmt(mm.kcal)} kcal · P {fmt(mm.p)} · C {fmt(mm.c)} · G {fmt(mm.f)}</div></div>
                <Icon name="edit" size={18} />
              </li>); })}
          </ul></div>
        </section>
      ))}
      {edit && <RecipeEditor recipe={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function RecipeEditor({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<Recipe>(JSON.parse(JSON.stringify(recipe)));
  const [picking, setPicking] = useState(false);
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const m = recipeMacros(r, fm);
  const save = async () => { await db.recipes.put(r); toast('Ricetta salvata'); onClose(); };
  const del = async () => {
    const used = await db.plan.filter((p) => p.recipeId === r.id && !p.done).count();
    if (used) await db.plan.filter((p) => p.recipeId === r.id && !p.done).delete();
    await db.recipes.delete(r.id); toast('Ricetta eliminata'); onClose();
  };
  return (
    <Sheet open onClose={onClose} title={picking ? 'Aggiungi ingrediente' : recipe.name ? 'Modifica ricetta' : 'Nuova ricetta'}
      footer={picking ? <button className="btn ghost block" onClick={() => setPicking(false)}>Indietro</button> : <>
        {recipe.name && <button className="btn danger" onClick={del} aria-label="Elimina ricetta"><Icon name="trash" size={18} /></button>}
        <button className="btn primary grow" disabled={!r.name || !r.ingredients.length} onClick={save}>Salva ricetta</button></>}>
      {picking ? <FoodPicker onPick={(f) => { setR({ ...r, ingredients: [...r.ingredients, { foodId: f.id, g: f.piece || 100 }] }); setPicking(false); }} /> : (
        <>
          <label className="field"><span>Nome</span><input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
          <label className="field"><span>Pasto</span><select value={r.meal} onChange={(e) => setR({ ...r, meal: e.target.value as MealKey })}>{MEALS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
          <div className="small muted" style={{ marginBottom: 8 }}>{fmt(m.kcal)} kcal · P {fmt(m.p)} · C {fmt(m.c)} · G {fmt(m.f)}</div>
          {r.ingredients.map((i, idx) => (
            <div key={idx} className="row" style={{ marginBottom: 8 }}>
              <div className="grow small ellipsis">{fm.get(i.foodId)?.name || i.foodId}</div>
              <input style={{ width: 84, textAlign: 'right' }} inputMode="decimal" value={i.g} onChange={(e) => { const ing = [...r.ingredients]; ing[idx] = { ...i, g: num(e.target.value) || 0 }; setR({ ...r, ingredients: ing }); }} aria-label="Grammi" />
              <span className="small muted">{fm.get(i.foodId)?.unit || 'g'}</span>
              <button className="iconbtn" style={{ width: 36, height: 36 }} onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, j) => j !== idx) })} aria-label="Togli"><Icon name="close" size={18} /></button>
            </div>
          ))}
          <button className="btn ghost block" onClick={() => setPicking(true)}><Icon name="plus" size={18} /> Ingrediente</button>
          <label className="field" style={{ marginTop: 12 }}><span>Note</span><textarea rows={2} value={r.note || ''} onChange={(e) => setR({ ...r, note: e.target.value })} /></label>
        </>
      )}
    </Sheet>
  );
}

/* ---------------- Alimenti ---------------- */
function Foods() {
  const toast = useToast();
  const [edit, setEdit] = useState<Food | null | 'new'>(null);
  return (
    <>
      <button className="btn primary block" style={{ marginBottom: 12 }} onClick={() => setEdit('new')}><Icon name="plus" size={18} /> Nuovo alimento</button>
      <div className="panel"><FoodPicker allowOnline onPick={(f) => setEdit(f)} /></div>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit === 'new' ? 'Nuovo alimento' : 'Modifica alimento'}>
          <FoodForm food={edit === 'new' ? undefined : edit}
            onSave={async (f) => { await db.foods.put(f); toast('Alimento salvato'); setEdit(null); }}
            onDelete={edit !== 'new' ? async () => { await db.foods.delete((edit as Food).id); toast('Alimento eliminato'); setEdit(null); } : undefined} />
        </Sheet>
      )}
    </>
  );
}
