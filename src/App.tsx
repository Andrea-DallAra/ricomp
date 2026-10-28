import React, { useEffect } from 'react';
import { Icon, ToastProvider, useToast } from './components/ui';
import { useHashRoute, useSettings, useNow } from './lib/hooks';
import { ensurePlan } from './lib/nutrition';
import { today } from './lib/dates';
import { startLocalReminders, syncSchedule } from './lib/push';
import Today from './screens/Today';
import Diet from './screens/Diet';
import Shopping from './screens/Shopping';
import Training from './screens/Training';
import Progress from './screens/Progress';
import SettingsScreen from './screens/Settings';
import { RestTimer } from './components/RestTimer';

const TABS = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'dieta', label: 'Dieta' },
  { id: 'spesa', label: 'Spesa' },
  { id: 'allenamento', label: 'Allena' },
  { id: 'progressi', label: 'Progressi' },
];

function Shell() {
  const [route, go] = useHashRoute();
  const settings = useSettings();
  const toast = useToast();
  const [root, ...rest] = route.split('/');

  useEffect(() => startLocalReminders((n) => toast(<><b>{n.title}</b><br />{n.body}</>, { label: 'Apri', run: () => (location.hash = n.url) })), []);
  // quando cambiano promemoria o orari, aggiorna il server notifiche
  const schedKey = settings ? JSON.stringify([settings.reminders, settings.mealTimes, settings.program.schedule, settings.push.enabled]) : '';
  useEffect(() => { if (settings?.push.enabled) syncSchedule().catch(() => {}); }, [schedKey]);
  useEffect(() => { window.scrollTo(0, 0); }, [root]);
  // la dieta base riempie da sola i prossimi 7 giorni (anche a cambio giorno)
  useNow();
  const day = today();
  useEffect(() => { ensurePlan().catch(() => {}); }, [day, JSON.stringify(settings?.baseDiet)]);

  if (!settings) return null;
  const screen = (() => {
    switch (root) {
      case 'dieta': return <Diet sub={rest[0]} settings={settings} />;
      case 'spesa': return <Shopping sub={rest[0]} settings={settings} />;
      case 'allenamento': return <Training sub={rest} settings={settings} />;
      case 'progressi': return <Progress sub={rest[0]} settings={settings} />;
      case 'impostazioni': return <SettingsScreen settings={settings} />;
      default: return <Today settings={settings} />;
    }
  })();

  return (
    <>
      <main className="app">{screen}</main>
      <RestTimer />
      <div className="tabbar">
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${root === t.id || (t.id === 'oggi' && !TABS.some((x) => x.id === root)) ? 'on' : ''}`} onClick={() => go(t.id)} aria-label={t.label}>
              <Icon name={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

export default function App() {
  return <ToastProvider><Shell /></ToastProvider>;
}
