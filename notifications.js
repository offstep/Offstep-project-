// OFFSTEP · écran « Notifications » (revendeur et administration) + pastille de la cloche
import { sb, S, routes, handlers, render, toast, once } from './core.js';
import { esc } from './lib.js';
import { pushState, enablePush, disablePush, flushPush } from './push.js';

const must = (r) => { if (r.error) throw r.error; return r.data; };
const okUrl = (u) => (/^#\/[\w\/-]*$/.test(u || '') ? u : '#/accueil');
const when = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export async function refreshBadge() {
  const el = document.getElementById('notifBadge'); if (!el) return;
  try {
    const r = await sb.from('my_notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    const n = r.count || 0; el.textContent = n > 99 ? '99+' : n; el.hidden = !n;
  } catch { /* hors ligne : on garde l'ancienne valeur */ }
}
const isAdminApp = () => /admin/i.test(location.pathname);
const tick = () => { if (document.hidden) return; refreshBadge(); if (isAdminApp()) flushPush(); }; // l'admin envoie aussi les notifications restées en attente
setInterval(tick, 60000);
document.addEventListener('visibilitychange', tick);
setTimeout(tick, 1500);

const STATE = {
  unsupported: ['Votre navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord OFFSTEP à l’écran d’accueil.', ''],
  denied: ['Les notifications sont bloquées dans les réglages du navigateur pour ce site.', ''],
  off: ['Recevez une alerte dès qu’une commande est passée.', '<button class="btn" style="margin-top:12px;width:100%" data-act="notifEnable">Activer les notifications</button>'],
  on: ['Notifications activées sur cet appareil.', '<button class="btn2" style="margin-top:12px;width:100%" data-act="notifDisable">Désactiver</button>'],
};
routes.notifications = async () => {
  const rows = must(await sb.from('my_notifications').select('*').order('created_at', { ascending: false }).limit(50));
  const [msg, btn] = STATE[await pushState()];
  return `<div class="pad"><h1 class="h1" style="margin-top:8px">Notifications</h1>
    <div class="glass" style="padding:16px;margin-top:14px"><div style="font-size:14px;line-height:1.45">${esc(msg)}</div>${btn}</div>
    ${rows.some((r) => !r.read_at) ? '<button class="chip" style="margin-top:14px" data-act="notifReadAll">Tout marquer comme lu</button>' : ''}
    <div class="stack" style="margin-top:14px">${rows.map((r) => `<a class="glass notif${r.read_at ? '' : ' unread'}" href="${esc(okUrl(r.url))}" data-act="notifOpen" data-v="${r.id}" data-url="${esc(okUrl(r.url))}"><div class="row" style="gap:10px"><b style="font-size:15px">${esc(r.title)}</b><span class="mono" style="font-size:10px;flex:none">${esc(when(r.created_at))}</span></div>${r.body ? `<div style="font-size:13px;color:#4A5160;margin-top:4px">${esc(r.body)}</div>` : ''}</a>`).join('') || '<div class="glass" style="padding:18px">Aucune notification pour le moment.</div>'}</div></div>`;
};
handlers.notifEnable = () => once('np', async () => { const s = await enablePush(); toast(s === 'on' ? 'Notifications activées' : 'Autorisation refusée'); render(true); });
handlers.notifDisable = () => once('np', async () => { await disablePush(); toast('Notifications désactivées'); render(true); });
handlers.notifReadAll = () => once('np', async () => { const r = await sb.rpc('mark_notifications_read', {}); if (r.error) throw r.error; await refreshBadge(); render(true); });
handlers.notifOpen = (el) => once('np', async () => { await sb.rpc('mark_notifications_read', { p_ids: [Number(el.dataset.v)] }); refreshBadge(); location.hash = okUrl(el.dataset.url); });
