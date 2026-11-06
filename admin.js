import { sb, S, render, NAVCONF, view } from './core.js';
import { showLogin } from './auth.js';
import { esc, friendlyError } from './lib.js';
import './admin-screens.js';

const ic = (p) => p;
NAVCONF.items = [
  ['accueil', 'Accueil', ic('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>')],
  ['paiements', 'Paiements', ic('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>')],
  ['commandes', 'Commandes', ic('<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M10 8h4M10 12h4"/>')],
  ['stocks', 'Stocks', ic('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>')],
  ['plus', 'Plus', ic('<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>')],
];
NAVCONF.home = 'accueil';
NAVCONF.group = { paiement: 'paiements', commande: 'commandes', produits: 'plus', produit: 'plus', livreurs: 'plus', reversements: 'plus', revendeurs: 'plus' };
NAVCONF.badge = (k) => (k === 'paiements' ? S.badgePay || 0 : 0);

const LIVE = ['accueil', 'paiements', 'commandes', 'stocks', 'reversements'];
const routeName = () => location.hash.replace(/^#/, '').split('/').filter(Boolean)[0] || 'accueil';
const typing = () => document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
let timer = null;
function refreshSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (!document.hidden && LIVE.includes(routeName()) && !typing()) render(true); }, 600);
}

function notice(title, text) {
  document.getElementById('nav').hidden = true;
  view().innerHTML = `<div class="pad"><h1 class="h1" style="margin-top:20px">${esc(title)}</h1><div class="glass" style="padding:18px;margin-top:18px;line-height:1.5">${text}</div><button class="btn2" style="margin-top:16px" data-act="logout">Se déconnecter</button></div>`;
}

(async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { showLogin(); return; }
  const md = data.session.user.user_metadata || {};
  const claim = await sb.rpc('claim_profile', { p_name: md.name || md.full_name || null, p_phone: md.phone || null });
  if (claim.error) { await sb.auth.signOut(); showLogin(friendlyError(claim.error.message)); return; }
  const { data: prof } = await sb.from('profiles').select('*').eq('auth_user_id', data.session.user.id).maybeSingle();
  if (!prof || !prof.active) { notice('Compte indisponible', 'Ce compte est désactivé.'); return; }
  S.profile = prof;
  if (!['admin', 'admin_limite'].includes(prof.role)) {
    notice('Accès réservé', 'Ce compte n’a pas accès à l’administration. Ouvrez l’application <a href="./" style="text-decoration:underline">OFFSTEP</a>.');
    return;
  }
  if (!location.hash) location.hash = '#/accueil';
  await render();
  // Temps réel : l'écran se met à jour dès qu'un stock, une commande ou un paiement change
  sb.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, refreshSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, refreshSoon)
    .subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSoon(); });
})();
