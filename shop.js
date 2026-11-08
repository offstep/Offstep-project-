import { sb, S, routes, handlers, persist, go, render, toast, stepper, hex } from './core.js';
import { esc, fcfa, cartTotals, estimateFee, planActive, strip, brandKey, uniqueBrands, phFill, sortPhotos, photoIndexForColor } from './lib.js';
import { SOCKS_COLORS, SOCKS_LONG_BRANDS, LACES_COLORS } from './config.js';

export async function ensureCatalogue() {
  if (S.catalogue) return S.catalogue;
  const [m, v, p, k] = await Promise.all([
    sb.from('catalogue').select('*').order('name'),
    sb.from('catalogue_variants').select('*'),
    sb.from('catalogue_photos').select('*'),
    sb.from('colors').select('*'),
  ]);
  for (const r of [m, v, p]) if (r.error) throw r.error;
  S.colorHex = Object.fromEntries((k.data || []).map((x) => [strip(x.name), x.hex]));
  S.catalogue = { models: m.data || [], variants: v.data || [], photos: sortPhotos(p.data || []) };
  return S.catalogue;
}
export const colorsOf = (id) => [...new Set(S.catalogue.variants.filter((v) => v.model_id === id).map((v) => v.color))];
const sizesOf = (id, color) => [...new Set(S.catalogue.variants.filter((v) => v.model_id === id && v.color === color).map((v) => v.size))].sort((a, b) => a - b);
const sameColor = (a, b) => strip(a) === strip(b);
export const photosOf = (id) => ((S.catalogue && S.catalogue.photos) || []).filter((p) => p.model_id === id);
const pickPhoto = (id, color) => { const ps = photosOf(id); return (color && ps.find((p) => p.color && sameColor(p.color, color))) || ps[0] || null; };
export const photoOf = (id, color) => (pickPhoto(id, color) || {}).url || '';
const phBox = (p, style = '', alt = '') => `<div class="ph ph-fill" style="${style}">${p ? phFill(p.url, p.thumb_url, { alt }) : 'Photo'}</div>`;

function gridHtml() {
  const q = strip(S.q), bk = brandKey(S.cat);
  const list = S.catalogue.models.filter((m) => (!bk || brandKey(m.category) === bk) && (!q || strip(m.name + ' ' + (m.ref || '') + ' ' + (m.category || '')).includes(q)));
  if (!list.length) return '<div class="glass" style="padding:18px;grid-column:1/-1">Aucun modèle trouvé.</div>';
  return list.map((m) => `<a class="glass card" href="#/produit/${m.model_id}">
    ${phBox(pickPhoto(m.model_id, colorsOf(m.model_id)[0]), 'aspect-ratio:4/5;border-radius:20px', m.name)}
    <div style="font-size:14px;font-weight:600;margin-top:10px">${esc(m.name)}</div>
    ${m.category ? `<div class="mono" style="margin-top:4px">${esc(m.category)}</div>` : ''}
    <div class="row" style="margin-top:6px"><span class="mono" style="font-size:9px;letter-spacing:.8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(colorsOf(m.model_id).map((c) => String(c).replace(/^[\s•·*–—-]+/, '')).slice(0, 3).join(' · '))}</span><b style="font-size:13px">${fcfa(m.price_fcfa)}</b></div></a>`).join('');
}

