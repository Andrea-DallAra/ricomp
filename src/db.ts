import Dexie, { Table } from 'dexie';
import type { Food } from './data/foods';
import type { Recipe, MealKey } from './data/recipes';

export type LogEntry = {
  id?: number; date: string; meal: MealKey; foodId?: string; name: string; g: number;
  kcal: number; p: number; c: number; f: number; recipeId?: string; group?: string; ts: number;
};
export type PlanEntry = { id: string; date: string; meal: MealKey; recipeId: string; servings: number; done?: boolean; auto?: boolean };
export type PantryItem = { foodId: string; g: number };
export type ShopItem = { id?: number; name: string; qty?: string; checked: boolean; foodId?: string; g?: number; auto?: boolean };
export type Day = { date: string; water?: number; steps?: number; creatina?: boolean; sleep?: number };
export type Weight = { date: string; kg: number };
export type Measure = { date: string; vita?: number; fianchi?: number; collo?: number; braccio?: number; braccioC?: number; petto?: number; coscia?: number };
export type SetLog = { w: number | null; r: number | null; rpe: number | null; done: boolean };
export type ExLog = { exId: string; name: string; sets: SetLog[]; note?: string };
export type Workout = { id?: number; date: string; sessionId: string; week: number; start: number; end?: number; exercises: ExLog[]; notes?: string };
export type Photo = { id?: number; date: string; pose: 'fronte' | 'lato' | 'retro'; blob: Blob };
export type Checkin = { id?: number; date: string; week: number; text: string; sleep?: number; energy?: number; hunger?: number; adherence?: string; pain?: string };
export type KV = { key: string; value: any };

class RicompDB extends Dexie {
  foods!: Table<Food, string>;
  recipes!: Table<Recipe, string>;
  logs!: Table<LogEntry, number>;
  plan!: Table<PlanEntry, string>;
  pantry!: Table<PantryItem, string>;
  shop!: Table<ShopItem, number>;
  days!: Table<Day, string>;
  weights!: Table<Weight, string>;
  measures!: Table<Measure, string>;
  workouts!: Table<Workout, number>;
  photos!: Table<Photo, number>;
  checkins!: Table<Checkin, number>;
  kv!: Table<KV, string>;
  constructor() {
    super('ricomp');
    this.version(1).stores({
      foods: 'id, name, cat, barcode',
      recipes: 'id, meal',
      logs: '++id, date, meal',
      plan: 'id, date',
      pantry: 'foodId',
      shop: '++id',
      days: 'date',
      weights: 'date',
      measures: 'date',
      workouts: '++id, date, sessionId, end',
      photos: '++id, date, pose',
      checkins: '++id, date',
      kv: 'key',
    });
  }
}

export const db = new RicompDB();

export async function getKV<T = any>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export const setKV = (key: string, value: any) => db.kv.put({ key, value });
