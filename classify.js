// OFFSTEP · classement automatique des modèles d'après leur NOM : « Nike TN » → marque Nike, catégorie TN.
// Fonctions pures (aucun accès réseau). Le dictionnaire LINES se complète facilement : [expression, marque, nom de la catégorie].
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const BRAND_ALIASES = { nike: 'Nike', adidas: 'Adidas', jordan: 'Jordan', 'air jordan': 'Jordan', 'new balance': 'New Balance', nb: 'New Balance', puma: 'Puma', reebok: 'Reebok', converse: 'Converse', vans: 'Vans', asics: 'Asics' };
export const LINES = [
  // Nike
  [/\b(tn|tuned|air max plus|max plus)\b/, 'Nike', 'TN'], [/\b(air force( ?1)?|af ?1)\b/, 'Nike', 'Air Force 1'], [/\bdunk\b/, 'Nike', 'Dunk'], [/\bvapor ?max\b/, 'Nike', 'Vapormax'],
  [/\bair max\b/, 'Nike', 'Air Max'], [/\bblazer\b/, 'Nike', 'Blazer'], [/\bcortez\b/, 'Nike', 'Cortez'], [/\bpegasus\b/, 'Nike', 'Pegasus'], [/\bhuarache\b/, 'Nike', 'Huarache'],
  [/\bshox\b/, 'Nike', 'Shox'], [/\bvomero\b/, 'Nike', 'Vomero'], [/\bja ?\d+\b/, 'Nike', 'Ja'], [/\bp ?6000\b/, 'Nike', 'P-6000'],
  // Jordan : une catégorie par numéro
  [/\b(?:air )?jordan ?(\d{1,2})\b|\baj ?(\d{1,2})\b/, 'Jordan', (m) => `Air Jordan ${m[1] || m[2]}`],
  // Adidas
  [/\bcampus\b/, 'Adidas', 'Campus'], [/\bsamba\b/, 'Adidas', 'Samba'], [/\bgazelle\b/, 'Adidas', 'Gazelle'], [/\bsuperstar\b/, 'Adidas', 'Superstar'], [/\bstan smith\b/, 'Adidas', 'Stan Smith'],
  [/\bspezial\b/, 'Adidas', 'Spezial'], [/\bforum\b/, 'Adidas', 'Forum'], [/\byeezy\b/, 'Adidas', 'Yeezy'], [/\bozweego\b/, 'Adidas', 'Ozweego'],
  // New Balance : une catégorie par numéro de modèle
  [/\b(\d{3,4}[a-z]?)\b/, 'New Balance', (m) => m[1].toUpperCase(), 'New Balance'],
  // Autres
  [/\bspeedcat\b/, 'Puma', 'Speedcat'], [/\bpalermo\b/, 'Puma', 'Palermo'], [/\bsuede\b/, 'Puma', 'Suede'], [/\bgel\b/, 'Asics', 'Gel'],
  [/\bold skool\b/, 'Vans', 'Old Skool'], [/\bsk8\b/, 'Vans', 'Sk8'], [/\b(chuck taylor|all star)\b/, 'Converse', 'Chuck Taylor'], [/\bclub c\b/, 'Reebok', 'Club C'],
];
const title = (w) => (/^[a-z]{1,2}$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

// → { brand, line } (line peut être '' = marque seule) ou null si le nom n'est pas reconnu
export function classifyModel(name, opts = {}) {
  const n = norm(name);
  if (!n) return null;
  const spelling = new Map(Object.entries(BRAND_ALIASES).map(([k, v]) => [norm(v), v]));
  for (const b of opts.brands || []) { const k = norm(b); if (k) spelling.set(k, b); }
  const aliases = [...Object.keys(BRAND_ALIASES), ...[...spelling.keys()]].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => b.length - a.length);
  const canon = (k) => spelling.get(norm(BRAND_ALIASES[k] || k)) || BRAND_ALIASES[k] || null;
  let brand = null, found = null;
  if (opts.brand && norm(opts.brand)) { brand = spelling.get(norm(opts.brand)) || String(opts.brand).trim(); found = norm(opts.brand); }
  else for (const a of aliases) if ((` ${n} `).includes(` ${a} `)) { brand = canon(a) || spelling.get(a) || null; found = a; break; }
  let line = '';
  for (const [re, lb, label, only] of LINES) {
    const m = n.match(re);
    if (!m) continue;
    if (only && !(brand && norm(brand) === norm(only))) continue;           // ex. numéros New Balance : seulement si la marque est New Balance
    if (brand && norm(brand) !== norm(lb)) continue;                           // marque connue différente : on ignore cette ligne
    brand = brand || spelling.get(norm(lb)) || lb;
    line = typeof label === 'function' ? label(m) : label;
    break;
  }
  if (!brand) return null;
  if (!line) {                                                                  // pas dans le dictionnaire : le reste du nom devient la catégorie
    const rest = ` ${n} `.replace(` ${found || norm(brand)} `, ' ').replace(/ (air jordan|jordan) /, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    line = rest.map(title).join(' ');
  }
  return { brand, line };
}

// Prépare les modèles à classer : seulement ce qui manque (marque et/ou catégorie), sauf avec force
export function classifyBatch(models, brands = [], force = false) {
  const items = [], unknown = [];
  for (const m of models || []) {
    const hasBrand = !!String(m.category || '').trim(), hasCat = !!m.category_id;
    if (!force && hasBrand && hasCat) continue;
    const r = classifyModel(m.name, { brands, brand: force ? '' : (hasBrand ? m.category : '') });
    if (!r) { if (!hasBrand) unknown.push(m); continue; }
    if (force || (!hasBrand && r.brand) || (!hasCat && r.line)) items.push({ model_id: m.id, brand: r.brand, line: r.line });
  }
  return { items, unknown };
}
