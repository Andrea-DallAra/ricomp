import { db } from '../db';
import { getSettings, updateSettings } from './settings';
import { slotsFor, dueNotes, Note } from './reminders';

export async function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return null;
  try { return await navigator.serviceWorker.register('./sw.js', { scope: './' }); } catch (e) { console.warn(e); return null; }
}

const b64ToU8 = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};
const cleanUrl = (u: string) => u.trim().replace(/\/+$/, '');

async function post(url: string, path: string, body: any) {
  const res = await fetch(cleanUrl(url) + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
  return data;
}

export const notifPermission = () => ('Notification' in window ? Notification.permission : 'denied');

export async function askPermission() {
  if (!('Notification' in window)) throw new Error('Questo browser non supporta le notifiche');
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error('Permesso notifiche negato. Abilitalo dalle impostazioni del telefono per Ricomp.');
}

export async function enablePush(url: string, secret: string) {
  await askPermission();
  const reg = await navigator.serviceWorker.ready;
  const keyRes = await fetch(cleanUrl(url) + '/key');
  if (!keyRes.ok) throw new Error('Server non raggiungibile: controlla l\'indirizzo');
  const { publicKey } = await keyRes.json();
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // se la chiave del server è cambiata, ricrea l'iscrizione
    const cur = sub.options.applicationServerKey;
    const same = cur && btoa(String.fromCharCode(...new Uint8Array(cur))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === publicKey;
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
  await updateSettings({ push: { url: cleanUrl(url), secret, enabled: true } });
  await syncSchedule();
}

export async function syncSchedule() {
  const s = await getSettings();
  if (!s.push.enabled || !s.push.url) return;
  const reg = await navigator.serviceWorker?.ready;
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const slots = slotsFor(s).map(({ t, days }) => ({ t, days }));
  const uniq = [...new Map(slots.map((x) => [x.t + (x.days || []).join(','), x])).values()];
  await post(s.push.url, '/subscribe', { subscription: sub.toJSON(), tz, slots: uniq, secret: s.push.secret });
}

export async function disablePush() {
  const s = await getSettings();
  const reg = await navigator.serviceWorker?.ready;
  const sub = await reg?.pushManager.getSubscription();
  if (sub && s.push.url) await post(s.push.url, '/unsubscribe', { endpoint: sub.endpoint, secret: s.push.secret }).catch(() => {});
  await sub?.unsubscribe();
  await updateSettings({ push: { ...s.push, enabled: false } });
}

export async function testPush() {
  const s = await getSettings();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) throw new Error('Notifiche non attive su questo telefono');
  await db.kv.put({ key: 'testPending', value: Date.now() });
  return post(s.push.url, '/test', { endpoint: sub.endpoint, secret: s.push.secret });
}

/** Con l'app aperta controlla i promemoria ogni minuto (doppia sicurezza). */
export function startLocalReminders(onNote: (n: Note) => void) {
  const tick = async () => {
    const notes = await dueNotes(3);
    for (const n of notes) {
      if (document.visibilityState === 'visible') onNote(n);
      else if (notifPermission() === 'granted') (await navigator.serviceWorker?.ready)?.showNotification(n.title, { body: n.body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: n.tag, data: { url: n.url } });
    }
  };
  const id = setInterval(tick, 60000);
  setTimeout(tick, 4000);
  return () => clearInterval(id);
}

export async function showNow(title: string, body: string, tag = 'ricomp') {
  if (notifPermission() !== 'granted') return false;
  const reg = await navigator.serviceWorker?.ready;
  if (!reg) return false;
  await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag, data: { url: '#/allenamento' }, requireInteraction: false, // @ts-ignore
    vibrate: [200, 100, 200] });
  return true;
}
