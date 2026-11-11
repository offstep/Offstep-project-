// Lot D · Éditeur « Vitrine » : composer l'accueil des revendeurs (#/vitrine). Droit « produits » requis pour modifier.
import { sb, S, routes, handlers, go, render, toast, once } from './core.js';
import { esc, strip, uniqueBrands, phFill } from './lib.js';
import { KINDS, KIND_ORDER, ANIMS, renderBlock, makeCtx, validateBlock } from './home-blocks.js';
import './home-anim.js'; // l'aperçu s'anime comme chez les revendeurs
import { shrink } from './img-shrink.js';

const must = (r) => { if (r.error) throw r.error; return r.data; };
const back = (to) => `<a href="#/${to}" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>`;
const canProduits = () => { const p = S.profile; return !p || p.role === 'admin' || !!(p.rights && (p.rights.produits === true || (Array.isArray(p.rights) && p.rights.includes('produits')))); };
const ICON = {
  diaporama: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/>', image_produits: '<rect x="3" y="3" width="18" height="10" rx="2"/><path d="M3 17h5M11 17h5M3 20h5M11 20h5"/>',
  produits: '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>', nouveautes: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  marques: '<path d="M4 8h16M4 12h16M4 16h10"/>', bandeau: '<rect x="3" y="9" width="18" height="6" rx="3"/>', grille_images: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
};
const ico = (k) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${ICON[k] || ''}</svg>`;
const getIn = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setIn = (o, path, v) => { const ks = path.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]]; a[ks[ks.length - 1]] = v; };
const tgt0 = () => ({ type: '', value: '' });
const slide0 = () => ({ image: '', title: '', subtitle: '', cta: 'Explorer', target: tgt0() });
const tile0 = () => ({ image: '', caption: '', target: tgt0() });
const pad2 = (n) => String(n).padStart(2, '0');
const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const stat0 = () => ({ value: '', suffix: '', label: '' });
const blank = (kind) => ({ kind, title: KINDS[kind][0], active: true, startsL: '', endsL: '', payload: { anim: '', ...{
  diaporama: { slides: [slide0()] }, image_produits: { image: '', subtitle: '', target: tgt0(), models: [] }, produits: { target: tgt0(), models: [] },
  nouveautes: { count: 8 }, marques: { brands: [] }, bandeau: { text: '', color: '#7CC4FF', target: tgt0() }, grille_images: { tiles: [tile0(), tile0()] },
  defilement: { items: [''], speed: 'normal', target: tgt0() }, compte_rebours: { ends_local: '', ends_at: '', text_after: '', target: tgt0() },
  coverflow: { target: tgt0(), models: [] }, compteurs: { stats: [stat0(), stat0()] }, parallaxe: { image: '', subtitle: '', target: tgt0() } }[kind] } });
const fix = (b) => {
  const p = b.payload = b.payload || {}, T = (t) => ({ ...tgt0(), ...(t || {}) });
  p.anim = p.anim || '';
  if (b.kind === 'diaporama') p.slides = (p.slides || []).map((s) => ({ ...slide0(), ...s, target: T(s.target) }));
  if (b.kind === 'grille_images') p.tiles = (p.tiles || []).map((s) => ({ ...tile0(), ...s, target: T(s.target) }));
  if (['image_produits', 'produits', 'bandeau', 'coverflow', 'defilement', 'compte_rebours', 'parallaxe'].includes(b.kind)) p.target = T(p.target);
  if (['image_produits', 'produits', 'coverflow'].includes(b.kind)) p.models = (p.models || []).map(Number);
  if (b.kind === 'marques') p.brands = p.brands || [];
  if (b.kind === 'defilement') { p.items = Array.isArray(p.items) && p.items.length ? p.items : ['']; p.speed = p.speed || 'normal'; }
  if (b.kind === 'compte_rebours') { p.ends_local = toLocal(p.ends_at); p.text_after = p.text_after || ''; }
  if (b.kind === 'compteurs') p.stats = (p.stats || []).map((x) => ({ ...stat0(), ...x }));
  return b;
};
const syncDerived = () => { const b = S.vb; if (b && b.kind === 'compte_rebours') b.payload.ends_at = b.payload.ends_local ? new Date(b.payload.ends_local).toISOString() : ''; };

// ───────── Liste, ajout
async function list() {
  const rows = must(await sb.from('home_blocks').select('*').order('position'));
  const rw = canProduits();
  const when = (r) => (r.starts_at || r.ends_at ? ` · ${r.starts_at ? 'du ' + new Date(r.starts_at).toLocaleDateString('fr-FR') : ''}${r.ends_at ? ' au ' + new Date(r.ends_at).toLocaleDateString('fr-FR') : ''}` : '');
  return `<div class="pad">${back('plus')}<h1 class="h1" style="font-size:32px;margin-top:8px">Vitrine</h1><div class="mono" style="margin-top:10px">Accueil des revendeurs</div>
    ${rw ? '' : '<div class="glass" style="padding:14px 16px;margin-top:14px;font-size:14px">Lecture seule : le droit « Produits » est nécessaire pour modifier.</div>'}
    ${rows.map((r, i) => `<div class="glass" style="padding:12px 14px;margin-top:10px"><div class="row" style="gap:10px"><span style="display:flex;align-items:center;gap:12px;min-width:0">${ico(r.kind)}<span style="min-width:0"><b style="display:block;font-size:15px">${esc(r.title || KINDS[r.kind][0])}</b><span class="mono">${esc(KINDS[r.kind][0])}${esc(when(r))}</span></span></span><span class="tag ${r.active ? 'dark' : ''}">${r.active ? 'Actif' : 'Inactif'}</span></div>
      ${rw ? `<div class="row" style="margin-top:10px"><span style="display:flex;gap:8px"><button class="sb" style="width:44px;height:44px" aria-label="Monter" data-act="vbMove" data-v="${r.id}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="sb" style="width:44px;height:44px" aria-label="Descendre" data-act="vbMove" data-v="${r.id}" data-d="1" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button></span><span style="display:flex;gap:8px"><a class="chip" style="display:flex;align-items:center" href="#/vitrine/modifier/${r.id}">Modifier</a><button class="chip" data-act="vbDel" data-v="${r.id}">Supprimer</button></span></div>` : ''}</div>`).join('') || '<div class="glass" style="padding:18px;margin-top:14px">Aucun bloc : les revendeurs voient l’accueil de secours.</div>'}
    ${rw ? '<div class="bar" style="bottom:90px"><a class="btn" style="display:flex;align-items:center;justify-content:center" href="#/vitrine/ajouter">Ajouter un bloc</a></div>' : ''}</div>`;
}
function picker() {
  return `<div class="pad">${back('vitrine')}<h1 class="h1" style="font-size:32px;margin-top:8px">Ajouter un bloc</h1><div class="mono" style="margin-top:10px">Choisissez un type</div>
    ${KIND_ORDER.map((k) => `<a class="glass" style="display:block;padding:16px;margin-top:10px" href="#/vitrine/nouveau/${k}"><div style="display:flex;gap:14px;align-items:center">${ico(k)}<span><b style="font-size:16px">${esc(KINDS[k][0])}</b><div style="font-size:13px;color:#667085;margin-top:3px;line-height:1.4">${esc(KINDS[k][1])}</div></span></div></a>`).join('')}</div>`;
}

// ───────── Éditeur
async function editor() {
  const b = S.vb;
  if (!canProduits()) return `<div class="pad">${back('vitrine')}<div class="glass" style="padding:18px;margin-top:12px">Le droit « Produits » est nécessaire pour modifier la vitrine.</div></div>`;
  const [ms, ph] = await Promise.all([sb.from('models').select('id,name,category,price_fcfa,published').order('id', { ascending: false }).then(must), sb.from('model_photos').select('*').then(must)]);
  S.vbModels = ms;
  S.vbCtx = makeCtx({ models: ms.filter((m) => m.published).map((m) => ({ model_id: m.id, name: m.name, category: m.category, price_fcfa: m.price_fcfa })), photos: ph });
  const brands = uniqueBrands(ms.map((m) => m.category));
  const F = (path, label, extra = '') => `<label class="mono" for="f_${path}">${label}</label><input class="inp" id="f_${path}" value="${esc(getIn(b, path) ?? '')}" data-bind="vb.${path}" data-input-act="vbPreview" ${extra}>`;
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  const T = (base) => {
    const t = getIn(b, base);
    const val = t.type === 'modele' ? `<select class="inp" aria-label="Modèle ciblé" data-bind="vb.${base}.value" data-change-act="vbPreview">${opt('', 'Choisir un modèle…', t.value)}${ms.map((m) => opt(m.id, m.name, t.value)).join('')}</select>`
      : t.type === 'marque' ? `<select class="inp" aria-label="Marque ciblée" data-bind="vb.${base}.value" data-change-act="vbPreview">${opt('', 'Choisir une marque…', t.value)}${brands.map((x) => opt(x, x, t.value)).join('')}</select>`
      : t.type === 'lien' ? `<input class="inp" inputmode="url" aria-label="Adresse du lien" placeholder="https://… ou #/…" value="${esc(t.value)}" data-bind="vb.${base}.value" data-input-act="vbPreview">` : '';
    return `<label class="mono">Lien</label><select class="inp" data-bind="vb.${base}.type" data-change-act="vbRerender">${[['', 'Aucun lien'], ['modele', 'Un modèle'], ['marque', 'Une marque'], ['catalogue', 'Le catalogue'], ['photos', 'La demande de photos'], ['lien', 'Un lien (https://)']].map(([v, l]) => opt(v, l, t.type)).join('')}</select>${val}`;
  };
  const IMG = (path) => { const u = getIn(b, path); return `<div class="row" style="gap:10px;margin-top:10px;justify-content:flex-start">${u ? `<div class="ph ph-fill vthumb">${phFill(u, u, { eager: true })}</div>` : '<div class="ph vthumb">Image</div>'}<label class="chip" style="cursor:pointer;display:flex;align-items:center" for="up_${path}">${u ? 'Remplacer l’image' : 'Choisir une image'}</label></div><input id="up_${path}" type="file" accept="image/*" style="position:absolute;opacity:0;width:1px;height:1px" data-change-act="vbUpload" data-path="${path}">`; };
  const PICK = (path) => {
    const sel = getIn(b, path);
    return `<div class="mono" style="margin-top:16px">Modèles choisis : <span id="vbCount">${sel.length}</span> sur 12 (2 au moins)</div><div id="vbOrder" style="font-size:13px;margin-top:6px">${esc(sel.map((id) => (ms.find((m) => m.id === id) || {}).name).filter(Boolean).join(' · '))}</div>
      <input class="inp" type="search" placeholder="Rechercher un modèle…" aria-label="Rechercher un modèle" data-input-act="vbSearch" style="margin-top:8px"><div class="glass" style="padding:4px 14px;margin-top:8px;max-height:320px;overflow:auto">${ms.map((m) => `<label class="pk ${m.published ? '' : 'off'}" data-n="${esc(strip(m.name + ' ' + (m.category || '')))}"><input type="checkbox" data-change-act="vbModel" data-path="${path}" data-v="${m.id}" ${sel.includes(m.id) ? 'checked' : ''} ${m.published || sel.includes(m.id) ? '' : 'disabled'}><span style="flex:1">${esc(m.name)}</span>${m.published ? '' : '<span class="tag">Non publié</span>'}</label>`).join('')}</div>`;
  };
  const p = b.payload, add = (list, max, label) => (p[list].length < max ? `<button class="btn2" style="margin-top:12px;width:100%" data-act="vbAdd" data-list="${list}">${label}</button>` : '');
  const rm = (list, i, min) => (p[list].length > min ? `<button class="chip" data-act="vbRemove" data-list="${list}" data-i="${i}">Retirer</button>` : '');
  const body = {
    diaporama: () => p.slides.map((s, i) => `<div class="glass" style="padding:14px;margin-top:12px"><div class="row"><b>Diapo ${i + 1}</b>${rm('slides', i, 1)}</div>${IMG(`payload.slides.${i}.image`)}${F(`payload.slides.${i}.title`, 'Titre')}${F(`payload.slides.${i}.subtitle`, 'Sous-titre')}${F(`payload.slides.${i}.cta`, 'Texte du bouton')}${T(`payload.slides.${i}.target`)}</div>`).join('') + add('slides', 8, 'Ajouter une diapo'),
    image_produits: () => `${IMG('payload.image')}${F('payload.subtitle', 'Sous-titre')}${T('payload.target')}${PICK('payload.models')}`,
    produits: () => `${T('payload.target')}<div class="mono" style="margin-top:6px;text-transform:none;letter-spacing:0">Le lien sert au bouton « Voir tout ».</div>${PICK('payload.models')}`,
    nouveautes: () => F('payload.count', 'Nombre de modèles (4 à 12)', 'type="number" inputmode="numeric" min="4" max="12"'),
    marques: () => `<div class="mono" style="margin-top:14px">Marques affichées (aucune = toutes)</div><div class="glass" style="padding:4px 14px;margin-top:8px">${brands.map((x) => `<label class="pk"><input type="checkbox" data-change-act="vbBrand" data-v="${esc(x)}" ${p.brands.includes(x) ? 'checked' : ''}><span style="flex:1">${esc(x)}</span></label>`).join('') || '<div class="pk">Aucune marque pour le moment.</div>'}</div>`,
    bandeau: () => `${F('payload.text', 'Texte (140 caractères au plus)', 'maxlength="140"')}<label class="mono" for="f_color">Couleur d’accentuation</label><input class="inp" id="f_color" type="color" value="${esc(p.color || '#7CC4FF')}" style="padding:4px" data-bind="vb.payload.color" data-input-act="vbPreview">${T('payload.target')}`,
    grille_images: () => p.tiles.map((s, i) => `<div class="glass" style="padding:14px;margin-top:12px"><div class="row"><b>Image ${i + 1}</b>${rm('tiles', i, 2)}</div>${IMG(`payload.tiles.${i}.image`)}${F(`payload.tiles.${i}.caption`, 'Légende')}${T(`payload.tiles.${i}.target`)}</div>`).join('') + add('tiles', 4, 'Ajouter une image'),
    defilement: () => p.items.map((_, i) => `<div class="row" style="gap:8px;align-items:flex-end"><div style="flex:1;min-width:0">${F(`payload.items.${i}`, `Texte ${i + 1}`, 'maxlength="60"')}</div>${p.items.length > 1 ? `<button class="chip" data-act="vbRemove" data-list="items" data-i="${i}">Retirer</button>` : ''}</div>`).join('') + add('items', 8, 'Ajouter un texte')
      + `<label class="mono" for="f_speed">Vitesse</label><select class="inp" id="f_speed" data-bind="vb.payload.speed" data-change-act="vbPreview">${[['lent', 'Lente'], ['normal', 'Normale'], ['rapide', 'Rapide']].map(([v, l]) => opt(v, l, p.speed)).join('')}</select>${T('payload.target')}`,
    compte_rebours: () => `<label class="mono" for="f_ends">Date et heure de fin</label><input class="inp" id="f_ends" type="datetime-local" value="${esc(p.ends_local)}" data-bind="vb.payload.ends_local" data-change-act="vbPreview">${F('payload.text_after', 'Message à la fin (facultatif, sinon le bloc disparaît)', 'maxlength="140"')}${T('payload.target')}`,
    coverflow: () => `${T('payload.target')}<div class="mono" style="margin-top:6px;text-transform:none;letter-spacing:0">Le lien sert au bouton « Voir tout ».</div>${PICK('payload.models')}`,
    compteurs: () => p.stats.map((x, i) => `<div class="glass" style="padding:14px;margin-top:12px"><div class="row"><b>Compteur ${i + 1}</b>${rm('stats', i, 2)}</div>${F(`payload.stats.${i}.value`, 'Nombre', 'type="number" inputmode="numeric" min="0"')}${F(`payload.stats.${i}.suffix`, 'Après le nombre (ex. +)', 'maxlength="6"')}${F(`payload.stats.${i}.label`, 'Texte (ex. modèles en stock)', 'maxlength="40"')}</div>`).join('') + add('stats', 4, 'Ajouter un compteur'),
    parallaxe: () => `${IMG('payload.image')}${F('payload.subtitle', 'Sous-titre')}${T('payload.target')}`,
  }[b.kind]();
  return `<div class="pad">${back('vitrine')}<div class="mono">${esc(KINDS[b.kind][0])}</div><h1 class="h1" style="font-size:30px;margin-top:6px">${b.id ? 'Modifier le bloc' : 'Nouveau bloc'}</h1>
    ${F('title', 'Titre du bloc', 'maxlength="80"')}
    <div class="glass" style="margin-top:14px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;min-height:64px"><div><div class="t1">Actif</div><div class="t2">Visible par les revendeurs</div></div><button class="chip" aria-pressed="${b.active}" data-act="vbActive">${b.active ? 'Oui' : 'Non'}</button></div>
    <label class="mono" for="f_anim">Animation d’apparition</label><select class="inp" id="f_anim" data-bind="vb.payload.anim" data-change-act="vbPreview">${ANIMS.map(([v, l]) => opt(v, l, p.anim || '')).join('')}</select>
    ${body}
    <div class="sec">Programmation (facultative)</div>
    <label class="mono" for="f_startsL">Début</label><input class="inp" id="f_startsL" type="datetime-local" value="${esc(b.startsL)}" data-bind="vb.startsL">
    <label class="mono" for="f_endsL">Fin</label><input class="inp" id="f_endsL" type="datetime-local" value="${esc(b.endsL)}" data-bind="vb.endsL">
    <div class="sec">Aperçu</div><div id="vbPrev" class="home" style="margin-top:8px">${renderBlock(b, S.vbCtx) || '<div class="glass" style="padding:16px;font-size:14px">L’aperçu apparaît quand le bloc est complet.</div>'}</div>
    <div style="height:90px"></div></div>
    <div class="bar row" style="bottom:90px;gap:8px"><button class="btn2" style="flex:1" data-act="vbCancel">Annuler</button><button class="btn" style="flex:1.4" data-act="vbSave">Enregistrer</button></div>`;
}

routes.vitrine = async (a, b) => {
  if (a === 'ajouter') return picker();
  if (a === 'nouveau') { if (!S.vb || S.vb.id || S.vb.kind !== b) S.vb = blank(KINDS[b] ? b : 'bandeau'); return editor(); }
  if (a === 'modifier') {
    if (!S.vb || S.vb.id !== Number(b)) { const r = must(await sb.from('home_blocks').select('*').eq('id', Number(b)).single()); S.vb = fix({ id: r.id, kind: r.kind, title: r.title || '', active: r.active, startsL: toLocal(r.starts_at), endsL: toLocal(r.ends_at), payload: r.payload }); }
    return editor();
  }
  return list();
};

// ───────── Actions
const rpc = async (name, args) => { const r = await sb.rpc(name, args); if (r.error) throw r.error; return r.data; };
const preview = () => { syncDerived(); const el = document.getElementById('vbPrev'); if (el && S.vb && S.vbCtx) el.innerHTML = renderBlock(S.vb, S.vbCtx) || '<div class="glass" style="padding:16px;font-size:14px">L’aperçu apparaît quand le bloc est complet.</div>'; };
handlers.vbPreview = preview;
handlers.vbRerender = () => render(true);
handlers.vbActive = () => { S.vb.active = !S.vb.active; render(true); };
handlers.vbCancel = () => { S.vb = null; go('/vitrine'); };
handlers.vbAdd = (el) => { const l = el.dataset.list; S.vb.payload[l].push(l === 'slides' ? slide0() : l === 'tiles' ? tile0() : l === 'stats' ? stat0() : ''); render(true); };
handlers.vbRemove = (el) => { S.vb.payload[el.dataset.list].splice(Number(el.dataset.i), 1); render(true); };
handlers.vbSearch = (el) => { const q = strip(el.value); document.querySelectorAll('.pk[data-n]').forEach((r) => { r.hidden = !!q && !r.dataset.n.includes(q); }); };
handlers.vbModel = (el) => {
  const sel = getIn(S.vb, el.dataset.path), id = Number(el.dataset.v), i = sel.indexOf(id);
  if (el.checked) { if (sel.length >= 12) { el.checked = false; toast('12 modèles au plus.'); return; } if (i < 0) sel.push(id); } else if (i >= 0) sel.splice(i, 1);
  const c = document.getElementById('vbCount'), o = document.getElementById('vbOrder');
  if (c) c.textContent = sel.length;
  if (o) o.textContent = sel.map((x) => ((S.vbModels || []).find((m) => m.id === x) || {}).name).filter(Boolean).join(' · ');
  preview();
};
handlers.vbBrand = (el) => { const l = S.vb.payload.brands, v = el.dataset.v, i = l.indexOf(v); if (el.checked && i < 0) l.push(v); else if (!el.checked && i >= 0) l.splice(i, 1); preview(); };

handlers.vbUpload = (el) => once('vbup', async () => {
  const f = el.files && el.files[0]; if (!f) return;
  const path = el.dataset.path; el.value = '';
  const blob = await shrink(f);
  const name = `accueil/${Date.now()}-${f.name.replace(/\.[^.]*$/, '').replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.jpg`;
  must(await sb.storage.from('photos').upload(name, blob, { contentType: 'image/jpeg' }));
  setIn(S.vb, path, sb.storage.from('photos').getPublicUrl(name).data.publicUrl);
  render(true);
});

handlers.vbSave = () => once('vb', async () => {
  const b = S.vb; if (!b) return;
  const p = JSON.parse(JSON.stringify(b.payload));
  syncDerived();
  if (b.kind === 'nouveautes') p.count = Number(p.count);
  if (b.kind === 'compte_rebours') { p.ends_at = b.payload.ends_at; delete p.ends_local; }
  if (b.kind === 'compteurs') p.stats = p.stats.map((x) => ({ value: x.value === '' ? NaN : Number(x.value), suffix: x.suffix || '', label: (x.label || '').trim() }));
  if (b.kind === 'defilement') p.items = p.items.map((x) => String(x || '').trim());
  const out = { id: b.id, kind: b.kind, title: (b.title || '').trim(), payload: p, active: b.active, starts_at: b.startsL ? new Date(b.startsL).toISOString() : null, ends_at: b.endsL ? new Date(b.endsL).toISOString() : null };
  const err = validateBlock(out);
  if (err) { toast(err); return; }
  await rpc('save_home_block', { p: out });
  toast('Bloc enregistré'); S.vb = null; go('/vitrine');
});
handlers.vbMove = (el) => once('vb', async () => {
  const ids = must(await sb.from('home_blocks').select('id').order('position').order('id')).map((r) => r.id);
  const i = ids.indexOf(Number(el.dataset.v)), j = i + Number(el.dataset.d);
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await rpc('reorder_home_blocks', { p_ids: ids });
  render(true);
});
handlers.vbDel = (el) => once('vb', async () => {
  if (typeof confirm === 'function' && !confirm('Supprimer ce bloc de la vitrine ?')) return;
  await rpc('delete_home_block', { p_id: Number(el.dataset.v) });
  toast('Bloc supprimé'); render(true);
});
