import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { Settings, updateSettings, Reminder } from '../lib/settings';
import { MEALS } from '../data/recipes';
import { enablePush, disablePush, testPush, notifPermission, askPermission, syncSchedule } from '../lib/push';
import { exportBackup, importBackup } from '../lib/backup';
import { longDate } from '../lib/dates';
import { Icon, Sheet, TopBar, useToast, num, Check } from '../components/ui';

export default function SettingsScreen({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [t, setT] = useState(settings.targets);
  const [prof, setProf] = useState(settings.profile);
  const [url, setUrl] = useState(settings.push.url);
  const [secret, setSecret] = useState(settings.push.secret);
  const [busy, setBusy] = useState('');
  const [perm, setPerm] = useState(notifPermission());
  const [persist, setPersist] = useState<boolean | null>(null);
  const [wipe, setWipe] = useState(false);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersist).catch(() => {}); }, []);

  const tf = (k: keyof Settings['targets'], label: string, scale = 1) => (
    <label className="field"><span>{label}</span>
      <input inputMode="decimal" value={String(t[k] / scale).replace('.', ',')} onChange={(e) => setT({ ...t, [k]: Math.round((num(e.target.value) || 0) * scale) })} /></label>
  );
  const macroKcal = t.p * 4 + t.c * 4 + t.f * 9;
  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok); } catch (e: any) { toast(<span style={{ color: '#b3261e' }}>{e.message || String(e)}</span>); }
    setBusy(''); setPerm(notifPermission());
  };
  const setRem = (id: string, patch: Partial<Reminder>) => updateSettings((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  return (
    <>
      <TopBar title="Impostazioni" right={<a className="iconbtn" href="#/oggi" aria-label="Indietro"><Icon name="left" /></a>} />

      <div className="section-title">Obiettivi giornalieri</div>
      <div className="panel">
        <div className="grid2">{tf('kcal', 'Calorie')}{tf('p', 'Proteine (g)')}{tf('c', 'Carboidrati (g)')}{tf('f', 'Grassi (g)')}</div>
        <p className="small muted" style={{ marginTop: -4 }}>I macro valgono {macroKcal} kcal{Math.abs(macroKcal - t.kcal) > 60 ? ` — ${macroKcal > t.kcal ? 'più' : 'meno'} del target calorie: ricontrolla.` : '.'}</p>
        <div className="grid2">{tf('water', 'Acqua (L)', 1000)}{tf('glass', 'Bicchiere (ml)')}{tf('steps', 'Passi')}{tf('creatina', 'Creatina (g)')}</div>
        <div className="grid2">
          <label className="field"><span>Altezza (cm)</span><input inputMode="numeric" value={prof.height} onChange={(e) => setProf({ ...prof, height: num(e.target.value) || 0 })} /></label>
          <label className="field"><span>Età</span><input inputMode="numeric" value={prof.age} onChange={(e) => setProf({ ...prof, age: num(e.target.value) || 0 })} /></label>
        </div>
        <button className="btn primary block" onClick={() => run('t', () => updateSettings({ targets: t, profile: prof }), 'Obiettivi salvati')}>Salva obiettivi</button>
      </div>

      <div className="section-title">Orari dei pasti</div>
      <div className="panel">
        <div className="grid2">
          {MEALS.map((m) => (
            <label key={m.key} className="field"><span>{m.label}</span>
              <input type="time" value={settings.mealTimes[m.key]} onChange={(e) => updateSettings((s) => ({ mealTimes: { ...s.mealTimes, [m.key]: e.target.value } }))} /></label>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Cambiano con le lezioni? Aggiornali qui: promemoria e "prossimo pasto" li seguono.</p>
      </div>

      <div className="section-title">Notifiche</div>
      <div className="panel">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div><div style={{ fontWeight: 600 }}>{settings.push.enabled ? 'Attive anche ad app chiusa' : perm === 'granted' ? 'Solo con l\'app aperta' : 'Non attive'}</div>
            <div className="small muted">Permesso del telefono: {perm === 'granted' ? 'concesso' : perm === 'denied' ? 'negato' : 'da chiedere'}</div></div>
          {perm !== 'granted' && <button className="btn small" onClick={() => run('perm', askPermission, 'Permesso concesso')}>Consenti</button>}
        </div>
        <label className="field"><span>Indirizzo del server (Cloudflare Worker)</span><input placeholder="https://ricomp-notifiche.tuonome.workers.dev" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" /></label>
        <label className="field"><span>Password del server (se l'hai impostata)</span><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
        <div className="row">
          <button className="btn primary grow" disabled={!url || !!busy} onClick={() => run('push', () => enablePush(url, secret), 'Notifiche attivate')}>{busy === 'push' ? 'Attivo…' : settings.push.enabled ? 'Aggiorna' : 'Attiva notifiche'}</button>
          {settings.push.enabled && <button className="btn" disabled={!!busy} onClick={() => run('test', testPush, 'Prova inviata: arriva tra pochi secondi')}>Prova</button>}
          {settings.push.enabled && <button className="btn ghost" onClick={() => run('off', disablePush, 'Notifiche disattivate')}>Spegni</button>}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small" style={{ color: 'var(--lime)', fontWeight: 600 }}>Come creare il server gratuito (10 minuti, una volta sola)</summary>
          <ol className="small muted" style={{ paddingLeft: 18, lineHeight: 1.55 }}>
            <li>Crea un account gratuito su dash.cloudflare.com.</li>
            <li>Storage &amp; Databases → KV → Create: chiamalo <b>ricomp</b>.</li>
            <li>Workers &amp; Pages → Create → Worker "Hello World" → chiamalo <b>ricomp-notifiche</b> → Deploy.</li>
            <li>Edit code: incolla tutto il file <b>worker/worker.js</b> della cartella del progetto → Deploy.</li>
            <li>Settings → Bindings → KV namespace: nome variabile <b>STORE</b>, namespace <b>ricomp</b>.</li>
            <li>Settings → Trigger events → Cron: <b>* * * * *</b> (ogni minuto).</li>
            <li>Facoltativo: Settings → Variables → <b>SECRET</b> con una password, da scrivere anche qui sopra.</li>
            <li>Copia l'indirizzo …workers.dev, incollalo qui e tocca "Attiva notifiche", poi "Prova".</li>
          </ol>
        </details>
      </div>

      <div className="panel flush">
        {settings.reminders.map((r) => (
          <div key={r.id} className="li" style={{ alignItems: 'flex-start' }}>
            <Check on={r.enabled} onClick={() => setRem(r.id, { enabled: !r.enabled })} label={r.label} />
            <div className="grow">
              <div className="t">{r.label}</div>
              {r.id === 'pasti' ? <div className="s">Agli orari dei pasti impostati sopra</div>
                : r.kind === 'interval' ? (
                  <div className="row small" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="muted">ogni</span>
                    <select style={{ width: 92, padding: '6px 8px' }} value={r.every} onChange={(e) => setRem(r.id, { every: +e.target.value })}>{[45, 60, 90, 120, 150].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
                    <span className="muted">dalle</span><input type="time" style={{ width: 96, padding: '6px 8px' }} value={r.from} onChange={(e) => setRem(r.id, { from: e.target.value })} />
                    <span className="muted">alle</span><input type="time" style={{ width: 96, padding: '6px 8px' }} value={r.to} onChange={(e) => setRem(r.id, { to: e.target.value })} />
                  </div>
                ) : (
                  <div className="row small" style={{ gap: 6, marginTop: 6 }}>
                    <span className="muted">{r.id === 'checkin' ? 'domenica alle' : r.id === 'allenamento' ? 'nei giorni di scheda alle' : 'alle'}</span>
                    <input type="time" style={{ width: 100, padding: '6px 8px' }} value={r.times?.[0] || ''} onChange={(e) => setRem(r.id, { times: [e.target.value] })} />
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Senza server, i promemoria compaiono solo mentre l'app è aperta.</p>

      <div className="section-title">Backup<small>{settings.lastBackup ? `ultimo ${longDate(settings.lastBackup)}` : 'mai fatto'}</small></div>
      <div className="panel stack">
        <p className="small muted" style={{ margin: 0 }}>I dati vivono solo su questo telefono. Salva un backup ogni settimana su Drive o Telegram: se cambi telefono lo reimporti.</p>
        <div className="row">
          <button className="btn primary grow" onClick={() => run('b1', () => exportBackup(false, true), 'Backup pronto')}><Icon name="share" size={18} /> Condividi backup</button>
          <button className="btn" onClick={() => run('b2', () => exportBackup(true, true), 'Backup con foto pronto')}>Con foto</button>
        </div>
        <label className="btn ghost block">Ripristina da file
          <input type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await run('imp', () => importBackup(f), 'Dati ripristinati'); }} />
        </label>
        {persist === false && <div className="callout small">Il browser potrebbe cancellare i dati se il telefono è pieno. Installa l'app sulla schermata Home per proteggerli.</div>}
      </div>

      <div className="section-title">Installazione</div>
      <div className="panel small muted">
        In Chrome per Android: menu ⋮ → <b>Aggiungi a schermata Home</b> (o "Installa app"). Si apre a schermo intero e funziona anche offline. Gli aggiornamenti arrivano da soli alla riapertura.
      </div>

      <button className="btn danger block" style={{ margin: '8px 0 16px' }} onClick={() => setWipe(true)}>Cancella tutti i dati</button>
      <Sheet open={wipe} onClose={() => setWipe(false)} title="Cancellare tutto?"
        footer={<><button className="btn ghost grow" onClick={() => setWipe(false)}>Annulla</button><button className="btn danger grow" onClick={async () => { await disablePush().catch(() => {}); await db.delete(); location.reload(); }}>Cancella</button></>}>
        <p className="muted" style={{ marginTop: 0 }}>Pasti, allenamenti, misure e foto vengono eliminati da questo telefono. Fai prima un backup se vuoi conservarli.</p>
      </Sheet>
    </>
  );
}
