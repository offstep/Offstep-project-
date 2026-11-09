// OFFSTEP · Marques et catégories : classement AUTOMATIQUE d'après le nom des modèles (« Nike TN » → marque Nike, catégorie TN).
import { sb, S, routes, handlers, render, toast, once } from './core.js';
import { esc, brandKey } from './lib.js';
import { classifyBatch } from './classify.js';

const must = (r) => { if (r.error) throw r.error; return r.data; };
const back = (to) => `<a href="#/${to}" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>`;
const canProduits = () => { const p = S.profile; return !p || p.role === 'admin' || !!(p.rights && (p.rights.produits === true || (Array.isArray(p.rights) && p.rights.includes('produits')))); };
const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
const rpc = async (name, args) => { const r = await sb.rpc(name, args); if (r.error) throw r.error; return r.data; };
const ok = (n) => { if (!n || n.length > 40) { toast('Le nom fait de 1 à 40 caractères.'); return false; } return true; };

// Classe les modèles qui n'ont pas encore de marque ou de catégorie (ou tous, avec force). Renvoie { done, unknown }.
export async function autoClassify({ ids = null, force = false } = {}) {
  let q = sb.from('models').select('id,name,category,category_id');
  if (ids && ids.length) q = q.in('id', ids);
  const [models, brands] = await Promise.all([q.then(must), sb.from('brands').select('name').then(must)]);
  const { items, unknown } = classifyBatch(models, brands.map((b) => b.name), force);
  let done = 0;
  for (let i = 0; i < items.length; i += 400) done += Number(await rpc('apply_classification', { p: items.slice(i, i + 400), p_force: force })) || 0;
  return { done, unknown };
}
export const autoClassifyQuiet = async (opts) => { try { return await autoClassify(opts); } catch { return null; } }; // n'empêche jamais un enregistrement

routes.categories = async () => {
  if (!canProduits()) return `<div class="pad">${back('plus')}<div class="glass" style="padding:18px;margin-top:12px">Le droit « Produits » est nécessaire pour cet écran.</div></div>`;
  // Le classement se fait à l'ouverture : rien à saisir
  let r = { done: 0, unknown: [] };
  try { r = await autoClassify(); } catch (e) { if (!/function|column|relation|schema/i.test(String(e.message || e))) throw e; return `<div class="pad">${back('plus')}<div class="glass" style="padding:18px;margin-top:12px">Lancez d’abord le script SQL « étape 19 » dans Supabase.</div></div>`; }
  const [brands, cats, ms] = await Promise.all([sb.from('brands').select('*').order('name').then(must), sb.from('categories').select('*').order('name').then(must), sb.from('models').select('id,name,category,category_id').then(must)]);
  if (!S.cbNew) S.cbNew = { brand: '' };
  const noun = (n) => `${n} modèle${n > 1 ? 's' : ''}`;
  const nB = (name) => ms.filter((m) => brandKey(m.category) === brandKey(name)).length, nC = (id) => ms.filter((m) => m.category_id === id).length;
  const lines = (b) => cats.filter((c) => brandKey(c.brand) === brandKey(b.name));
  const unknown = ms.filter((m) => !String(m.category || '').trim() && !m.category_id);
  return `<div class="pad">${back('plus')}<h1 class="h1" style="font-size:32px;margin-top:8px">Marques et catégories</h1>
    <div class="glass" style="padding:14px 16px;margin-top:12px;font-size:14px;line-height:1.5">Le classement est automatique : l’application lit le nom du modèle (« Nike TN » devient la marque Nike, catégorie TN) et crée les catégories toute seule.${r.done ? `<b style="display:block;margin-top:6px">${r.done} modèle${r.done > 1 ? 's' : ''} classé${r.done > 1 ? 's' : ''} à l’ouverture.</b>` : ''}</div>
    <div class="row" style="gap:8px;margin-top:10px"><button class="chip" data-act="cbAuto">Classer maintenant</button><button class="chip" data-act="cbAutoAll">Tout reclasser</button></div>
    ${unknown.length ? `<div class="sec">À reconnaître (${unknown.length})</div><div class="glass" style="padding:6px 16px;margin-top:6px"><div style="font-size:13px;color:#667085;margin:8px 0">Ces noms ne contiennent aucune marque connue. Ajoutez la marque dans le nom, par exemple « Nike TN ».</div>${unknown.map((m) => `<div class="row" style="min-height:44px;border-top:1px solid rgba(10,12,20,.07)"><span style="font-size:14px">${esc(m.name)}</span><a class="chip" style="display:flex;align-items:center" href="#/produit/${m.id}">Modifier</a></div>`).join('')}</div>` : ''}
    <div class="sec">Marques</div>
    <div class="row" style="gap:8px;margin-top:10px"><input class="inp" style="margin:0;flex:1" aria-label="Ajouter une marque" placeholder="Ajouter une marque (facultatif)" maxlength="40" value="${esc(S.cbNew.brand)}" data-bind="cbNew.brand"><button class="btn" style="flex:none;padding:0 20px" data-act="cbAddBrand">Ajouter</button></div>
    ${brands.map((b) => `<div class="glass" style="padding:12px 14px;margin-top:8px"><div class="row" style="gap:8px"><span style="min-width:0"><b style="font-size:15px">${esc(b.name)}</b><span class="mono" style="display:block;margin-top:2px">${noun(nB(b.name))}</span></span><span style="display:flex;gap:8px;flex:none"><button class="chip" data-act="cbRenameBrand" data-id="${b.id}" data-n="${esc(b.name)}">Renommer</button><button class="chip" data-act="cbDelBrand" data-id="${b.id}">Supprimer</button></span></div>
      ${lines(b).map((c) => `<div class="row" style="gap:8px;margin-top:10px;padding-left:14px;border-left:3px solid rgba(10,12,20,.1)"><span style="min-width:0">${esc(c.name)}<span class="mono" style="display:block;margin-top:2px">${noun(nC(c.id))}</span></span><span style="display:flex;gap:8px;flex:none"><button class="chip" data-act="cbRenameCat" data-id="${c.id}" data-n="${esc(c.name)}">Renommer</button><button class="chip" data-act="cbDelCat" data-id="${c.id}">Supprimer</button></span></div>`).join('')}</div>`).join('') || '<div class="glass" style="padding:16px;margin-top:8px">Aucune marque.</div>'}
    <div style="height:90px"></div></div>`;
};

