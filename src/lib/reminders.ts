// Logica dei promemoria condivisa tra app e service worker (niente React qui).
import { db } from '../db';
import { getSettings, Settings } from './settings';
import { today, toMin, fromMin, hhmm } from './dates';
import { upcomingPlan, computeNeeds, foodMap, qtyLabel, buyQty } from './nutrition';
import { MEALS } from '../data/recipes';

export type Slot = { id: string; t: string; days?: number[] };

export function slotsFor(s: Settings): Slot[] {
  const out: Slot[] = [];
  for (const r of s.reminders) {
    if (!r.enabled) continue;
    if (r.id === 'pasti') {
      for (const m of MEALS) out.push({ id: `pasti:${m.key}`, t: s.mealTimes[m.key] || m.time });
      continue;
    }
    if (r.id === 'allenamento') {
      const days = Object.keys(s.program.schedule).map(Number);
      for (const t of r.times || []) out.push({ id: r.id, t, days });
      continue;
    }
    if (r.kind === 'interval' && r.every && r.from && r.to) {
      for (let m = toMin(r.from); m <= toMin(r.to); m += r.every) out.push({ id: r.id, t: fromMin(m), days: r.days });
      continue;
    }
    for (const t of r.times || []) out.push({ id: r.id, t, days: r.days });
  }
  return out;
}

export type Note = { title: string; body: string; url: string; tag: string };

export async function messageFor(id: string, s: Settings): Promise<Note | null> {
  const d = today();
  const day = (await db.days.get(d)) || { date: d };
  if (id === 'acqua') {
    const w = day.water || 0;
    if (w >= s.targets.water) return null;
    return { title: 'Bevi un bicchiere d\'acqua', body: `Oggi ${(w / 1000).toFixed(1).replace('.', ',')} L su ${(s.targets.water / 1000).toFixed(1).replace('.', ',')} L`, url: '#/oggi', tag: 'acqua' };
  }
  if (id === 'peso') {
    if (await db.weights.get(d)) return null;
    return { title: 'Pesata del mattino', body: 'Dopo il bagno, prima di mangiare. Registrala in 5 secondi.', url: '#/progressi/peso', tag: 'peso' };
  }
  if (id === 'creatina') {
    if (day.creatina) return null;
    return { title: 'Creatina', body: `${s.targets.creatina} g, anche nei giorni di riposo.`, url: '#/oggi', tag: 'creatina' };
  }
  if (id === 'allenamento') {
    const sid = s.program.schedule[new Date().getDay()];
    const sess = s.program.sessions.find((x) => x.id === sid);
    if (!sess) return null;
    const doneToday = (await db.workouts.where('date').equals(d).toArray()).some((w) => w.end);
    if (doneToday) return null;
    return { title: `Oggi: ${sess.name}`, body: `${sess.focus} · ${sess.exercises.length} esercizi`, url: '#/allenamento', tag: 'allenamento' };
  }
  if (id === 'checkin') {
    return { title: 'Check-in settimanale', body: 'Media del peso, misure e carichi: compila e mandalo al coach.', url: '#/progressi/checkin', tag: 'checkin' };
  }
  if (id.startsWith('pasti:')) {
    const meal = id.split(':')[1];
    const p = await db.plan.get(`${d}_${meal}`);
    const label = MEALS.find((m) => m.key === meal)?.label || 'Pasto';
    if (p?.done) return null;
    if (p?.recipeId === 'libero') return { title: `${label}: pasto libero`, body: 'Goditelo, e punta comunque a 35–40 g di proteine. Registralo quando hai finito.', url: '#/dieta', tag: 'pasto' };
    const r = p ? await db.recipes.get(p.recipeId) : null;
    return { title: `${label}`, body: r ? `In programma: ${r.name}. Segnalo come mangiato.` : 'Registra cosa mangi per restare nei macro.', url: '#/dieta', tag: 'pasto' };
  }
  if (id === 'spesa') {
    const plan = await upcomingPlan(2, s.mealTimes);
    if (!plan.length) return { title: 'Pianifica i pasti', body: 'Non hai pasti pianificati per domani: sceglili e la lista spesa si crea da sola.', url: '#/dieta/piano', tag: 'spesa' };
    const needs = (await computeNeeds(plan)).filter((n) => n.missing > 0);
    if (!needs.length) return null;
    const foods = await foodMap();
    const names = needs.slice(0, 4).map((n) => `${foods.get(n.foodId)?.name || n.foodId} (${qtyLabel(foods.get(n.foodId), buyQty(foods.get(n.foodId), n.missing)).split(' · ')[0]})`);
    return { title: `Da comprare: ${needs.length} ${needs.length === 1 ? 'prodotto' : 'prodotti'}`, body: names.join(', ') + (needs.length > 4 ? '…' : ''), url: '#/spesa', tag: 'spesa' };
  }
  return null;
}

/** Trova i promemoria scaduti negli ultimi `windowMin` minuti e non ancora mostrati. */
export async function dueNotes(windowMin = 12): Promise<Note[]> {
  const s = await getSettings();
  const now = toMin(hhmm());
  const wd = new Date().getDay();
  const d = today();
  const shown: Record<string, number> = (await db.kv.get('shown'))?.value || {};
  const out: Note[] = [];
  const seen = new Set<string>();
  for (const slot of slotsFor(s)) {
    if (slot.days && !slot.days.includes(wd)) continue;
    const m = toMin(slot.t);
    if (m > now || now - m > windowMin) continue;
    const key = `${slot.id}|${d}|${slot.t}`;
    if (shown[key] || seen.has(slot.id)) continue;
    seen.add(slot.id);
    shown[key] = Date.now();
    const note = await messageFor(slot.id, s);
    if (note) out.push(note);
  }
  // pulizia chiavi vecchie
  const cutoff = Date.now() - 3 * 86400000;
  for (const k of Object.keys(shown)) if (shown[k] < cutoff) delete shown[k];
  await db.kv.put({ key: 'shown', value: shown });
  return out;
}
