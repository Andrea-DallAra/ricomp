import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Food } from '../data/foods';
import { CATEGORIES } from '../data/foods';
import { MEALS } from '../data/recipes';
import { Settings, updateSettings } from '../lib/settings';
import { relDay } from '../lib/dates';
import { upcomingPlan, computeNeeds, foodMap, buyQty, qtyLabel } from '../lib/nutrition';
import { Check, Empty, Icon, Seg, Sheet, TopBar, useToast } from '../components/ui';
import { FoodPicker, GramsPicker } from '../components/Food';
import { useNow } from '../lib/hooks';

export default function Shopping({ sub, settings }: { sub?: string; settings: Settings }) {
  const tab = sub === 'dispensa' ? 'dispensa' : 'lista';
  return (
    <>
      <TopBar title="Spesa" sub={tab === 'lista' ? 'Calcolata dal piano pasti meno quello che hai in casa' : 'Si scala da sola quando segni un pasto come mangiato'} />
      <Seg value={tab} onChange={(v) => (location.hash = '/spesa/' + v)} options={[{ v: 'lista', l: 'Lista della spesa' }, { v: 'dispensa', l: 'Dispensa' }]} />
      {tab === 'lista' ? <List settings={settings} /> : <Pantry />}
    </>
  );
}

function List({ settings }: { settings: Settings }) {
  useNow();
  const toast = useToast();
  const days = settings.shopDays || 3;
  const fm = useLiveQuery(() => foodMap()) || new Map<string, Food>();
  const pantryCount = useLiveQuery(() => db.pantry.toArray());
  const data = useLiveQuery(async () => {
    const plan = await upcomingPlan(days, settings.mealTimes);
    const needs = (await computeNeeds(plan)).filter((n) => n.missing > 0);
    const next = plan[0] ? { p: plan[0], r: await db.recipes.get(plan[0].recipeId), missing: (await computeNeeds([plan[0]])).filter((n) => n.missing > 0) } : null;
    return { plan, needs, next };
  }, [days, settings.mealTimes, pantryCount]);
  const checked: Record<string, number> = useLiveQuery(async () => (await db.kv.get('shopChecked'))?.value || {}) || {};
  const manual = useLiveQuery(() => db.shop.toArray()) || [];
  const [text, setText] = useState('');

  const toggle = async (foodId: string, g: number) => {
    const c = { ...checked };
    if (c[foodId]) delete c[foodId]; else c[foodId] = g;
    await db.kv.put({ key: 'shopChecked', value: c });
  };

  const finish = async () => {
    const c = checked;
    let n = 0;
    for (const [foodId, g] of Object.entries(c)) {
      const cur = await db.pantry.get(foodId);
      await db.pantry.put({ foodId, g: (cur?.g || 0) + g });
      n++;
    }
    await db.kv.put({ key: 'shopChecked', value: {} });
    const done = manual.filter((m) => m.checked).map((m) => m.id!);
    await db.shop.bulkDelete(done);
    toast(`${n + done.length} prodotti messi in dispensa`);
  };

  if (!data) return null;
  const { plan, needs, next } = data;
  const nChecked = Object.keys(checked).length + manual.filter((m) => m.checked).length;
  const byCat = CATEGORIES.map((c) => ({ c, items: needs.filter((n) => (fm.get(n.foodId)?.cat || 'Snack e altro') === c) })).filter((x) => x.items.length);
  const nextLabel = next ? `${relDay(next.p.date)} · ${MEALS.find((m) => m.key === next.p.meal)?.label}` : '';

  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[1, 2, 3, 5, 7].map((n) => <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => updateSettings({ shopDays: n })}>{n === 1 ? 'Oggi' : `${n} giorni`}</button>)}
      </div>

      {next && (
        <div className={`callout ${next.missing.length ? '' : 'ok'}`} style={{ marginBottom: 12 }}>
          <b>Prossimo pasto</b> ({nextLabel}): {next.p.recipeId === 'libero' ? 'pasto libero' : next.r?.name}.{' '}
          {next.missing.length
            ? <>Manca: {next.missing.map((n) => fm.get(n.foodId)?.name || n.foodId).join(', ')}.</>
            : <>Hai già tutto in casa.</>}
        </div>
      )}

      {!plan.length ? (
        <div className="panel"><Empty title="Nessun pasto pianificato">Scegli i pasti dei prossimi giorni e la lista si compila da sola.<div style={{ marginTop: 12 }}><a className="btn primary" href="#/dieta/piano">Pianifica i pasti</a></div></Empty></div>
      ) : !needs.length ? (
        <div className="panel"><Empty title={`Hai già tutto per ${days === 1 ? 'oggi' : days + ' giorni'}`}>{`${plan.length} pasti coperti dalla dispensa.`}</Empty></div>
      ) : (
        byCat.map(({ c, items }) => (
          <section key={c}>
            <div className="section-title">{c}<small>{items.length}</small></div>
            <div className="panel flush"><ul className="list">
              {items.map((n) => {
                const f = fm.get(n.foodId);
                const q = buyQty(f, n.missing);
                const on = !!checked[n.foodId];
                const forNext = next?.missing.some((x) => x.foodId === n.foodId);
                return (
                  <li key={n.foodId} className="li tap" onClick={() => toggle(n.foodId, q)} style={{ opacity: on ? 0.55 : 1 }}>
                    <Check on={on} onClick={() => {}} label={f?.name} />
                    <div className="grow">
                      <div className="t" style={{ textDecoration: on ? 'line-through' : 'none' }}>{f?.name || n.foodId}</div>
                      <div className="s">{qtyLabel(f, q)}{n.have > 0 ? ` · in casa ${qtyLabel(f, n.have).split(' · ')[0]}` : ''}</div>
                    </div>
                    {forNext && <span className="badge warn">prossimo pasto</span>}
                  </li>
                );
              })}
            </ul></div>
          </section>
        ))
      )}

      <div className="section-title">Altro da comprare</div>
      <div className="panel flush"><ul className="list">
        {manual.map((m) => (
          <li key={m.id} className="li tap" onClick={() => db.shop.update(m.id!, { checked: !m.checked })} style={{ opacity: m.checked ? 0.55 : 1 }}>
            <Check on={m.checked} onClick={() => {}} label={m.name} />
            <div className="grow t" style={{ textDecoration: m.checked ? 'line-through' : 'none' }}>{m.name}</div>
            <button className="iconbtn" style={{ background: 'transparent' }} onClick={(e) => { e.stopPropagation(); db.shop.delete(m.id!); }} aria-label="Elimina"><Icon name="close" size={18} /></button>
          </li>
        ))}
        <li className="li">
          <form className="row grow" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { db.shop.add({ name: text.trim(), checked: false }); setText(''); } }}>
            <input placeholder="Aggiungi (es. detersivo, sale)" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn small" type="submit" disabled={!text.trim()}>Aggiungi</button>
          </form>
        </li>
      </ul></div>

      {nChecked > 0 && (
        <button className="btn primary block" style={{ position: 'sticky', bottom: 'calc(80px + var(--safe-b))', marginTop: 8 }} onClick={finish}>
          Ho finito la spesa · {nChecked} nel carrello
        </button>
      )}
    </>
  );
}

