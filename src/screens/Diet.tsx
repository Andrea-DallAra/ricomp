import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LogEntry } from '../db';
import type { Food } from '../data/foods';
import { MEALS, MealKey, Recipe } from '../data/recipes';
import { Settings } from '../lib/settings';
import { today, relDay, longDate, addDays } from '../lib/dates';
import { fmt, uid } from '../lib/format';
import { sum, recipeMacros, foodMap, logRecipe, logFood, logQuick, macrosFor, qtyLabel, FREE, freeMealBudget, ensurePlan, resetToBase } from '../lib/nutrition';
import { updateSettings, DEFAULT_BASE } from '../lib/settings';
import { weekday, DAYS } from '../lib/dates';
import { lookupBarcode } from '../lib/off';
import { DateNav, Icon, Seg, Sheet, Stepper, TopBar, useToast, Empty, num } from '../components/ui';
import { FoodPicker, GramsPicker, FoodForm } from '../components/Food';
import { Scanner } from '../components/Scanner';

type Sub = 'diario' | 'piano' | 'base' | 'ricette' | 'alimenti';

export default function Diet({ sub, settings }: { sub?: string; settings: Settings }) {
  const tab = (['diario', 'piano', 'base', 'ricette', 'alimenti'].includes(sub || '') ? sub : 'diario') as Sub;
  return (
    <>
      <TopBar title="Dieta" sub={`${fmt(settings.targets.kcal)} kcal · P ${settings.targets.p} · C ${settings.targets.c} · G ${settings.targets.f}`} />
      <Seg value={tab} onChange={(v) => (location.hash = '/dieta/' + v)} options={[{ v: 'diario', l: 'Diario' }, { v: 'piano', l: 'Piano' }, { v: 'base', l: 'Base' }, { v: 'ricette', l: 'Ricette' }, { v: 'alimenti', l: 'Alimenti' }]} />
      {tab === 'diario' && <Diary settings={settings} />}
      {tab === 'piano' && <Planner settings={settings} />}
      {tab === 'base' && <BaseWeek settings={settings} />}
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
  const freeBudget: Record<string, number> = useLiveQuery(async () => {
    const out: Record<string, number> = {};
    for (const p of plan) if (p.recipeId === FREE && !p.done) out[p.meal] = await freeMealBudget(date, p.meal, t.kcal);
    return out;
  }, [date, logs.length, plan.length, plan.map((p) => p.recipeId + p.done).join()]) || {};

  const remove = async (items: LogEntry[]) => {
    await db.logs.bulkDelete(items.map((x) => x.id!));
    const recipeId = items[0]?.recipeId;
    const meal = items[0].meal;
    const left = await db.logs.where('date').equals(date).filter((l) => l.meal === meal).count();
    if (!left && (await db.plan.get(`${date}_${meal}`))) await db.plan.update(`${date}_${meal}`, { done: false });
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
        const isFree = !!p && !p.done && p.recipeId === FREE;
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
                {isFree && (
                  <li className="li">
                    <div className="grow"><div className="t">Pasto libero</div><div className="s">Margine ~{fmt(freeBudget[m.key] || 0)} kcal · cerca 35–40 g di proteine</div></div>
                    <button className="btn small primary" onClick={() => setAdding(m.key)}>Registra</button>
                  </li>
                )}
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
      <p className="small muted">Hai mangiato qualcos'altro? Aggiungilo al pasto: prende il posto di quello in programma e la dispensa si aggiorna.</p>
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
function RecipeSelect({ meal, value, recipes, onChange, dim }: { meal: MealKey; value: string; recipes: Recipe[]; onChange: (v: string) => void; dim?: boolean }) {
  return (
    <select className="grow" value={value} onChange={(e) => onChange(e.target.value)} style={{ opacity: dim ? 0.5 : 1 }}>
      <option value="">— niente —</option>
      <option value={FREE}>Pasto libero</option>
      {recipes.filter((r) => r.meal === meal).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      <optgroup label="Altre ricette">{recipes.filter((r) => r.meal !== meal).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
    </select>
  );
}

function dayKcal(entries: { recipeId: string; servings?: number }[], recipes: Recipe[], fm: Map<string, Food>) {
  return sum(entries.map((p) => { const r = recipes.find((x) => x.id === p.recipeId); return r ? recipeMacros(r, fm, p.servings || 1) : { kcal: 0, p: 0, c: 0, f: 0 }; }));
}

function Planner({ settings }: { settings: Settings }) {
  const toast = useToast();
  const start = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const plan = useLiveQuery(() => db.plan.where('date').between(start, days[6], true, true).toArray(), [start]) || [];
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const get = (d: string, m: MealKey) => plan.find((p) => p.id === `${d}_${m}`);
  useEffect(() => { ensurePlan(); }, [start]);

  const setSlot = async (d: string, m: MealKey, recipeId: string) => {
    await db.plan.put({ id: `${d}_${m}`, date: d, meal: m, recipeId, servings: 1, done: false, auto: false });
  };

  return (
    <>
      <div className="callout ok" style={{ marginBottom: 12 }}>
        Ogni giorno segue la <a href="#/dieta/base" style={{ color: 'inherit', fontWeight: 600 }}>dieta base</a>. Qui cambi un singolo pasto quando ti serve un'alternativa: vale solo per quel giorno.
      </div>
      {days.map((d) => {
        const dayPlan = plan.filter((p) => p.date === d);
        const k = dayKcal(dayPlan, recipes, fm);
        const changed = dayPlan.some((p) => p.auto === false && !p.done);
        const hasFree = dayPlan.some((p) => p.recipeId === FREE);
        return (
          <section key={d}>
            <div className="section-title">{relDay(d)}<small>{fmt(k.kcal)} kcal{hasFree ? ' + pasto libero' : ''} · P {fmt(k.p)} g</small></div>
            <div className="panel flush">
              {MEALS.map((m) => {
                const p = get(d, m.key);
                return (
                  <div key={m.key} className="li" style={{ gap: 10 }}>
                    <div style={{ width: 78 }} className="small muted">{m.label}{p?.auto === false && !p.done ? <div style={{ color: 'var(--warn)' }}>cambiato</div> : null}</div>
                    <RecipeSelect meal={m.key} value={p?.recipeId || ''} recipes={recipes} onChange={(v) => setSlot(d, m.key, v)} dim={p?.done} />
                    {p?.done && <Icon name="check" size={18} />}
                  </div>
                );
              })}
              {changed && (
                <div className="li tap" style={{ color: 'var(--lime)', fontWeight: 600 }} onClick={async () => { await resetToBase(d); toast(`${relDay(d)} riportato alla dieta base`); }}>
                  <Icon name="history" size={20} /> Torna alla dieta base
                </div>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}

function BaseWeek({ settings }: { settings: Settings }) {
  const toast = useToast();
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map();
  const base = settings.baseDiet;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const set = async (wd: number, meal: MealKey, v: string) => {
    const next = { ...base, [wd]: { ...(base[wd] || {}), [meal]: v } };
    if (!v) delete next[wd][meal];
    await updateSettings({ baseDiet: next });
    await ensurePlan();
  };
  const free = order.reduce((a, wd) => a + MEALS.filter((m) => base[wd]?.[m.key] === FREE).length, 0);
  const avg = order.reduce((a, wd) => a + dayKcal(MEALS.map((m) => ({ recipeId: base[wd]?.[m.key] || '' })), recipes, fm).kcal, 0) / 7;
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>La settimana tipo che l'app ripete ogni settimana. I piatti si ripetono a coppie di giorni: cucini una volta per due giorni. Le modifiche valgono da oggi in poi, tranne i giorni che hai cambiato a mano.</p>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div className="stat"><div className="k">Pasti liberi a settimana</div><div className="v">{free}</div><div className="d">1–2 vanno bene in ricomposizione</div></div>
        <div className="stat"><div className="k">Media giorni pianificati</div><div className="v">{fmt(avg)}<small>kcal</small></div><div className="d">pasti liberi esclusi</div></div>
      </div>
      {order.map((wd) => {
        const k = dayKcal(MEALS.map((m) => ({ recipeId: base[wd]?.[m.key] || '' })), recipes, fm);
        const hasFree = MEALS.some((m) => base[wd]?.[m.key] === FREE);
        return (
          <section key={wd}>
            <div className="section-title">{DAYS[wd].replace(/^\w/, (c) => c.toUpperCase())}<small>{fmt(k.kcal)} kcal{hasFree ? ' + libero' : ''} · P {fmt(k.p)} g</small></div>
            <div className="panel flush">
              {MEALS.map((m) => (
                <div key={m.key} className="li" style={{ gap: 10 }}>
                  <div style={{ width: 78 }} className="small muted">{m.label}</div>
                  <RecipeSelect meal={m.key} value={base[wd]?.[m.key] || ''} recipes={recipes} onChange={(v) => set(wd, m.key, v)} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <button className="btn ghost block" style={{ margin: '12px 0' }} onClick={async () => { await updateSettings({ baseDiet: JSON.parse(JSON.stringify(DEFAULT_BASE)) }); await resetToBase(); toast('Dieta base originale ripristinata'); }}>Ripristina la dieta base originale</button>
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
