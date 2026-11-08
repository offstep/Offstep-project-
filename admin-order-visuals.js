// Lot H · Images attachées au résumé d'une commande (admin) : photos des chaussures + capture du paiement
import { sb, S, handlers, once, toast, copyText } from './core.js';
import { esc, strip, phFill, sortPhotos, fcfa } from './lib.js';

// Une photo par modèle et couleur commandés (couleur demandée ; à défaut la 1re photo du modèle)
export function shoePhotos(items, vs, photos, models) {
  const out = [], seen = new Set();
  for (const it of items) {
    const v = vs.find((x) => x.id === (it.variant_requested || it.variant_assigned));
    if (!v) continue;
    const key = v.model_id + '|' + strip(v.color);
    if (seen.has(key)) continue; seen.add(key);
    const ps = sortPhotos(photos.filter((p) => p.model_id === v.model_id));
    const p = ps.find((x) => x.color && strip(x.color) === strip(v.color)) || ps[0] || null;
    out.push({ name: ((models.find((m) => m.id === v.model_id) || {}).name) || 'Modèle', color: v.color, url: p ? p.url : '', thumb: p ? (p.thumb_url || p.url) : '' });
  }
  return out;
}
export function summaryText({ o, w = {}, lines = [], bn = '' }) {
  const L = [`OFFSTEP · Commande N° ${o.number}`, `Revendeur : ${[w.name, w.phone].filter(Boolean).join(' ')}`, 'Articles :', ...lines.map((x) => `- ${x}`), `Total : ${fcfa(o.total)}`];
  if (o.delivery_mode) L.push(`Livraison : ${o.delivery_mode}${o.quartier ? ' · ' + o.quartier : ''}`);
  if (o.address_hint) L.push(`Repère : ${o.address_hint}`);
  if (o.client_phone) L.push(`Client : ${o.client_phone}`);
  if (o.wished_time) L.push(`Heure souhaitée : ${o.wished_time}`);
  if (o.instructions) L.push(`Consignes : ${o.instructions}`);
  if (bn) L.push(`Boutique : ${bn}`);
  return L.join('\n');
}
export async function orderVisuals({ o, w, items, opts = [], vs, ms, pays = [], bn, vname }) {
  const mids = [...new Set(vs.map((v) => v.model_id))];
  const photos = mids.length ? (await sb.from('model_photos').select('*').in('model_id', mids)).data || [] : [];
  const shoes = shoePhotos(items, vs, photos, ms).filter((s) => s.url);
  let proof = '';
  const pay = pays.filter((p) => p.proof_url).slice(-1)[0];
  if (pay) { const s = await sb.storage.from('preuves').createSignedUrl(pay.proof_url, 1800); proof = (s.data || {}).signedUrl || ''; }
  const all = [...shoes.map((s, i) => ({ url: s.url, thumb: s.thumb, label: `${s.name} · ${s.color}`, file: `modele-${i + 1}.jpg` })), ...(proof ? [{ url: proof, thumb: proof, label: 'Capture du paiement', file: 'capture-paiement.jpg' }] : [])];
  S.vis = { items: all, text: summaryText({ o, w, bn, lines: [...items.map((i) => `${i.qty} × ${vname(i.variant_requested)}`), ...opts.map((x) => `${x.qty} × ${[x.kind, x.color, x.subtype].filter(Boolean).join(' ')}`)] }) };
  const tiles = all.map((t, i) => `<button class="vis-t" data-act="openVis" data-i="${i}" aria-label="${esc(t.label)}"><div class="ph ph-fill" style="width:112px;height:140px;border-radius:18px">${phFill(t.thumb, t.thumb, { alt: t.label })}</div><span class="mono" style="display:block;margin-top:6px;font-size:9px;max-width:112px">${esc(t.label)}</span></button>`).join('');
  return `<div class="sec">Images de la commande</div><div class="glass" style="padding:14px">${all.length ? `<div class="hrow" style="margin:0 -14px;padding:0 14px 8px">${tiles}</div>` : '<div style="font-size:14px">Aucune image pour cette commande.</div>'}${pay && !proof ? '<div class="mono" style="margin-top:6px">Capture non disponible</div>' : ''}<button class="btn2" style="width:100%;margin-top:10px" data-act="shareSummary">Partager le résumé${all.length ? ' avec les images' : ''}</button></div>`;
}
handlers.openVis = (el) => {
  const v = S.vis; if (!v) return;
  const urls = v.items.map((x) => x.url), i = Number(el.dataset.i) || 0;
  if (window.offstepViewer) window.offstepViewer(urls, i); else window.open(urls[i], '_blank', 'noopener');
};
handlers.shareSummary = () => once('share', async () => {
  const v = S.vis; if (!v) return;
  const files = [];
  for (const it of v.items.slice(0, 8)) { try { const b = await (await fetch(it.url)).blob(); files.push(new File([b], it.file, { type: b.type || 'image/jpeg' })); } catch { /* image ignorée */ } }
  if (files.length && navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, text: v.text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  if (navigator.share) { try { await navigator.share({ text: v.text }); toast('Images non jointes : appuyez longuement sur une image pour l’enregistrer.'); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  await copyText(v.text); toast('Résumé copié, sans les images');
});