routes.catalogue = async (brand) => {
  if (brand && S.catArg !== brand) { S.cat = brand; S.catArg = brand; } else if (!brand) S.catArg = null; // #/catalogue/<marque> (depuis l'accueil)
  const c = await ensureCatalogue();
  const cats = uniqueBrands(c.models.map((m) => m.category));
  return `<div class="pad">
    <input class="inp" type="search" aria-label="Rechercher" placeholder="Rechercher un modèle ou une marque…" value="${esc(S.q)}" data-input-act="search">
    <div class="chips" role="group" aria-label="Marques"><button class="chip" aria-pressed="${!brandKey(S.cat)}" data-act="setCat" data-v="">Tous</button>${cats.map((k) => `<button class="chip" aria-pressed="${brandKey(S.cat) === brandKey(k)}" data-act="setCat" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="grid2" id="grid">${gridHtml()}</div></div>`;
};
handlers.search = (el) => { S.q = el.value; document.getElementById('grid').innerHTML = gridHtml(); };
handlers.setCat = (el) => { S.cat = el.dataset.v; render(true); };

routes.produit = async (id) => {
  const c = await ensureCatalogue();
  id = Number(id);
  const m = c.models.find((x) => x.model_id === id);
  if (!m) return '<div class="pad"><div class="glass" style="padding:18px">Modèle introuvable.</div></div>';
  const fresh = !S.sel || S.sel.model !== id;
  if (fresh) S.sel = { model: id, color: colorsOf(id)[0], size: null, qty: 1 };
  const gal = photosOf(id);
  let start = Number(document.documentElement.dataset.galIdx) || 0, go = '';
  if (fresh) start = Math.max(0, photoIndexForColor(gal, S.sel.color));
  if (S.galGo != null) { start = S.galFrom || 0; go = S.galGo; S.galGo = S.galFrom = null; }
  start = Math.min(start, Math.max(0, gal.length - 1));
  const galHtml = gal.length
    ? `<div class="gal-wrap"><div class="gal" data-start="${start}" data-go="${go}">${gal.map((p, i) => `<figure class="slide" data-i="${i}"><div class="ph ph-fill" style="aspect-ratio:4/5">${phFill(p.url, p.thumb_url, { eager: i === start, alt: m.name + ' · photo ' + (i + 1) })}</div></figure>`).join('')}</div>${gal.length > 1 ? `<button class="gal-arrow prev" data-gal="-1" aria-label="Photo précédente">‹</button><button class="gal-arrow next" data-gal="1" aria-label="Photo suivante">›</button><div class="dots" aria-hidden="true">${gal.map(() => '<i></i>').join('')}</div>` : ''}</div>`
    : phBox(null, 'aspect-ratio:4/5;border-radius:28px');
  const sizes = sizesOf(id, S.sel.color);
  if (!sizes.includes(S.sel.size)) S.sel.size = sizes[0] || null;
  return `<div class="pad">
    <a href="#/catalogue" class="back" style="position:static;margin-bottom:8px" aria-label="Retour">‹</a>
    ${galHtml}
    <div class="row" style="align-items:flex-start;margin-top:16px"><div><div style="font-size:24px;font-weight:600;letter-spacing:-.5px">${esc(m.name)}</div><div class="mono" style="margin-top:6px">Réf. ${esc(m.ref || '—')}</div></div><b style="font-size:17px;margin-top:4px">${fcfa(m.price_fcfa)}</b></div>
    ${m.description ? `<p style="color:#3B4150;font-size:14px;line-height:1.5">${esc(m.description)}</p>` : ''}
    ${colorsOf(id).length ? '' : '<div class="glass" style="padding:14px 16px;margin-top:18px;font-size:14px">Les couleurs et pointures de ce modèle ne sont pas encore disponibles.</div>'}
    <div class="mono" style="margin-top:18px">Couleur · ${esc(S.sel.color)}</div>
    <div class="chips" style="flex-wrap:wrap">${colorsOf(id).map((col) => `<button class="chip" aria-pressed="${col === S.sel.color}" data-act="selColor" data-v="${esc(col)}">${esc(col)}</button>`).join('')}</div>
    <div class="mono" style="margin-top:14px">Pointure · ${esc(S.sel.size ?? '—')}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px">${sizes.map((s) => `<button class="chip big" aria-pressed="${s === S.sel.size}" data-act="selSize" data-v="${s}">${s}</button>`).join('')}</div>
    <div class="row" style="margin-top:16px"><span class="mono">Quantité</span>${stepper('selQtyDec', 'selQtyInc', S.sel.qty)}</div>
    </div>
    <div class="bar glass" style="bottom:90px;padding:10px;border-radius:30px;display:flex;align-items:center;gap:14px"><div style="padding-left:12px"><div class="mono">Total</div><b>${fcfa(m.price_fcfa * S.sel.qty)}</b></div><button class="btn" style="flex:1" data-act="addToCart">Ajouter au panier</button></div>`;
};
handlers.selColor = (el) => {
  const from = Number(document.documentElement.dataset.galIdx) || 0;
  S.sel.color = el.dataset.v; S.sel.size = null;
  const i = photoIndexForColor(photosOf(S.sel.model), S.sel.color);
  if (i >= 0) { S.galFrom = from; S.galGo = i; } // pas de photo de cette couleur : la galerie ne bouge pas
  render(true);
};
handlers.selSize = (el) => { S.sel.size = Number(el.dataset.v); render(true); };
handlers.selQtyInc = () => { S.sel.qty = Math.min(99, S.sel.qty + 1); render(true); };
handlers.selQtyDec = () => { S.sel.qty = Math.max(1, S.sel.qty - 1); render(true); };
handlers.addToCart = () => {
  const { model, color, size, qty } = S.sel;
  const v = S.catalogue.variants.find((x) => x.model_id === model && x.color === color && x.size === size);
  if (!v) throw new Error('Choisissez une couleur et une pointure.');
  const m = S.catalogue.models.find((x) => x.model_id === model);
  const ex = S.cart.items.find((i) => i.variantId === v.id);
  if (ex) ex.qty += qty; else S.cart.items.push({ variantId: v.id, modelId: model, name: m.name, color, size, qty, price: m.price_fcfa });
  persist(); toast('Ajouté au panier'); go('/panier');
};

const optQty = (kind, color, sub = '') => ((S.cart[kind].find((x) => x.color === color && (x.sub || '') === sub) || {}).qty) || 0;
const optRow = (kind, color, sub, title) => `<div class="row" style="min-height:56px;border-top:1px solid rgba(10,12,20,.07)"><span style="font-size:14px;font-weight:600">${esc(title)}</span>${stepper('optDec', 'optInc', optQty(kind, color, sub), `data-kind="${kind}" data-color="${esc(color)}" data-sub="${esc(sub)}"`)}</div>`;

export const feeNow = () => estimateFee(S.sub, S.settings, S.credit);

routes.panier = async () => {
  const items = S.cart.items;
  const t = cartTotals(S.cart, S.settings, feeNow());
  if (!items.length) return `<div class="pad"><h1 class="h1" style="margin-top:12px">Votre panier</h1><div class="glass" style="padding:18px;margin-top:16px">Votre panier est vide.</div><a class="btn" style="margin-top:16px;display:flex;align-items:center;justify-content:center" href="#/catalogue">Voir le catalogue</a></div>`;
  const price = (k) => fcfa(S.settings[k]);
  return `<div class="pad"><div class="mono">01 — Panier</div><h1 class="h1" style="margin-top:6px">Votre<br>panier</h1>
    <div class="stack" style="margin-top:16px">${items.map((i, n) => `<div class="glass" style="padding:12px;display:flex;gap:12px;align-items:center">${phBox(pickPhoto(i.modelId, i.color), 'width:64px;height:64px;border-radius:16px;flex:none')}<div style="flex:1"><div style="font-size:15px;font-weight:600">${esc(i.name)}</div><div class="mono" style="margin-top:4px">${esc(i.color)} · ${esc(i.size)}</div><b style="font-size:13px">${fcfa(i.price)}</b></div><div><div class="row" style="justify-content:flex-end">${stepper('cartDec', 'cartInc', i.qty, `data-i="${n}"`)}</div><button class="chip" style="height:32px;margin-top:6px;font-size:12px" data-act="cartDel" data-i="${n}">Retirer</button></div></div>`).join('')}</div>
    <div class="sec">Préparation</div>
    <div class="row" style="gap:10px"><button class="chip big" style="flex:1" aria-pressed="${S.cart.carton}" data-act="setCarton" data-v="1">Avec carton</button><button class="chip big" style="flex:1" aria-pressed="${!S.cart.carton}" data-act="setCarton" data-v="0">Sans carton</button></div>
    <div style="font-size:12px;color:#667085;margin-top:8px">Carton inclus, sans supplément.</div>
    <div class="sec">Chaussettes <span class="mono" style="float:right;margin-top:8px">Facultatif</span></div>
    <div class="glass" style="padding:6px 16px"><div style="padding:10px 0 4px;font-size:15px;font-weight:600">Coupées <span style="color:#667085;font-weight:500;font-size:13px">· ${price('socks_court_price')} la paire</span></div>${SOCKS_COLORS.map((c) => optRow('socks_court', c, '', c)).join('')}</div>
    <div class="glass" style="padding:6px 16px;margin-top:10px"><div style="padding:10px 0 4px;font-size:15px;font-weight:600">Longues <span style="color:#667085;font-weight:500;font-size:13px">· ${price('socks_long_price')} la paire</span></div>${SOCKS_LONG_BRANDS.flatMap((b) => SOCKS_COLORS.map((c) => optRow('socks_long', c, b, b + ' · ' + c))).join('')}</div>
    <div class="sec">Lacets <span class="mono" style="float:right;margin-top:8px">Facultatif</span></div>
    <div class="glass" style="padding:6px 16px"><div style="padding:10px 0 4px;font-size:15px;font-weight:600">Lacets supplémentaires <span style="color:#667085;font-weight:500;font-size:13px">· ${price('laces_price')} par lacet</span></div>${LACES_COLORS.map((c) => optRow('laces', c, '', c)).join('')}</div>
    <div class="glass" style="padding:6px 18px 16px;margin-top:24px"><div class="kv"><span>Chaussures</span><b>${fcfa(t.shoes)}</b></div><div class="kv"><span>Chaussettes</span><b>${fcfa(t.socks)}</b></div><div class="kv"><span>Lacets</span><b>${fcfa(t.laces)}</b></div>${t.fee ? `<div class="kv"><span>Frais de service</span><b>${fcfa(t.fee)}</b></div>` : ''}<div class="row" style="border-top:1px solid rgba(10,12,20,.12);padding-top:14px"><span style="font-size:20px;font-weight:600">Total</span><b style="font-size:18px">${fcfa(t.total)}</b></div></div>
    </div><div class="bar" style="bottom:90px"><button class="btn" data-act="toCheckout">Continuer</button></div>`;
};
handlers.cartInc = (el) => { S.cart.items[Number(el.dataset.i)].qty += 1; persist(); render(true); };
handlers.cartDec = (el) => { const i = S.cart.items[Number(el.dataset.i)]; i.qty = Math.max(1, i.qty - 1); persist(); render(true); };
handlers.cartDel = (el) => { S.cart.items.splice(Number(el.dataset.i), 1); persist(); render(true); };
handlers.setCarton = (el) => { S.cart.carton = el.dataset.v === '1'; persist(); render(true); };
function bumpOpt(el, d) {
  const { kind, color, sub = '' } = el.dataset;
  let o = S.cart[kind].find((x) => x.color === color && (x.sub || '') === sub);
  if (!o) { o = { color, sub, qty: 0 }; S.cart[kind].push(o); }
  o.qty = Math.max(0, o.qty + d);
  if (o.qty === 0) S.cart[kind] = S.cart[kind].filter((x) => x !== o);
  persist(); render(true);
}
handlers.optInc = (el) => bumpOpt(el, 1);
handlers.optDec = (el) => bumpOpt(el, -1);
handlers.toCheckout = () => {
  if (!S.cart.items.length) throw new Error('Panier vide');
  if (!planActive(S.sub)) { toast('Choisissez d’abord votre formule.'); go('/formule'); return; }
  go('/livraison');
};
