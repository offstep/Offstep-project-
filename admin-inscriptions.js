// OFFSTEP · Écran « Inscriptions » : demandes de nouveaux revendeurs (nom, prénom, numéro) (#/inscriptions)
import { sb, S, routes, handlers, render, toast, once } from './core.js';
import { esc, waLink } from './lib.js';

const must = (r) => { if (r.error) throw r.error; return r.data; };
const back = (to) => `<a href="#/${to}" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>`;
const when = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rpc = async (name, args) => { const r = await sb.rpc(name, args); if (r.error) throw r.error; return r.data; };

routes.inscriptions = async () => {
  const rows = must(await sb.from('signup_requests').select('*').order('created_at', { ascending: false }).limit(200));
  const news = rows.filter((r) => r.status === 'new').length;
  const card = (r) => `<div class="glass" style="padding:14px 16px;margin-top:10px${r.status === 'done' ? ';opacity:.6' : ''}"><div class="row" style="gap:10px"><span style="min-width:0"><b style="font-size:16px">${esc(r.prenom)} ${esc(r.nom)}</b><span class="mono" style="display:block;margin-top:3px">${esc(r.phone)} · ${esc(when(r.created_at))}</span></span><span class="tag ${r.status === 'new' ? 'dark' : ''}">${r.status === 'new' ? 'À traiter' : 'Traitée'}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><a class="chip" style="display:flex;align-items:center" href="tel:+${esc(r.phone)}">Appeler</a><a class="chip" style="display:flex;align-items:center" href="${esc(waLink(r.phone, `Bonjour ${r.prenom}, ici OFFSTEP : nous avons bien reçu votre demande d’inscription.`))}" target="_blank" rel="noopener">WhatsApp</a><button class="chip" data-act="signupToggle" data-id="${r.id}" data-s="${r.status === 'new' ? 'done' : 'new'}">${r.status === 'new' ? 'Marquer traitée' : 'Rouvrir'}</button><button class="chip" data-act="signupDelete" data-id="${r.id}">Supprimer</button></div></div>`;
  return `<div class="pad">${back('plus')}<h1 class="h1" style="font-size:32px;margin-top:8px">Inscriptions</h1>
    <div class="mono" style="margin-top:10px">${news ? `${news} demande${news > 1 ? 's' : ''} à traiter` : 'Aucune demande à traiter'}</div>
    <div class="glass" style="padding:14px 16px;margin-top:12px;font-size:13px;line-height:1.5;color:#4A5160">Les demandes viennent du formulaire <b>inscription.html</b> de votre site. Contactez la personne, puis ouvrez son accès depuis « Comptes ».</div>
    ${rows.map(card).join('') || '<div class="glass" style="padding:18px;margin-top:12px">Aucune demande pour le moment.</div>'}
    <div style="height:90px"></div></div>`;
};
handlers.signupToggle = (el) => once('su', async () => { await rpc('set_signup_status', { p_id: Number(el.dataset.id), p_status: el.dataset.s }); render(true); });
handlers.signupDelete = (el) => once('su', async () => {
  if (typeof confirm === 'function' && !confirm('Supprimer cette demande ?')) return;
  await rpc('delete_signup', { p_id: Number(el.dataset.id) }); toast('Demande supprimée'); render(true);
});
