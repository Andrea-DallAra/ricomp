import { db, LogEntry, PlanEntry } from '../db';
import type { Food } from '../data/foods';
import type { Recipe, MealKey } from '../data/recipes';
import { uid } from './format';
import { addDays, today, toMin, hhmm, weekday } from './dates';
import { getSettings, FREE } from './settings';

export type Macros = { kcal: number; p: number; c: number; f: number };
export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 };

export const macrosFor = (food: Food, g: number): Macros => ({
  kcal: (food.kcal * g) / 100, p: (food.p * g) / 100, c: (food.c * g) / 100, f: (food.f * g) / 100,
});
export const sum = (list: Macros[]): Macros =>
  list.reduce((a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f }), { ...ZERO });

export async function foodMap(): Promise<Map<string, Food>> {
  const all = await db.foods.toArray();
  return new Map(all.map((f) => [f.id, f]));
}

export function recipeMacros(r: Recipe, foods: Map<string, Food>, servings = 1): Macros {
  return sum(r.ingredients.map((i) => { const f = foods.get(i.foodId); return f ? macrosFor(f, i.g * servings) : ZERO; }));
}

const INV: Record<string, string> = { uovo: 'uova', hamburger: 'hamburger', kiwi: 'kiwi', pz: 'pz' };
export function plural(word: string, n: number) {
  if (Math.abs(n - 1) < 0.05) return word;
  if (INV[word]) return INV[word];
  if (word.endsWith('a')) return word.slice(0, -1) + 'e';
  if (word.endsWith('o') || word.endsWith('e')) return word.slice(0, -1) + 'i';
  return word;
}

