# Ricomp — allenamento, dieta, spesa e progressi

Web app installabile per Android. Funziona offline e i dati restano solo sul telefono.

## Cosa c'è dentro
- **Oggi**: calorie rimaste e macro, acqua, peso, passi, allenamento del giorno, prossimo pasto con gli ingredienti che mancano, creatina.
- **Dieta**: diario dei pasti (ricette del piano, alimenti, scanner codici a barre con Open Food Facts, voce rapida), piano pasti dei prossimi 7 giorni, ricette e alimenti modificabili.
- **Spesa**: lista calcolata dal piano pasti meno la dispensa, con checkbox. "Ho finito la spesa" sposta tutto in dispensa; i pasti segnati come mangiati la scalano.
- **Allenamento**: scheda Upper/Lower di 12 settimane con scarichi, carichi suggeriti (doppia progressione), RPE, timer di recupero con vibrazione, varianti, storico, record.
- **Progressi**: peso con media mobile a 7 giorni, misure e % di grasso (metodo Navy), massimale stimato per esercizio (con la linea dei 100 kg in panca), foto prima/dopo, check-in settimanale da copiare al coach.
- **Impostazioni**: obiettivi, orari dei pasti, promemoria, backup e ripristino.

## 1. Pubblicare l'app (gratis, una volta sola)
1. Su GitHub crea un repository **pubblico** chiamato `ricomp` (vuoto, senza README).
2. Sposta `da-spostare/deploy.yml` in `.github/workflows/deploy.yml` (crea le due cartelle; `.github` inizia con il punto). È il file che costruisce e pubblica l'app.
3. Carica il contenuto di questa cartella (tranne `node_modules` e `dist`), ad esempio con GitHub Desktop o con:
   ```
   git init
   git add .
   git commit -m "Ricomp"
   git branch -M main
   git remote add origin https://github.com/Andrea-DallAra/ricomp.git
   git push -u origin main
   ```
4. Sul repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Dopo 1–2 minuti l'app è su `https://andrea-dallara.github.io/ricomp/`.

Ogni volta che fai push su `main` l'app si aggiorna da sola; sul telefono l'aggiornamento arriva alla riapertura.

## 2. Installarla sul telefono
Apri l'indirizzo in **Chrome per Android** → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").

## 3. Notifiche ad app chiusa (Cloudflare, gratis)
1. Account gratuito su https://dash.cloudflare.com
2. **Storage & Databases → KV → Create**: nome `ricomp`.
3. **Workers & Pages → Create → Worker** ("Hello World"), nome `ricomp-notifiche` → Deploy.
4. **Edit code**: incolla tutto `worker/worker.js` → Deploy.
5. **Settings → Bindings → Add → KV namespace**: variabile `STORE`, namespace `ricomp`.
6. **Settings → Trigger events → Cron trigger**: `* * * * *`.
7. (Facoltativo) **Settings → Variables and secrets**: `SECRET` = una password.
8. Nell'app: Impostazioni → Notifiche → incolla l'indirizzo `https://ricomp-notifiche.<tuo-nome>.workers.dev` (e la password) → **Attiva notifiche** → **Prova**.

Il server non riceve nessun tuo dato: conosce solo gli orari dei promemoria e "sveglia" il telefono, che decide cosa mostrare (acqua bevuta, cosa manca per il prossimo pasto, ecc.).

## Sviluppo in locale
```
npm install
npm run dev
```
Per provarla dal telefono sulla stessa rete: `npm run build && npm run preview` e apri l'indirizzo di rete mostrato (le notifiche e l'installazione richiedono HTTPS, quindi vanno provate sulla versione pubblicata).

## Backup
I dati sono nel telefono (IndexedDB). Impostazioni → Backup → **Condividi backup** ogni settimana, salvalo su Drive o Telegram. "Ripristina da file" lo reimporta.
