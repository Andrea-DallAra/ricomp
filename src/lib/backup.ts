import { db } from '../db';
import { today } from './dates';
import { updateSettings } from './settings';

const TABLES = ['foods', 'recipes', 'logs', 'plan', 'pantry', 'shop', 'days', 'weights', 'measures', 'workouts', 'checkins', 'kv'] as const;

const blobToDataURL = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async (u: string) => (await fetch(u)).blob();

export async function makeBackup(withPhotos: boolean): Promise<Blob> {
  const data: any = { app: 'ricomp', version: 1, created: new Date().toISOString(), tables: {} };
  for (const t of TABLES) data.tables[t] = await (db as any)[t].toArray();
  data.tables.kv = data.tables.kv.filter((k: any) => !['shown', 'testPending'].includes(k.key));
  if (withPhotos) {
    const photos = await db.photos.toArray();
    data.tables.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataURL(p.blob) })));
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function exportBackup(withPhotos: boolean, share: boolean) {
  const blob = await makeBackup(withPhotos);
  const name = `ricomp-backup-${today()}${withPhotos ? '-foto' : ''}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (share && (navigator as any).canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Backup Ricomp' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  await updateSettings({ lastBackup: today() });
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'ricomp') throw new Error('Questo file non è un backup di Ricomp');
  const tables = [...TABLES, 'photos'];
  await db.transaction('rw', tables.map((t) => (db as any)[t]), async () => {
    for (const t of TABLES) {
      if (!data.tables[t]) continue;
      await (db as any)[t].clear();
      await (db as any)[t].bulkPut(data.tables[t]);
    }
  });
  if (data.tables.photos) {
    await db.photos.clear();
    for (const p of data.tables.photos) await db.photos.put({ ...p, blob: await dataURLToBlob(p.blob) });
  }
}