export function qtyLabel(food: Food | undefined, g: number): string {
  if (!food) return `${Math.round(g)} g`;
  const u = food.unit || 'g';
  if (food.piece) {
    const n = g / food.piece;
    const nice = Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
    return `${nice} ${plural(food.pieceName || 'pz', n)} · ${Math.round(g)} ${u}`;
  }
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1).replace('.', ',')} ${u === 'ml' ? 'L' : 'kg'}`;
  return `${Math.round(g)} ${u}`;
}

export async function deductPantry(items: { foodId?: string; g: number }[]) {
  for (const it of items) {
    if (!it.foodId) continue;
    const row = await db.pantry.get(it.foodId);
    if (row) await db.pantry.put({ foodId: it.foodId, g: Math.max(0, row.g - it.g) });
  }
}

/** Qualsiasi cosa registrata in un pasto conta come "pasto fatto" per il piano (anche un'alternativa). */
export async function markMealDone(date: string, meal: MealKey) {
  const id = `${date}_${meal}`;
  if (await db.plan.get(id)) await db.plan.update(id, { done: true });
}

export async function logFood(date: string, meal: MealKey, food: Food, g: number, opts: { deduct?: boolean } = {}) {
  const m = macrosFor(food, g);
  await db.logs.add({ date, meal, foodId: food.id, name: food.name, g, ...m, ts: Date.now() });
  if (opts.deduct !== false) await deductPantry([{ foodId: food.id, g }]);
  await markMealDone(date, meal);
}

export async function logQuick(date: string, meal: MealKey, name: string, m: Macros) {
  await db.logs.add({ date, meal, name: name || 'Voce rapida', g: 0, ...m, ts: Date.now() });
  await markMealDone(date, meal);
}

export async function logRecipe(date: string, meal: MealKey, r: Recipe, servings = 1, opts: { deduct?: boolean } = {}) {
  const foods = await foodMap();
  const group = uid();
  const rows: LogEntry[] = r.ingredients.map((i) => {
    const f = foods.get(i.foodId);
    const g = i.g * servings;
    const m = f ? macrosFor(f, g) : ZERO;
    return { date, meal, foodId: i.foodId, name: f?.name || i.foodId, g, ...m, recipeId: r.id, group, ts: Date.now() };
  });
  await db.logs.bulkAdd(rows);
  if (opts.deduct !== false) await deductPantry(rows.map((x) => ({ foodId: x.foodId, g: x.g })));
  await markMealDone(date, meal);
}

export const MEAL_ORDER: MealKey[] = ['colazione', 'pranzo', 'spuntino', 'cena'];

/** Pasti pianificati non ancora fatti, in ordine, a partire da adesso, per i prossimi n giorni. */
export async function upcomingPlan(days: number, mealTimes: Record<string, string>): Promise<PlanEntry[]> {
  const t = today();
  const end = addDays(t, days - 1);
  const rows = await db.plan.where('date').between(t, end, true, true).toArray();
  const now = toMin(hhmm());
  return rows
    .filter((r) => !r.done && !!r.recipeId)
    .filter((r) => r.date !== t || toMin(mealTimes[r.meal] || '23:59') + 90 >= now)
    .sort((a, b) => (a.date === b.date ? MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) : a.date < b.date ? -1 : 1));
}

export type Need = { foodId: string; need: number; have: number; missing: number };

/** Fabbisogno ingredienti per una lista di pasti pianificati, confrontato con la dispensa. */
export async function computeNeeds(plan: PlanEntry[]): Promise<Need[]> {
  const recipes = new Map((await db.recipes.toArray()).map((r) => [r.id, r]));
  const pantry = new Map((await db.pantry.toArray()).map((p) => [p.foodId, p.g]));
  const need = new Map<string, number>();
  for (const p of plan) {
    const r = recipes.get(p.recipeId);
    if (!r) continue;
    for (const i of r.ingredients) need.set(i.foodId, (need.get(i.foodId) || 0) + i.g * (p.servings || 1));
  }
  return [...need.entries()].map(([foodId, n]) => {
    const have = pantry.get(foodId) || 0;
    return { foodId, need: n, have, missing: Math.max(0, n - have) };
  });
}

/** Arrotonda la quantità da comprare: pezzi interi o multipli di 50 g. */
export function buyQty(food: Food | undefined, g: number): number {
  if (!food) return Math.ceil(g);
  if (food.piece) return Math.ceil(g / food.piece - 0.05) * food.piece;
  if (g <= 50) return Math.ceil(g / 10) * 10;
  return Math.ceil(g / 50) * 50;
}

/** Riempie i prossimi `days` giorni con la dieta base. Le modifiche fatte a mano (auto=false) restano. */
export async function ensurePlan(days = 7) {
  const s = await getSettings();
  const t = today();
  const existing = new Map((await db.plan.where('date').between(t, addDays(t, days - 1), true, true).toArray()).map((p) => [p.id, p]));
  const puts: PlanEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(t, i);
    const base = s.baseDiet[weekday(d)] || {};
    for (const meal of MEAL_ORDER) {
      const id = `${d}_${meal}`;
      const cur = existing.get(id);
      const want = base[meal];
      if (cur && (cur.done || cur.auto === false)) continue;
      if (!want) { if (cur) await db.plan.delete(id); continue; }
      if (!cur || cur.recipeId !== want) puts.push({ id, date: d, meal, recipeId: want, servings: 1, done: false, auto: true });
    }
  }
  if (puts.length) await db.plan.bulkPut(puts);
}

/** Riporta un giorno (o tutti i prossimi 7) alla dieta base. */
export async function resetToBase(date?: string) {
  const t = today();
  const q = date ? db.plan.where('date').equals(date) : db.plan.where('date').aboveOrEqual(t);
  await q.filter((p) => !p.done).delete();
  await ensurePlan();
}

/** Calorie disponibili per un pasto libero: target del giorno meno gli altri pasti (mangiati o in programma). */
export async function freeMealBudget(date: string, meal: MealKey, target: number): Promise<number> {
  const logs = await db.logs.where('date').equals(date).toArray();
  const plan = await db.plan.where('date').equals(date).toArray();
  const foods = await foodMap();
  let used = 0;
  for (const m of MEAL_ORDER) {
    if (m === meal) continue;
    const ml = logs.filter((l) => l.meal === m);
    if (ml.length) { used += sum(ml).kcal; continue; }
    const p = plan.find((x) => x.meal === m);
    const r = p && p.recipeId !== FREE ? await db.recipes.get(p.recipeId) : null;
    if (r) used += recipeMacros(r, foods, p!.servings).kcal;
  }
  return Math.max(300, Math.round((target - used) / 50) * 50);
}

export { FREE };
