export const fmt = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(n as number) ? '–' : (n as number).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtKg = (n: number | null | undefined) => (n == null ? '–' : fmt(n, Number.isInteger(n) ? 0 : n * 2 % 1 === 0 ? 1 : 2));
export const round = (n: number, step: number) => Math.round(n / step) * step;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch {} };
