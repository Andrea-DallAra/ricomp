/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { dueNotes, Note } from './lib/reminders';
import { db } from './db';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

async function show(n: Note) {
  await self.registration.showNotification(n.title, {
    body: n.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: n.tag,
    data: { url: n.url },
    // @ts-ignore
    vibrate: [120, 60, 120],
  });
}

async function onPush() {
  const notes = await dueNotes(15);
  const test = (await db.kv.get('testPending'))?.value;
  if (test && Date.now() - test < 5 * 60000) {
    await db.kv.delete('testPending');
    notes.unshift({ title: 'Notifiche attive', body: 'Il server funziona: riceverai i promemoria anche ad app chiusa.', url: '#/impostazioni', tag: 'test' });
  }
  for (const n of notes) await show(n);
}

self.addEventListener('push', (e: PushEvent) => e.waitUntil(onPush()));

self.addEventListener('message', (e: ExtendableMessageEvent) => {
  if (e.data?.type === 'show') e.waitUntil(show(e.data.note));
});

self.addEventListener('notificationclick', (e: NotificationEvent) => {
  e.notification.close();
  const url = e.notification.data?.url || '#/oggi';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL('./' + url, self.registration.scope).href;
    for (const c of all) {
      if ('focus' in c) { await (c as WindowClient).focus(); try { await (c as WindowClient).navigate(target); } catch {} return; }
    }
    await self.clients.openWindow(target);
  })());
});
