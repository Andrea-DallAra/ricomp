export type MealKey = 'colazione' | 'pranzo' | 'spuntino' | 'cena';
export const MEALS: { key: MealKey; label: string; time: string }[] = [
  { key: 'colazione', label: 'Colazione', time: '08:30' },
  { key: 'pranzo', label: 'Pranzo', time: '13:30' },
  { key: 'spuntino', label: 'Spuntino', time: '17:30' },
  { key: 'cena', label: 'Cena', time: '21:00' },
];

export type Ingredient = { foodId: string; g: number };
export type Recipe = { id: string; name: string; meal: MealKey; ingredients: Ingredient[]; note?: string; custom?: boolean };

export const RECIPES: Recipe[] = [
  { id: 'col_porridge', name: 'Porridge proteico', meal: 'colazione', note: 'Microonde 2–3 minuti, mescolando a metà.', ingredients: [
    { foodId: 'avena', g: 80 }, { foodId: 'latte_ps', g: 300 }, { foodId: 'whey', g: 30 }, { foodId: 'banana', g: 120 }] },
  { id: 'col_uova', name: 'Uova strapazzate e pane', meal: 'colazione', ingredients: [
    { foodId: 'uovo', g: 180 }, { foodId: 'pane', g: 80 }, { foodId: 'latte_ps', g: 200 }, { foodId: 'mela', g: 180 }] },
  { id: 'col_yogurt', name: 'Yogurt proteico e avena', meal: 'colazione', ingredients: [
    { foodId: 'yogurt_proteico', g: 240 }, { foodId: 'avena', g: 50 }, { foodId: 'banana', g: 120 }] },

  { id: 'pra_ragu', name: 'Pasta al ragù magro', meal: 'pranzo', note: 'Carota tritata nel sugo: non si sente.', ingredients: [
    { foodId: 'pasta', g: 100 }, { foodId: 'macinato_magro', g: 150 }, { foodId: 'passata', g: 150 }, { foodId: 'carota', g: 50 }, { foodId: 'olio', g: 10 }] },
  { id: 'pra_riso_pollo', name: 'Riso, pollo e peperoni', meal: 'pranzo', ingredients: [
    { foodId: 'riso', g: 100 }, { foodId: 'pollo_sovracoscia', g: 150 }, { foodId: 'peperone', g: 150 }, { foodId: 'zucchina', g: 100 }, { foodId: 'olio', g: 10 }] },
  { id: 'pra_lonza', name: 'Patate e lonza', meal: 'pranzo', note: 'Patate bucherellate al microonde 8–10 min, poi in padella.', ingredients: [
    { foodId: 'patate', g: 400 }, { foodId: 'lonza', g: 150 }, { foodId: 'pomodoro', g: 150 }, { foodId: 'olio', g: 10 }] },

  { id: 'spu_shaker', name: 'Shaker e banana', meal: 'spuntino', ingredients: [
    { foodId: 'whey', g: 30 }, { foodId: 'latte_ps', g: 300 }, { foodId: 'banana', g: 120 }] },
  { id: 'spu_panino', name: 'Panino al tonno', meal: 'spuntino', ingredients: [
    { foodId: 'pane', g: 100 }, { foodId: 'tonno', g: 56 }, { foodId: 'pomodoro', g: 100 }] },
  { id: 'spu_yogurt', name: 'Yogurt, frutta secca e mela', meal: 'spuntino', ingredients: [
    { foodId: 'yogurt_proteico', g: 120 }, { foodId: 'frutta_secca', g: 30 }, { foodId: 'mela', g: 180 }] },

  { id: 'cen_carbonara', name: 'Carbonara da ricomposizione', meal: 'cena', note: '2 uova + 1 albume, guanciale ridotto. Resta una carbonara vera.', ingredients: [
    { foodId: 'pasta', g: 90 }, { foodId: 'uovo', g: 120 }, { foodId: 'albume', g: 33 }, { foodId: 'guanciale', g: 40 }, { foodId: 'pecorino', g: 15 }] },
  { id: 'cen_hamburger', name: 'Hamburger e patate', meal: 'cena', ingredients: [
    { foodId: 'hamburger', g: 180 }, { foodId: 'patate', g: 300 }, { foodId: 'pomodoro', g: 100 }, { foodId: 'carota', g: 50 }, { foodId: 'olio', g: 10 }] },
  { id: 'cen_tortilla', name: 'Tortilla di patate', meal: 'cena', note: 'In padella con coperchio, si gira con un piatto.', ingredients: [
    { foodId: 'uovo', g: 180 }, { foodId: 'albume', g: 66 }, { foodId: 'patate', g: 250 }, { foodId: 'olio', g: 10 }, { foodId: 'mela', g: 180 }] },
  { id: 'cen_salmone', name: 'Salmone, riso e zucchine', meal: 'cena', ingredients: [
    { foodId: 'salmone', g: 150 }, { foodId: 'riso', g: 80 }, { foodId: 'zucchina', g: 150 }] },
];
