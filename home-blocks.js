// Lot D · Rendu partagé des blocs d'accueil (revendeur + aperçu admin). Fonctions pures : aucun accès réseau.
import { esc, fcfa, phFill, sortPhotos, uniqueBrands } from './lib.js';

export const KINDS = {
  diaporama: ['Diaporama', 'Images pleine largeur qui défilent seules, avec titre et bouton.'],
  image_produits: ['Image + produits', 'Une grande image avec un titre, suivie d’une rangée de modèles.'],
  produits: ['Produits', 'Une rangée de modèles que vous choisissez.'],
  nouveautes: ['Nouveautés', 'Les derniers modèles publiés, calculés tout seuls.'],
  marques: ['Marques', 'Des puces qui ouvrent le catalogue sur une marque.'],
  bandeau: ['Bandeau', 'Une annonce courte, avec un lien facultatif.'],
  grille_images: ['Grille d’images', '2 à 4 images carrées avec légende et lien.'],
};
export const KIND_ORDER = Object.keys(KINDS);
export const FALLBACK = [
  { id: -1, kind: 'nouveautes', title: 'Nouveautés', payload: { count: 8 } },
  { id: -2, kind: 'marques', title: 'Marques', payload: {} },
];

// ── Liens : seuls modèle, marque, catalogue, photos, https:// et #/ sont acceptés
export function targetHref(t) {
  if (!t || typeof t !== 'object') return null;
  const v = String(t.value == null ? '' : t.value).trim();
  switch (t.type) {
    case 'modele': { const n = Number(v); return Number.isInteger(n) && n > 0 ? `#/produit/${n}` : null; }
    case 'marque': return v && v.length <= 60 ? `#/catalogue/${encodeURIComponent(v)}` : null;
    case 'catalogue': return '#/catalogue';
    case 'photos': return '#/photos';
    case 'lien': return /^(https:\/\/[^\s"'<>]+|#\/[^\s"'<>]*)$/i.test(v) ? v : null;
    default: return null;
  }
}
export const safeImg = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
const targetOk = (t) => !t || !t.type || targetHref(t) !== null;
const ids = (a) => Array.isArray(a) && a.every((x) => Number.isInteger(Number(x)) && Number(x) > 0);

// Même règles que le serveur ; renvoie un message, ou '' si tout est bon
export function validateBlock(b) {
  const p = (b && b.payload) || {}, k = b && b.kind;
  if (!KINDS[k]) return 'Type de bloc inconnu.';
  if (String(b.title || '').length > 80) return 'Titre trop long (80 caractères).';
  if (b.starts_at && b.ends_at && new Date(b.ends_at) < new Date(b.starts_at)) return 'La fin est avant le début.';
  const imgs = (list, min, max, nom) => {
    if (!Array.isArray(list) || list.length < min || list.length > max) return `${nom} : de ${min} à ${max}.`;
    for (const x of list) { if (!safeImg(x.image)) return 'Chaque image doit être envoyée (https://).'; if (!targetOk(x.target)) return 'Lien non valide.'; }
    return '';
  };
  const models = () => (!ids(p.models) || p.models.length < 2 || p.models.length > 12 ? 'Choisissez de 2 à 12 modèles.' : '');
  if (k === 'diaporama') return imgs(p.slides, 1, 8, 'Diapos');
  if (k === 'grille_images') return imgs(p.tiles, 2, 4, 'Images');
  if (k === 'image_produits') return (!safeImg(p.image) && 'La grande image est obligatoire.') || (!targetOk(p.target) && 'Lien non valide.') || models();
  if (k === 'produits') return (!targetOk(p.target) && 'Lien non valide.') || models();
  if (k === 'nouveautes') { const n = Number(p.count); return Number.isInteger(n) && n >= 4 && n <= 12 ? '' : 'Le nombre doit être entre 4 et 12.'; }
  if (k === 'marques') return p.brands == null || (Array.isArray(p.brands) && p.brands.length <= 20) ? '' : 'Trop de marques (20 au plus).';
  if (k === 'bandeau') return !String(p.text || '').trim() || String(p.text).length > 140 ? 'Le texte du bandeau fait de 1 à 140 caractères.' : (!targetOk(p.target) && 'Lien non valide.') || (p.color && !/^#[0-9a-f]{6}$/i.test(p.color) ? 'Couleur non valide.' : '');
  return '';
}

// ── Contexte : modèles publiés + photos (aucune donnée de stock)
export function makeCtx({ models = [], photos = [] }) {
  const byId = new Map(models.map((m) => [m.model_id, m]));
  const pm = new Map();
  for (const p of sortPhotos(photos)) { const l = pm.get(p.model_id) || []; l.push(p); pm.set(p.model_id, l); }
  return { models, byId, brands: uniqueBrands(models.map((m) => m.category)), pick: (id) => (pm.get(id) || [])[0] || null };
}

const ph = (p, alt) => (p ? phFill(p.url, p.thumb_url, { alt }) : 'Photo');
const card = (m, ctx) => `<a class="glass card hcard" href="#/produit/${m.model_id}"><div class="ph ph-fill" style="aspect-ratio:4/5;border-radius:18px">${ph(ctx.pick(m.model_id), m.name)}</div><b class="hn">${esc(m.name)}</b>${m.category ? `<span class="mono">${esc(m.category)}</span>` : ''}<div class="hpx">${fcfa(m.price_fcfa)}</div></a>`;
const row = (ms, ctx) => (ms.length ? `<div class="hrow">${ms.map((m) => card(m, ctx)).join('')}</div>` : '');
const sec = (t, href) => (t || href ? `<div class="hsec"><h2>${esc(t || '')}</h2>${href ? `<a href="${esc(href)}">Voir tout →</a>` : ''}</div>` : '');
const wrap = (k, inner) => (inner ? `<section class="hb hb-${k}">${inner}</section>` : '');
const bigImg = (url, alt, first) => { const h = phFill(url, url, { eager: first, alt }); return first ? h.replace('<img class="pf-fg"', '<img fetchpriority="high" class="pf-fg"') : h; };
const anchor = (href, cls, inner) => (href ? `<a class="${cls}" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`);

export function renderBlock(b, ctx) {
  const p = (b && b.payload) || {}, t = b && b.title;
  switch (b && b.kind) {
    case 'diaporama': {
      const sl = (Array.isArray(p.slides) ? p.slides : []).filter((s) => safeImg(s.image)).slice(0, 8);
      if (!sl.length) return '';
      const slides = sl.map((s, i) => {
        const href = targetHref(s.target);
        return anchor(href, 'hs-slide', `<div class="ph ph-fill hs-ph">${bigImg(safeImg(s.image), s.title || '', i === 0)}</div><div class="hs-shade"></div><div class="hs-txt">${s.title ? `<div class="hs-t">${esc(s.title)}</div>` : ''}${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}${href ? `<span class="hs-btn">${esc(s.cta || 'Explorer')}</span>` : ''}</div>`);
      }).join('');
      const dots = sl.length > 1 ? `<div class="hs-dots">${sl.map((_, i) => `<button type="button" class="hs-dot${i ? '' : ' on'}" data-slide="${i}" aria-label="Diapo ${i + 1}"></button>`).join('')}</div>` : '';
      return wrap('diaporama', `<div class="hs" role="region" aria-roledescription="carousel" aria-label="${esc(t || 'Diaporama')}"><div class="hs-track">${slides}</div>${dots}</div>`);
    }
    case 'image_produits': {
      const ms = (p.models || []).map((id) => ctx.byId.get(Number(id))).filter(Boolean);
      const img = safeImg(p.image);
      const big = img ? anchor(targetHref(p.target), 'hb-big', `<div class="ph ph-fill hb-bigph">${bigImg(img, t || '', false)}</div><div class="hs-shade"></div><div class="hs-txt">${t ? `<div class="hs-t">${esc(t)}</div>` : ''}${p.subtitle ? `<p>${esc(p.subtitle)}</p>` : ''}</div>`) : '';
      return wrap('image_produits', big + row(ms, ctx));
    }
    case 'produits': {
      const ms = (p.models || []).map((id) => ctx.byId.get(Number(id))).filter(Boolean);
      return ms.length ? wrap('produits', sec(t, targetHref(p.target) || '#/catalogue') + row(ms, ctx)) : '';
    }
    case 'nouveautes': {
      const n = Math.max(4, Math.min(12, Number(p.count) || 8));
      const ms = ctx.models.slice().sort((a, c) => c.model_id - a.model_id).slice(0, n);
      return ms.length ? wrap('nouveautes', sec(t, '#/catalogue') + row(ms, ctx)) : '';
    }
    case 'marques': {
      const list = Array.isArray(p.brands) && p.brands.length ? uniqueBrands(p.brands) : ctx.brands;
      return list.length ? wrap('marques', sec(t) + `<div class="hrow hchips">${list.map((x) => `<a class="hchip" href="#/catalogue/${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>`) : '';
    }
    case 'bandeau': {
      if (!String(p.text || '').trim()) return '';
      const col = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#7CC4FF';
      return wrap('bandeau', anchor(targetHref(p.target), 'hb-band', esc(p.text)).replace('class="hb-band"', `class="hb-band" style="--acc:${col}"`));
    }
    case 'grille_images': {
      const ts = (Array.isArray(p.tiles) ? p.tiles : []).filter((x) => safeImg(x.image)).slice(0, 4);
      if (ts.length < 2) return '';
      return wrap('grille_images', (t ? sec(t) : '') + `<div class="hgrid">${ts.map((x) => anchor(targetHref(x.target), 'hb-tile', `<div class="ph ph-fill" style="aspect-ratio:1/1;border-radius:22px">${bigImg(safeImg(x.image), x.caption || '', false)}</div>${x.caption ? `<div class="mono hcap">${esc(x.caption)}</div>` : ''}`)).join('')}</div>`);
    }
    default: return '';
  }
}

export const skeleton = () => '<div class="pad home"><div class="sk" style="height:320px;border-radius:28px"></div><div class="sk" style="height:44px;border-radius:22px;margin-top:14px"></div><div class="hrow" style="margin-top:22px"><div class="sk" style="flex:0 0 160px;height:230px;border-radius:24px"></div><div class="sk" style="flex:0 0 160px;height:230px;border-radius:24px"></div></div></div>';
