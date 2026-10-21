export type Exercise = {
  id: string;
  name: string;
  alts: string[];
  sets: number;
  repMin: number;
  repMax: number;
  rpe: string; // es. "7–8"
  rpeMax: number;
  rest: number; // secondi
  inc: number; // incremento kg
  startW?: number;
  note?: string;
  perSide?: boolean;
  noLoad?: boolean;
};
export type Session = { id: string; name: string; focus: string; exercises: Exercise[] };

export const SESSIONS: Session[] = [
  {
    id: 'UA', name: 'Upper A', focus: 'Forza panca', exercises: [
      { id: 'panca', name: 'Panca piana bilanciere', alts: ['Panca piana manubri'], sets: 4, repMin: 4, repMax: 6, rpe: '7–8', rpeMax: 8, rest: 180, inc: 2.5, startW: 60, note: 'Presa media, scapole addotte e depresse, barra al basso petto.' },
      { id: 'rematore', name: 'Rematore bilanciere', alts: ['T-bar row', 'Rematore manubrio'], sets: 4, repMin: 6, repMax: 8, rpe: '8', rpeMax: 8, rest: 150, inc: 2.5 },
      { id: 'inclinata_man', name: 'Panca inclinata manubri 30°', alts: ['Chest press inclinata'], sets: 3, repMin: 8, repMax: 10, rpe: '8', rpeMax: 8, rest: 120, inc: 2 },
      { id: 'lat_neutra', name: 'Lat machine presa neutra', alts: ['Pulley basso presa larga'], sets: 3, repMin: 8, repMax: 12, rpe: '8', rpeMax: 8, rest: 120, inc: 2.5 },
      { id: 'alzate_lat', name: 'Alzate laterali', alts: ['Alzate laterali al cavo', 'Macchina alzate laterali'], sets: 3, repMin: 12, repMax: 15, rpe: '9', rpeMax: 9, rest: 75, inc: 1 },
      { id: 'curl_ez', name: 'Curl bilanciere EZ', alts: ['Curl manubri'], sets: 3, repMin: 8, repMax: 12, rpe: '9', rpeMax: 9, rest: 90, inc: 2.5 },
      { id: 'pushdown', name: 'Pushdown al cavo', alts: ['Estensione manubrio a una mano'], sets: 3, repMin: 10, repMax: 12, rpe: '9', rpeMax: 9, rest: 75, inc: 2.5 },
    ],
  },
  {
    id: 'LA', name: 'Lower A', focus: 'Squat', exercises: [
      { id: 'squat', name: 'Squat bilanciere', alts: ['Hack squat', 'Safety bar squat'], sets: 4, repMin: 5, repMax: 7, rpe: '7–8', rpeMax: 8, rest: 180, inc: 5, startW: 70, note: 'Se la barra sulle spalle dà fastidio, allarga la presa o usa hack squat.' },
      { id: 'rdl', name: 'Stacco rumeno', alts: ['Stacco rumeno manubri'], sets: 3, repMin: 8, repMax: 10, rpe: '7–8', rpeMax: 8, rest: 150, inc: 5 },
      { id: 'leg_press', name: 'Leg press', alts: ['Affondi bulgari'], sets: 3, repMin: 10, repMax: 12, rpe: '8', rpeMax: 8, rest: 120, inc: 10 },
      { id: 'leg_curl_seduto', name: 'Leg curl seduto', alts: ['Leg curl sdraiato'], sets: 3, repMin: 10, repMax: 12, rpe: '9', rpeMax: 9, rest: 90, inc: 2.5 },
      { id: 'calf', name: 'Calf in piedi', alts: ['Calf alla leg press'], sets: 4, repMin: 10, repMax: 15, rpe: '9', rpeMax: 9, rest: 60, inc: 5 },
      { id: 'dead_bug', name: 'Dead bug', alts: ['Plank 30–45"'], sets: 3, repMin: 8, repMax: 8, rpe: '–', rpeMax: 10, rest: 60, inc: 0, perSide: true, noLoad: true },
    ],
  },
  {
    id: 'UB', name: 'Upper B', focus: 'Volume panca', exercises: [
      { id: 'panca_fermo', name: 'Panca con fermo 1" al petto', alts: ['Panca piana manubri'], sets: 4, repMin: 6, repMax: 8, rpe: '7–8', rpeMax: 8, rest: 150, inc: 2.5, startW: 52.5 },
      { id: 'chin_up', name: 'Trazioni chin-up', alts: ['Lat machine presa supina'], sets: 4, repMin: 6, repMax: 10, rpe: '8', rpeMax: 8, rest: 150, inc: 2.5, note: 'Carico = zavorra aggiunta (0 a corpo libero). Zavorra quando superi le 10.' },
      { id: 'landmine', name: 'Landmine press a un braccio', alts: ['Chest press'], sets: 3, repMin: 8, repMax: 10, rpe: '8', rpeMax: 8, rest: 120, inc: 2.5, perSide: true, note: 'Sostituisce il lento sopra la testa per proteggere la spalla.' },
      { id: 'rematore_petto', name: 'Rematore petto appoggiato', alts: ['Pulley basso'], sets: 3, repMin: 10, repMax: 12, rpe: '8', rpeMax: 8, rest: 105, inc: 2.5 },
      { id: 'panca_stretta', name: 'Panca presa stretta', alts: ['Panca stretta alla Smith'], sets: 3, repMin: 6, repMax: 10, rpe: '8', rpeMax: 8, rest: 120, inc: 2.5, note: 'Presa larghezza spalle, gomiti vicini al busto.' },
      { id: 'face_pull', name: 'Face pull', alts: ['Alzate posteriori su panca inclinata'], sets: 3, repMin: 15, repMax: 15, rpe: '8', rpeMax: 8, rest: 60, inc: 2.5 },
      { id: 'curl_martello', name: 'Curl a martello', alts: ['Curl su panca inclinata'], sets: 3, repMin: 10, repMax: 12, rpe: '9', rpeMax: 9, rest: 75, inc: 2 },
    ],
  },
  {
    id: 'LB', name: 'Lower B', focus: 'Stacco e glutei', exercises: [
      { id: 'stacco', name: 'Stacco da terra', alts: ['Stacco con trap bar'], sets: 3, repMin: 4, repMax: 6, rpe: '7', rpeMax: 7, rest: 180, inc: 5, startW: 100 },
      { id: 'bulgari', name: 'Affondi bulgari', alts: ['Hack squat'], sets: 3, repMin: 8, repMax: 10, rpe: '8', rpeMax: 8, rest: 120, inc: 2, perSide: true },
      { id: 'hip_thrust', name: 'Hip thrust', alts: ['Glute bridge bilanciere'], sets: 3, repMin: 8, repMax: 12, rpe: '8', rpeMax: 8, rest: 120, inc: 5 },
      { id: 'leg_ext', name: 'Leg extension', alts: ['Sissy squat'], sets: 3, repMin: 12, repMax: 15, rpe: '9', rpeMax: 9, rest: 75, inc: 2.5 },
      { id: 'leg_curl_sdraiato', name: 'Leg curl sdraiato', alts: ['Leg curl seduto'], sets: 3, repMin: 10, repMax: 12, rpe: '9', rpeMax: 9, rest: 75, inc: 2.5 },
      { id: 'pallof', name: 'Pallof press o crunch al cavo', alts: ['Ab wheel'], sets: 3, repMin: 10, repMax: 12, rpe: '–', rpeMax: 10, rest: 60, inc: 2.5 },
    ],
  },
];

// Giorno settimana (0 = domenica) -> sessione
export const DEFAULT_SCHEDULE: Record<number, string> = { 1: 'UA', 2: 'LA', 4: 'UB', 5: 'LB' };

export const PHASES = [
  { from: 1, to: 2, label: 'Rodaggio', tip: 'Tecnica e carichi conservativi (RPE 6–7).' },
  { from: 3, to: 6, label: 'Accumulo', tip: 'Doppia progressione: chiudi le ripetizioni massime e aumenta.' },
  { from: 7, to: 7, label: 'Scarico', tip: 'Carichi −10%, volume −40%. Recupera.' },
  { from: 8, to: 11, label: 'Intensificazione', tip: 'Panca 5×3–5 a RPE 8, +2,5 kg a settimana.' },
  { from: 12, to: 12, label: 'Test e scarico', tip: 'Panca: 3 ripetizioni a RPE 9, poi scarico.' },
];
export const isDeload = (w: number) => w === 7 || w === 12;
