// OFFSTEP · informations obligatoires du revendeur (nom, prénom, numéro) : aucune page ne s'ouvre tant qu'elles ne sont pas renseignées.
// La vraie protection est dans la base (une commande est refusée sans ces informations) ; cet écran la rend simple à respecter.
import { sb, S, routes, handlers, go, render, toast, once } from './core.js';
import { esc, validateSignup } from './lib.js';

const G = () => (S.pgate || (S.pgate = { checked: false, done: false, nom: '', prenom: '', phone: '', err: {}, loaded: false }));
const prefill = (g, d) => {
  g.nom = d.nom || ''; g.prenom = d.prenom || ''; g.phone = d.phone || '';
  if (!g.nom && !g.prenom && d.name) { const t = String(d.name).trim().split(/\s+/); g.prenom = t[0] || ''; g.nom = t.slice(1).join(' '); }
};
async function load() {
  const g = G();
  if (g.loaded) return g;
  const r = await sb.rpc('my_profile_status');
  if (r.error) throw r.error;
  const d = r.data || {};
  g.loaded = true; g.role = d.role; g.completed = !!d.completed; prefill(g, d);
  return g;
}
// Faut-il bloquer ? Une erreur réseau ou une fonction absente (SQL pas encore lancé) ne bloque pas l'application.
async function blocked() {
  const g = G();
  if (g.done) return false;
  try { await load(); } catch { return false; }
  if (g.role && g.role !== 'revendeur') { g.done = true; return false; }
  g.done = g.completed;
  return !g.done;
}
const field = (g, k, label, extra) => `<label class="mono" for="g_${k}" style="display:block;margin-top:16px">${label}</label><input class="inp" id="g_${k}" value="${esc(g[k])}" data-bind="pgate.${k}" ${extra} ${g.err[k] ? 'aria-invalid="true"' : ''}>${g.err[k] ? `<div class="err">${esc(g.err[k])}</div>` : ''}`;
function formHtml(g, mode) {
  return `<div class="pad pg-form">${mode === 'edit' ? '<a href="#/compte" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>' : ''}
    <div class="mono" style="margin-top:8px">${mode === 'edit' ? 'Mon compte' : 'Dernière étape'}</div>
    <h1 class="h1" style="margin-top:6px">${mode === 'edit' ? 'Mes<br>informations' : 'Bienvenue<br>chez OFFSTEP'}</h1>
    <p style="color:#4A5160;font-size:14px;line-height:1.55;margin:12px 0 0">${mode === 'edit' ? 'Ces informations nous permettent de savoir qui commande.' : 'Pour commander, nous devons savoir qui vous êtes. Cette étape est obligatoire.'}</p>
    <div class="glass" style="padding:6px 18px 20px;margin-top:16px">${field(g, 'nom', 'Nom', 'autocomplete="family-name" maxlength="60"')}${field(g, 'prenom', 'Prénom', 'autocomplete="given-name" maxlength="60"')}${field(g, 'phone', 'Numéro de téléphone', 'type="tel" inputmode="tel" autocomplete="tel" maxlength="24"')}
    <button class="btn" style="width:100%;margin-top:20px" data-act="gateSave" data-mode="${mode}">${mode === 'edit' ? 'Enregistrer' : 'Continuer'}</button></div></div>`;
}
// Toutes les pages déjà enregistrées passent par le contrôle
for (const name of Object.keys(routes)) {
  const orig = routes[name];
  routes[name] = async (...a) => {
    if (await blocked()) { document.body.classList.add('gated'); return formHtml(G(), 'gate'); }
    document.body.classList.remove('gated');
    return orig(...a);
  };
}
routes.profil = async () => { const g = G(); try { await load(); } catch { /* formulaire vide */ } document.body.classList.remove('gated'); return formHtml(g, 'edit'); };

handlers.gateSave = (el) => once('gate', async () => {
  const g = G(), v = validateSignup(g);
  g.err = v.errors;
  if (!v.ok) { render(true); return; }
  const r = await sb.rpc('complete_profile', { p_nom: v.nom, p_prenom: v.prenom, p_phone: v.phone });
  if (r.error) throw r.error;
  g.nom = v.nom; g.prenom = v.prenom; g.phone = v.phone; g.err = {}; g.done = true; g.completed = true; g.loaded = true;
  if (S.profile) { S.profile.name = `${v.prenom} ${v.nom}`; S.profile.phone = v.phone; }
  document.body.classList.remove('gated');
  toast(el && el.dataset.mode === 'edit' ? 'Informations enregistrées' : 'Merci ! Vous pouvez commander');
  go(el && el.dataset.mode === 'edit' ? '/compte' : '/accueil');
});
