// OFFSTEP · « Séparer ce modèle » : déplacer des couleurs ou des pointures vers un nouveau modèle à un autre prix
import { sb, S, handlers, go, render, toast, once } from './core.js';
import { esc } from './lib.js';

const rights = () => { const p = S.profile; return !p || p.role === 'admin' || !!(p.rights && (p.rights.produits === true || (Array.isArray(p.rights) && p.rights.includes('produits')))); };
const st = () => (S.split && S.split.model === (S.edit && S.edit.id) ? S.split : (S.split = { model: S.edit && S.edit.id, ids: [], price: '', name: '' }));

export function splitSection(vars) {
  if (!rights() || !vars || !vars.length || !(S.edit && S.edit.id)) return '';
  const s = st(), colors = [...new Set(vars.map((v) => v.color))];
  return `<div class="sec">Séparer ce modèle</div>
    <div style="font-size:13px;color:#667085;line-height:1.5">Pour vendre une partie de ce modèle à un autre prix : cochez les pointures, donnez le nouveau prix. Un modèle séparé est créé avec le même nom, et le stock suit.</div>
    ${colors.map((c) => { const vs = vars.filter((v) => v.color === c).sort((a, b) => a.size - b.size); return `<div class="glass" style="padding:12px 14px;margin-top:10px"><div class="row"><b>${esc(c)}</b><button class="chip" data-act="splitColor" data-c="${esc(c)}">${vs.every((v) => s.ids.includes(v.id)) ? 'Tout décocher' : 'Toute la couleur'}</button></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${vs.map((v) => `<button class="chip" aria-pressed="${s.ids.includes(v.id)}" data-act="splitPick" data-v="${v.id}">${esc(v.size)}</button>`).join('')}</div></div>`; }).join('')}
    <label class="mono" for="split_price">Nouveau prix (FCFA)</label><input class="inp" id="split_price" type="number" inputmode="numeric" min="1" value="${esc(s.price)}" data-bind="split.price">
    <label class="mono" for="split_name">Nom du nouveau modèle (facultatif)</label><input class="inp" id="split_name" maxlength="80" placeholder="${esc(S.edit.name || '')}" value="${esc(s.name)}" data-bind="split.name">
    <button class="btn2" style="width:100%;margin-top:12px" data-act="splitGo" ${s.ids.length ? '' : 'disabled'}>Créer le modèle séparé (${s.ids.length} variante${s.ids.length > 1 ? 's' : ''})</button>`;
}
handlers.splitPick = (el) => { const s = st(), id = Number(el.dataset.v), i = s.ids.indexOf(id); if (i >= 0) s.ids.splice(i, 1); else s.ids.push(id); render(true); };
handlers.splitColor = (el) => {
  const s = st(), ids = (S.edit.variants || S.splitVars || []).filter((v) => v.color === el.dataset.c).map((v) => v.id);
  const all = ids.length && ids.every((i) => s.ids.includes(i));
  s.ids = all ? s.ids.filter((i) => !ids.includes(i)) : [...new Set([...s.ids, ...ids])];
  render(true);
};
handlers.splitGo = () => once('split', async () => {
  const s = st(), price = parseInt(String(s.price).replace(/\D/g, ''), 10);
  if (!s.ids.length) { toast('Cochez au moins une pointure.'); return; }
  if (!price || price < 1) { toast('Indiquez le nouveau prix.'); return; }
  if (typeof confirm === 'function' && !confirm(`Créer un modèle séparé à ${price} FCFA avec ${s.ids.length} variante(s) ?`)) return;
  const r = await sb.rpc('split_model', { p_model: S.edit.id, p_variant_ids: s.ids, p_price: price, p_name: (s.name || '').trim() || null });
  if (r.error) throw r.error;
  S.split = null; S.edit = null;
  toast('Modèle séparé créé');
  go('/produit/' + r.data);
});
export const setSplitVars = (vars) => { S.splitVars = vars; };
