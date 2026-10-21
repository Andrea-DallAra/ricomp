import { db, ExLog, Workout } from '../db';
import { Exercise, PHASES, isDeload, Session } from '../data/program';
import { diffDays, today } from './dates';
import { round, fmtKg } from './format';

export const weekNumber = (start: string, date = today()) => Math.max(1, Math.floor(diffDays(date, start) / 7) + 1);
export const phaseOf = (w: number) => PHASES.find((p) => w >= p.from && w <= p.to) || { label: 'Mantenimento', tip: 'Programma di 12 settimane concluso: aggiorna la scheda.', from: 13, to: 99 };

export type Target = { sets: number; repMin: number; repMax: number; rpe: string; rpeMax: number };
export function targetFor(ex: Exercise, week: number): Target {
  let t: Target = { sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax, rpe: ex.rpe, rpeMax: ex.rpeMax };
  if (ex.id === 'panca' && week >= 8 && week <= 11) t = { sets: 5, repMin: 3, repMax: 5, rpe: '8', rpeMax: 8 };
  if (ex.id === 'panca' && week === 12) t = { sets: 1, repMin: 3, repMax: 3, rpe: '9', rpeMax: 9 };
  else if (isDeload(week)) t = { ...t, sets: Math.max(2, Math.round(t.sets * 0.6)), rpe: '6', rpeMax: 6 };
  return t;
}

/** 1RM stimato (Epley), corretto per le ripetizioni in riserva se c'è l'RPE. */
export function e1rm(w: number, r: number, rpe?: number | null) {
  if (!w || !r) return 0;
  const rir = rpe && rpe >= 5 ? 10 - rpe : 0;
  const reps = r + rir;
  return reps <= 1 ? w : w * (1 + reps / 30);
}

export async function lastFor(name: string, beforeId?: number): Promise<{ w: Workout; ex: ExLog } | null> {
  const all = await db.workouts.orderBy('date').reverse().toArray();
  for (const w of all) {
    if (!w.end || w.id === beforeId) continue;
    const ex = w.exercises.find((e) => e.name === name && e.sets.some((s) => s.done));
    if (ex) return { w, ex };
  }
  return null;
}

export type Suggestion = { w: number | null; text: string; up: boolean };
export function suggest(ex: Exercise, t: Target, last: ExLog | null, week: number, variantName: string): Suggestion {
  const isMain = variantName === ex.name;
  if (!last) {
    const w = isMain && ex.startW != null ? ex.startW : null;
    return { w: w != null && isDeload(week) ? round(w * 0.9, 2.5) : w, text: w != null ? `Partenza consigliata: ${fmtKg(w)} kg` : 'Prima volta: scegli un carico da RPE ' + t.rpe, up: false };
  }
  const done = last.sets.filter((s) => s.done && s.r != null);
  if (!done.length) return { w: null, text: '', up: false };
  const topW = Math.max(...done.map((s) => s.w || 0));
  const atTop = done.filter((s) => (s.w || 0) === topW);
  const allMax = atTop.length >= Math.min(t.sets, done.length) && atTop.every((s) => (s.r || 0) >= t.repMax && (s.rpe == null || s.rpe <= t.rpeMax + 0.5));
  if (isDeload(week)) return { w: round(topW * 0.9, 2.5), text: `Scarico: ${fmtKg(round(topW * 0.9, 2.5))} kg, lontano dal cedimento`, up: false };
  if (ex.noLoad) return { w: null, text: allMax ? 'Rallenta il tempo o aggiungi difficoltà' : 'Stesse ripetizioni, più controllo', up: false };
  if (allMax && ex.inc > 0) return { w: topW + ex.inc, text: `Hai chiuso ${t.repMax} rip: sali a ${fmtKg(topW + ex.inc)} kg`, up: true };
  return { w: topW, text: `Resta a ${fmtKg(topW)} kg e aggiungi una ripetizione`, up: false };
}

export async function activeWorkout(): Promise<Workout | undefined> {
  const recent = await db.workouts.orderBy('id').reverse().limit(5).toArray();
  return recent.find((w) => !w.end);
}

export async function startWorkout(session: Session, week: number): Promise<number> {
  const existing = await activeWorkout();
  if (existing) return existing.id!;
  const exercises: ExLog[] = [];
  for (const ex of session.exercises) {
    const t = targetFor(ex, week);
    const last = await lastFor(ex.name);
    const s = suggest(ex, t, last?.ex || null, week, ex.name);
    exercises.push({ exId: ex.id, name: ex.name, sets: Array.from({ length: t.sets }, () => ({ w: ex.noLoad ? null : s.w, r: null, rpe: null, done: false })) });
  }
  return db.workouts.add({ date: today(), sessionId: session.id, week, start: Date.now(), exercises });
}

export function volume(w: Workout) {
  return w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((b, s) => b + (s.w || 0) * (s.r || 0), 0), 0);
}
