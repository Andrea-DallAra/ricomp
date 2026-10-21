import { db } from '../db';
import type { Food } from '../data/foods';

const n = (x: any) => (x == null || isNaN(+x) ? 0 : Math.round(+x * 10) / 10);

function toFood(p: any, code?: string): Food | null {
  const nu = p?.nutriments || {};
  const kcal = nu['energy-kcal_100g'] ?? (nu['energy_100g'] ? nu['energy_100g'] / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const serving = parseFloat(p.serving_quantity);
  return {
    id: `bc_${code || p.code}`, name: p.product_name, brand: p.brands?.split(',')[0]?.trim(), barcode: code || p.code,
    kcal: Math.round(kcal), p: n(nu.proteins_100g), c: n(nu.carbohydrates_100g), f: n(nu.fat_100g),
    cat: 'Snack e altro', custom: true, ...(serving > 0 && serving < 1000 ? { piece: serving, pieceName: 'porzione' } : {}),
  };
}

export async function lookupBarcode(code: string): Promise<Food | null> {
  const local = await db.foods.where('barcode').equals(code).first();
  if (local) return local;
  if (!navigator.onLine) throw new Error('Sei offline: per un prodotto nuovo serve internet');
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,serving_quantity`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return toFood(data.product, code);
}

export async function searchOnline(q: string): Promise<Food[]> {
  if (!navigator.onLine) throw new Error('Sei offline');
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,nutriments,serving_quantity`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Ricerca non disponibile');
  const data = await res.json();
  return (data.products || []).map((p: any) => toFood(p)).filter(Boolean) as Food[];
}
