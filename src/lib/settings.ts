import { db, setKV } from '../db';
import { FOODS } from '../data/foods';
import { RECIPES } from '../data/recipes';
import { SESSIONS, DEFAULT_SCHEDULE, Session } from '../data/program';
import { mondayOf, today } from './dates';

export type Reminder = {
  id: string; label: string; enabled: boolean; kind: 'fixed' | 'interval';
  times?: string[]; every?: number; from?: string; to?: string; days?: number[]; // 0=dom
};

export type Settings = {
  profile: { name: string; sex: 'M' | 'F'; age: number; height: number };
  targets: { kcal: number; p: number; c: number; f: number; water: number; glass: number; steps: number; creatina: number };
  program: { start: string; schedule: Record<number, string>; sessions: Session[] };
  mealTimes: Record<string, string>;
  shopDays: number;
  reminders: Reminder[];
  push: { url: string; secret: string; enabled: boolean };
  lastBackup?: string;
};

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'peso', label: 'Pesata mattutina', enabled: true, kind: 'fixed', times: ['08:00'] },
  { id: 'acqua', label: 'Bevi acqua', enabled: true, kind: 'interval', every: 90, from: '09:30', to: '21:30' },
  { id: 'pasti', label: 'Pasti del piano', enabled: true, kind: 'fixed', times: [] },
  { id: 'spesa', label: 'Spesa per i prossimi pasti', enabled: true, kind: 'fixed', times: ['18:30'] },
  { id: 'creatina', label: 'Creatina', enabled: true, kind: 'fixed', times: ['10:00'] },
  { id: 'allenamento', label: 'Allenamento del giorno', enabled: true, kind: 'fixed', times: ['10:00'] },
  { id: 'checkin', label: 'Check-in settimanale', enabled: true, kind: 'fixed', times: ['11:00'], days: [0] },
];

export const defaultSettings = (): Settings => ({
  profile: { name: 'Andrea', sex: 'M', age: 24, height: 175 },
  targets: { kcal: 2400, p: 150, c: 290, f: 70, water: 3000, glass: 250, steps: 8000, creatina: 3 },
  program: { start: mondayOf(today()), schedule: { ...DEFAULT_SCHEDULE }, sessions: JSON.parse(JSON.stringify(SESSIONS)) },
  mealTimes: { colazione: '08:30', pranzo: '13:30', spuntino: '17:30', cena: '21:00' },
  shopDays: 3,
  reminders: DEFAULT_REMINDERS,
  push: { url: '', secret: '', enabled: false },
});

const SEED_VERSION = 1;

export async function seed() {
  const v = (await db.kv.get('seedVersion'))?.value ?? 0;
  if (v >= SEED_VERSION) return;
  await db.transaction('rw', [db.foods, db.recipes, db.kv, db.weights, db.measures], async () => {
    const existingFoods = new Set(await db.foods.toCollection().primaryKeys());
    await db.foods.bulkPut(FOODS.filter((f) => !existingFoods.has(f.id)));
    const existingRecipes = new Set(await db.recipes.toCollection().primaryKeys());
    await db.recipes.bulkPut(RECIPES.filter((r) => !existingRecipes.has(r.id)));
    if (!(await db.kv.get('settings'))) await db.kv.put({ key: 'settings', value: defaultSettings() });
    if (v === 0) {
      // Punto di partenza comunicato il 20 ottobre 2026
      if (!(await db.weights.get('2026-10-20'))) await db.weights.put({ date: '2026-10-20', kg: 69 });
      if (!(await db.measures.get('2026-10-20')))
        await db.measures.put({ date: '2026-10-20', vita: 85, fianchi: 95, collo: 37, braccio: 30, braccioC: 35.5, petto: 102, coscia: 53 });
    }
    await db.kv.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}

export async function getSettings(): Promise<Settings> {
  const s = (await db.kv.get('settings'))?.value;
  return { ...defaultSettings(), ...(s || {}) };
}

export async function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const cur = await getSettings();
  const p = typeof patch === 'function' ? patch(cur) : patch;
  await setKV('settings', { ...cur, ...p });
}