const ask = (msg, cur = '') => (typeof prompt === 'function' ? prompt(msg, cur) : null);
const sure = (msg) => typeof confirm !== 'function' || confirm(msg);
handlers.cbAuto = () => once('cb', async () => { const r = await autoClassify(); toast(r.done ? `${r.done} modèle(s) classé(s)` : 'Rien à classer'); render(true); });
handlers.cbAutoAll = () => once('cb', async () => { if (!sure('Reclasser tous les modèles d’après leur nom ? Les marques et catégories choisies à la main seront remplacées.')) return; const r = await autoClassify({ force: true }); toast(`${r.done} modèle(s) reclassé(s)`); render(true); });
handlers.cbAddBrand = () => once('cb', async () => { const n = clean(S.cbNew.brand); if (!ok(n)) return; await rpc('save_brand', { p_id: null, p_name: n }); S.cbNew.brand = ''; toast('Marque ajoutée'); render(true); });
handlers.cbRenameBrand = (el) => once('cb', async () => { const n = ask('Nouveau nom de la marque', el.dataset.n); if (n == null) return; if (!ok(clean(n))) return; await rpc('save_brand', { p_id: Number(el.dataset.id), p_name: clean(n) }); toast('Marque renommée'); render(true); });
handlers.cbDelBrand = (el) => once('cb', async () => { if (!sure('Supprimer cette marque ?')) return; await rpc('delete_brand', { p_id: Number(el.dataset.id) }); toast('Marque supprimée'); render(true); });
handlers.cbRenameCat = (el) => once('cb', async () => { const n = ask('Nouveau nom (un nom déjà utilisé fusionne les deux catégories)', el.dataset.n); if (n == null) return; if (!ok(clean(n))) return; await rpc('rename_category', { p_id: Number(el.dataset.id), p_name: clean(n) }); toast('Catégorie modifiée'); render(true); });
handlers.cbDelCat = (el) => once('cb', async () => { if (!sure('Supprimer cette catégorie ?')) return; await rpc('delete_category', { p_id: Number(el.dataset.id) }); toast('Catégorie supprimée'); render(true); });
