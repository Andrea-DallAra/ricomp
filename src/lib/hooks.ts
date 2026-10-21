import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { defaultSettings, Settings } from './settings';

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const s = (await db.kv.get('settings'))?.value;
    return s ? { ...defaultSettings(), ...s } : undefined;
  });
}

/** Si aggiorna ogni minuto (per orari, pasti "prossimi", ecc.) */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function useHashRoute(): [string, (r: string) => void] {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'oggi');
  const [r, setR] = useState(get());
  useEffect(() => { const on = () => setR(get()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return [r, (x: string) => { location.hash = '/' + x; }];
}
