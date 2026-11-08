// Lot C · Demande de photos : formulaire, résultats, partage WhatsApp. Remplace l'ancien écran de account.js.
import { S, routes, handlers, go, render, toast, once, sb } from './core.js';
import { ensureCatalogue } from './shop.js';
import { esc, strip, brandKey, uniqueBrands, searchPhotos, phFill, waLink } from './lib.js';

const KEY = 'offstep.photoq';
const empty = () => ({ brand: '', size: null, color: '' });
const loadQ = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? { brand: String(v.brand || ''), size: v.size ? Number(v.size) : null, color: String(v.color || '') } : empty(); } catch { return empty(); } };
const saveQ = () => { try { localStorage.setItem(KEY, JSON.stringify(S.pq)); } catch { /* sans importance */ } };
const getQ = () => { if (!S.pq) S.pq = loadQ(); return S.pq; };

// ───────── Formulaire
async function form() {
  const c = await ensureCatalogue();
  S.pqLogged = null;
  const q = getQ();
  const brands = uniqueBrands(c.models.map((m) => m.category));
  const sizes = [...new Set(c.variants.map((v) => Number(v.size)).filter((n) => n > 0))].sort((a, b) => a - b);
  const seen = new Map();
  c.variants.forEach((v) => { const k = strip(v.color); if (k && !seen.has(k)) seen.set(k, String(v.color).trim()); });
  const colors = [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  const okSize = sizes.includes(q.size), okColor = colors.some((x) => strip(x) === strip(q.color));
  return `<div class="pad"><div class="mono">Photos réelles, sans prix</div><h1 class="h1" style="margin-top:6px">Demande<br>de photos</h1>
    <div class="sec">Marque <span class="mono" style="float:right;margin-top:8px">Facultatif</span></div>
    <div class="chips" role="group" aria-label="Marques"><button class="chip" aria-pressed="${!brandKey(q.brand)}" data-act="pqBrand" data-v="">Toutes les marques</button>${brands.map((b) => `<button class="chip" aria-pressed="${brandKey(q.brand) === brandKey(b)}" data-act="pqBrand" data-v="${esc(b)}">${esc(b)}</button>`).join('')}</div>
    <div class="sec">Pointure</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px" role="group" aria-label="Pointures">${sizes.map((s) => `<button class="chip big" aria-pressed="${okSize && s === q.size}" data-act="pqSize" data-v="${s}">${s}</button>`).join('') || '<div class="glass" style="padding:14px;grid-column:1/-1">Aucune pointure pour le moment.</div>'}</div>
    <div class="sec">Couleur</div>
    <div class="chips" style="flex-wrap:wrap" role="group" aria-label="Couleurs">${colors.map((col) => `<button class="chip" aria-pressed="${okColor && strip(col) === strip(q.color)}" data-act="pqColor" data-v="${esc(col)}">${esc(col)}</button>`).join('') || '<div class="glass" style="padding:14px">Aucune couleur pour le moment.</div>'}</div>
    </div><div class="bar" style="bottom:90px"><button class="btn" data-act="pqGo" ${okSize && okColor ? '' : 'disabled'}>Voir les photos</button></div>`;
}
handlers.pqBrand = (el) => { getQ().brand = el.dataset.v; saveQ(); render(true); };
handlers.pqSize = (el) => { getQ().size = Number(el.dataset.v); saveQ(); render(true); };
handlers.pqColor = (el) => { getQ().color = el.dataset.v; saveQ(); render(true); };
handlers.pqGo = () => {
  const q = getQ();
  if (!q.size || !q.color) return;
  go(`/photos/resultats/${q.size}/${encodeURIComponent(q.color)}/${encodeURIComponent(q.brand || '_')}`);
};

// ───────── Résultats
const logRequest = (q, n) => { try { Promise.resolve(sb.rpc('log_photo_request', { p_brand: q.brand || null, p_size: q.size, p_color: q.color, p_results: n })).then(() => {}, () => {}); } catch { /* ignoré */ } };

async function results(size, color, brand) {
  const c = await ensureCatalogue();
  const q = { brand: brand && brand !== '_' ? brand : '', size: Number(size), color: color || '' };
  S.pq = q; saveQ();
  const r = searchPhotos(c, q);
  const total = r.groups.reduce((t, g) => t + g.items.length, 0);
  const key = [q.size, strip(q.color), brandKey(q.brand)].join('|');
  if (S.pqLogged !== key) { S.pqLogged = key; S.photoSel = []; logRequest(q, total); }
  S.pItems = new Map(r.groups.flatMap((g) => g.items).map((it) => [it.model.model_id, it]));
  S.photoSel = (S.photoSel || []).filter((id) => S.pItems.has(id));
  const crit = `<div class="chips" aria-label="Votre recherche"><a class="chip" style="display:flex;align-items:center" href="#/photos">Pointure ${esc(q.size)}</a><a class="chip" style="display:flex;align-items:center" href="#/photos">${esc(r.colorLabel)}</a><a class="chip" style="display:flex;align-items:center" href="#/photos">${q.brand ? esc(q.brand) : 'Toutes les marques'}</a></div>`;
  const head = `<div class="pad"><a href="#/photos" class="back" style="position:static;margin-bottom:8px" aria-label="Modifier la recherche">‹</a><div class="mono">Photos réelles, sans prix</div><h1 class="h1" style="margin-top:6px">Vos<br>photos</h1><div style="margin-top:12px">${crit}</div>`;
  if (!r.groups.length) {
    const phone = S.settings && S.settings.offstep_phone;
    const txt = `Bonjour OFFSTEP, je cherche${q.brand ? ' du ' + q.brand : ''} en ${r.colorLabel}, pointure ${q.size}.`;
    return `${head}<div class="glass" style="padding:18px;margin-top:8px"><div class="t1">Aucun résultat pour l’instant.</div><div class="t2">Écrivez-nous.</div></div>${phone ? `<a class="btn" style="margin-top:16px;display:flex;align-items:center;justify-content:center" href="${esc(waLink(phone, txt))}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>` : ''}</div>`;
  }
  const n = S.photoSel.length;
  const card = (it) => {
    const m = it.model, sel = S.photoSel.includes(m.model_id);
    return `<div class="glass card ph-card">${it.cover
      ? `<button class="pick" aria-pressed="${sel}" aria-label="Sélectionner ${esc(m.name)}" data-act="pickPhoto" data-v="${m.model_id}"><i></i></button><button class="ph-open" data-act="openPhoto" data-v="${m.model_id}" aria-label="Voir les photos de ${esc(m.name)}"><div class="ph ph-fill" style="aspect-ratio:4/5;border-radius:20px">${phFill(it.cover.url, it.cover.thumb_url, { alt: m.name })}</div></button>`
      : '<div class="ph" style="aspect-ratio:4/5;border-radius:20px">Photo bientôt</div>'}
      <div style="font-size:14px;font-weight:600;margin-top:10px">${esc(m.name)}</div>${m.category ? `<div class="mono" style="margin-top:4px">${esc(m.category)}</div>` : ''}<div class="mono" style="margin-top:4px">${esc(r.colorLabel)}</div></div>`;
  };
  const withPhoto = [...S.pItems.values()].filter((it) => it.cover).length;
  return `${head}
    ${withPhoto ? `<div class="row" style="margin-top:14px"><button class="chip" data-act="selAllPhotos">Tout sélectionner</button><span class="mono">${n ? n + ' choisie(s)' : ''}</span></div>` : ''}
    ${r.groups.map((g) => `<div class="sec">${esc(g.title)}</div><div class="grid2">${g.items.map(card).join('')}</div>`).join('')}
    </div>${withPhoto ? `<div class="bar" style="bottom:90px"><button class="btn" data-act="shareSel" ${n ? '' : 'disabled'}>Partager sur WhatsApp${n ? ' (' + n + ')' : ''}</button></div>` : ''}`;
}

routes.photos = async (a, size, color, brand) => (a === 'resultats' ? results(size, color, brand) : form());

// ───────── Sélection, plein écran, partage
const MAXF = 10;
async function shareUrls(urls, text) {
  urls = urls.slice(0, MAXF);
  if (navigator.share && navigator.canShare) {
    try {
      toast('Préparation des photos…');
      const files = await Promise.all(urls.map(async (u, i) => { const b = await (await fetch(u)).blob(); return new File([b], `offstep-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }); }));
      if (navigator.canShare({ files })) { await navigator.share({ files, text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open(urls[0], '_blank', 'noopener'); // repli : photo seule, à enregistrer
  toast('Appuyez longuement sur la photo pour l’enregistrer.');
}
handlers.pickPhoto = (el) => {
  const id = Number(el.dataset.v), i = S.photoSel.indexOf(id);
  if (i >= 0) S.photoSel.splice(i, 1);
  else { if (S.photoSel.length >= MAXF) { toast(`${MAXF} photos au plus à la fois.`); return; } S.photoSel.push(id); }
  render(true);
};
handlers.selAllPhotos = () => {
  const ids = [...S.pItems.values()].filter((it) => it.cover).map((it) => it.model.model_id), pick = ids.slice(0, MAXF);
  S.photoSel = S.photoSel.length === pick.length && pick.every((i) => S.photoSel.includes(i)) ? [] : pick;
  if (ids.length > MAXF && S.photoSel.length) toast(`${MAXF} photos au plus à la fois.`);
  render(true);
};
handlers.openPhoto = (el) => {
  const it = S.pItems && S.pItems.get(Number(el.dataset.v));
  if (!it) return;
  const urls = it.gallery.map((p) => p.url);
  if (window.offstepViewer) window.offstepViewer(urls, 0, () => shareUrls(urls, it.model.name));
  else window.open(urls[0], '_blank', 'noopener');
};
handlers.shareSel = () => once('share', async () => {
  const its = S.photoSel.map((id) => S.pItems.get(id)).filter((it) => it && it.cover).slice(0, MAXF);
  if (!its.length) return;
  await shareUrls(its.map((it) => it.cover.url), its.map((it) => it.model.name).join('\n'));
});