function Pantry() {
  const toast = useToast();
  const items = useLiveQuery(() => db.pantry.toArray()) || [];
  const fm = useLiveQuery(() => foodMap()) || new Map<string, Food>();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<{ food: Food; g: number } | null>(null);
  const [g, setG] = useState<number | null>(null);
  const has = items.filter((i) => i.g > 0.5).sort((a, b) => (fm.get(a.foodId)?.name || '').localeCompare(fm.get(b.foodId)?.name || ''));
  const out = items.filter((i) => i.g <= 0.5);

  const save = async () => {
    if (!edit || g == null) return;
    await db.pantry.put({ foodId: edit.food.id, g: Math.max(0, g) });
    setEdit(null); setAdding(false); toast('Dispensa aggiornata');
  };

  return (
    <>
      <button className="btn primary block" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Aggiungi alla dispensa</button>
      {!has.length && !out.length ? (
        <div className="panel"><Empty title="Dispensa vuota">Spunta i prodotti nella lista della spesa e tocca "Ho finito la spesa": finiscono qui con le quantità.</Empty></div>
      ) : (
        <>
          <div className="panel flush"><ul className="list">
            {has.map((i) => { const f = fm.get(i.foodId); return (
              <li key={i.foodId} className="li tap" onClick={() => f && (setEdit({ food: f, g: i.g }), setG(Math.round(i.g)))}>
                <div className="grow"><div className="t">{f?.name || i.foodId}</div><div className="s">{qtyLabel(f, i.g)}</div></div>
                <Icon name="edit" size={18} />
              </li>); })}
          </ul></div>
          {out.length > 0 && (
            <>
              <div className="section-title">Finiti<small>{out.length}</small></div>
              <div className="panel flush"><ul className="list">
                {out.map((i) => { const f = fm.get(i.foodId); return (
                  <li key={i.foodId} className="li">
                    <div className="grow t dim">{f?.name || i.foodId}</div>
                    <button className="btn small ghost" onClick={() => db.shop.add({ name: f?.name || i.foodId, checked: false })}>In lista</button>
                    <button className="iconbtn" style={{ background: 'transparent' }} onClick={() => db.pantry.delete(i.foodId)} aria-label="Rimuovi"><Icon name="close" size={18} /></button>
                  </li>); })}
              </ul></div>
            </>
          )}
        </>
      )}
      <Sheet open={adding || !!edit} onClose={() => { setAdding(false); setEdit(null); }} title={edit ? 'Quantità in casa' : 'Aggiungi alla dispensa'}
        footer={edit ? <button className="btn primary block" onClick={save}>Salva</button> : undefined}>
        {edit ? <GramsPicker key={edit.food.id} food={edit.food} initial={edit.g} onChange={setG} />
          : <FoodPicker onPick={(f) => { const cur = items.find((i) => i.foodId === f.id); setEdit({ food: f, g: cur?.g || f.piece || 100 }); setG(cur?.g || f.piece || 100); }} />}
      </Sheet>
    </>
  );
}
