// Valori per 100 g (o 100 ml). Indicativi, da tabelle CREA/USDA; modificabili nell'app.
// piece: peso medio di un pezzo in grammi (per uova, frutta, vasetti, scatolette).
export type Food = {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  cat: string;
  unit?: 'g' | 'ml';
  piece?: number;
  pieceName?: string;
  barcode?: string;
  brand?: string;
  custom?: boolean;
};

export const CATEGORIES = ['Carne e pesce', 'Uova e latticini', 'Carboidrati', 'Frutta', 'Verdura e legumi', 'Condimenti', 'Snack e altro', 'Integratori'];

export const FOODS: Food[] = [
  // Carne e pesce
  { id: 'pollo_petto', name: 'Petto di pollo', kcal: 110, p: 23, c: 0, f: 1.5, cat: 'Carne e pesce' },
  { id: 'pollo_sovracoscia', name: 'Sovracoscia di pollo (senza pelle)', kcal: 150, p: 19, c: 0, f: 8, cat: 'Carne e pesce' },
  { id: 'macinato_magro', name: 'Macinato di manzo magro (5%)', kcal: 135, p: 21, c: 0, f: 5.5, cat: 'Carne e pesce' },
  { id: 'lonza', name: 'Lonza di maiale', kcal: 145, p: 21, c: 0, f: 6.5, cat: 'Carne e pesce' },
  { id: 'hamburger', name: 'Hamburger di bovino', kcal: 215, p: 18, c: 0, f: 15.5, cat: 'Carne e pesce', piece: 90, pieceName: 'hamburger' },
  { id: 'fesa_tacchino', name: 'Fesa di tacchino affettata', kcal: 105, p: 22, c: 1, f: 1.5, cat: 'Carne e pesce' },
  { id: 'prosciutto_cotto', name: 'Prosciutto cotto', kcal: 140, p: 19, c: 1, f: 6.5, cat: 'Carne e pesce' },
  { id: 'prosciutto_crudo', name: 'Prosciutto crudo / jamón serrano', kcal: 250, p: 28, c: 0, f: 15, cat: 'Carne e pesce' },
  { id: 'lomo', name: 'Lomo embuchado', kcal: 220, p: 32, c: 1, f: 10, cat: 'Carne e pesce' },
  { id: 'salsiccia_secca', name: 'Salsiccia secca', kcal: 400, p: 25, c: 1, f: 33, cat: 'Carne e pesce' },
  { id: 'guanciale', name: 'Guanciale', kcal: 650, p: 8, c: 0, f: 69, cat: 'Carne e pesce' },
  { id: 'pancetta', name: 'Pancetta a cubetti', kcal: 300, p: 15, c: 0.5, f: 27, cat: 'Carne e pesce' },
  { id: 'tonno', name: 'Tonno al naturale (sgocciolato)', kcal: 103, p: 24, c: 0, f: 0.8, cat: 'Carne e pesce', piece: 56, pieceName: 'scatoletta' },
  { id: 'salmone', name: 'Salmone', kcal: 208, p: 20, c: 0, f: 13, cat: 'Carne e pesce' },
  { id: 'sardine', name: 'Sardine in scatola (sgocciolate)', kcal: 208, p: 25, c: 0, f: 11.5, cat: 'Carne e pesce', piece: 85, pieceName: 'scatoletta' },

  // Uova e latticini
  { id: 'uovo', name: 'Uovo intero', kcal: 143, p: 12.6, c: 0.7, f: 9.5, cat: 'Uova e latticini', piece: 60, pieceName: 'uovo' },
  { id: 'albume', name: 'Albume', kcal: 52, p: 11, c: 0.7, f: 0.2, cat: 'Uova e latticini', piece: 33, pieceName: 'albume' },
  { id: 'latte_ps', name: 'Latte parzialmente scremato', kcal: 46, p: 3.4, c: 4.9, f: 1.6, cat: 'Uova e latticini', unit: 'ml' },
  { id: 'yogurt_proteico', name: 'Yogurt proteico aromatizzato', kcal: 65, p: 10, c: 5, f: 0.3, cat: 'Uova e latticini', piece: 120, pieceName: 'vasetto' },
  { id: 'pecorino', name: 'Pecorino romano', kcal: 390, p: 28, c: 0.2, f: 31, cat: 'Uova e latticini' },
  { id: 'grana', name: 'Grana padano', kcal: 398, p: 33, c: 0, f: 29, cat: 'Uova e latticini' },
  { id: 'mozzarella', name: 'Mozzarella', kcal: 250, p: 18, c: 1, f: 19.5, cat: 'Uova e latticini', piece: 125, pieceName: 'mozzarella' },

  // Carboidrati
  { id: 'pasta', name: 'Pasta di semola', kcal: 357, p: 12.5, c: 72, f: 1.5, cat: 'Carboidrati' },
  { id: 'riso', name: 'Riso', kcal: 360, p: 7, c: 79, f: 0.6, cat: 'Carboidrati' },
  { id: 'avena', name: "Fiocchi d'avena", kcal: 372, p: 13, c: 60, f: 7, cat: 'Carboidrati' },
  { id: 'pane', name: 'Pane comune', kcal: 265, p: 9, c: 51, f: 3, cat: 'Carboidrati' },
  { id: 'patate', name: 'Patate', kcal: 77, p: 2, c: 17, f: 0.1, cat: 'Carboidrati' },
  { id: 'cereali', name: 'Corn flakes', kcal: 378, p: 7, c: 84, f: 0.9, cat: 'Carboidrati' },
  { id: 'tortilla_wrap', name: 'Piadina / tortilla wrap', kcal: 300, p: 8, c: 50, f: 7, cat: 'Carboidrati', piece: 60, pieceName: 'piadina' },
  { id: 'gnocchi', name: 'Gnocchi di patate', kcal: 150, p: 3.5, c: 33, f: 0.3, cat: 'Carboidrati' },

  // Frutta
  { id: 'banana', name: 'Banana', kcal: 89, p: 1.1, c: 23, f: 0.3, cat: 'Frutta', piece: 120, pieceName: 'banana' },
  { id: 'mela', name: 'Mela', kcal: 52, p: 0.3, c: 14, f: 0.2, cat: 'Frutta', piece: 180, pieceName: 'mela' },
  { id: 'arancia', name: 'Arancia', kcal: 47, p: 0.9, c: 12, f: 0.1, cat: 'Frutta', piece: 200, pieceName: 'arancia' },
  { id: 'kiwi', name: 'Kiwi', kcal: 61, p: 1.1, c: 15, f: 0.5, cat: 'Frutta', piece: 75, pieceName: 'kiwi' },
  { id: 'frutta_secca', name: 'Frutta secca mista', kcal: 600, p: 18, c: 15, f: 52, cat: 'Frutta' },

  // Verdura e legumi
  { id: 'pomodoro', name: 'Pomodori', kcal: 18, p: 0.9, c: 3.9, f: 0.2, cat: 'Verdura e legumi' },
  { id: 'passata', name: 'Passata di pomodoro', kcal: 30, p: 1.3, c: 5, f: 0.2, cat: 'Verdura e legumi' },
  { id: 'carota', name: 'Carote', kcal: 41, p: 0.9, c: 10, f: 0.2, cat: 'Verdura e legumi' },
  { id: 'peperone', name: 'Peperoni', kcal: 26, p: 1, c: 6, f: 0.3, cat: 'Verdura e legumi' },
  { id: 'zucchina', name: 'Zucchine', kcal: 17, p: 1.2, c: 3.1, f: 0.3, cat: 'Verdura e legumi' },
  { id: 'cipolla', name: 'Cipolla', kcal: 40, p: 1.1, c: 9, f: 0.1, cat: 'Verdura e legumi' },
  { id: 'ceci', name: 'Ceci in barattolo (sgocciolati)', kcal: 120, p: 7, c: 17, f: 2.5, cat: 'Verdura e legumi' },
  { id: 'lenticchie', name: 'Lenticchie in barattolo (sgocciolate)', kcal: 90, p: 7, c: 13, f: 0.5, cat: 'Verdura e legumi' },
  { id: 'fagioli', name: 'Fagioli in barattolo (sgocciolati)', kcal: 95, p: 6.5, c: 14, f: 0.5, cat: 'Verdura e legumi' },

  // Condimenti
  { id: 'olio', name: "Olio extravergine d'oliva", kcal: 884, p: 0, c: 0, f: 100, cat: 'Condimenti', unit: 'ml' },
  { id: 'burro_arachidi', name: "Burro d'arachidi", kcal: 590, p: 25, c: 15, f: 50, cat: 'Condimenti' },
  { id: 'miele', name: 'Miele', kcal: 304, p: 0.3, c: 82, f: 0, cat: 'Condimenti' },

  // Snack e altro
  { id: 'cioccolato', name: 'Cioccolato fondente 70%', kcal: 580, p: 8, c: 34, f: 43, cat: 'Snack e altro' },
  { id: 'pizza', name: 'Pizza margherita', kcal: 270, p: 11, c: 34, f: 10, cat: 'Snack e altro' },

  // Integratori
  { id: 'whey', name: 'Proteine in polvere', kcal: 380, p: 75, c: 8, f: 6, cat: 'Integratori' },
];
