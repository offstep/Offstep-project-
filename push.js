// OFFSTEP · abonnement aux notifications push + envoi après une commande. Importé par notifications.js.
import { sb } from './core.js';

export const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const urlB64ToBytes = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
// Ce que renvoie place_order_once n'est pas connu : un nombre, un objet {id | order_id} ou une liste
export function orderIdFrom(d) {
  if (d == null) return null;
  if (Array.isArray(d)) return orderIdFrom(d[0]);
  if (typeof d === 'object') return orderIdFrom(d.order_id != null ? d.order_id : d.id);
  const n = Number(d); return Number.isInteger(n) && n > 0 ? n : null;
}
export async function flushPush(orderId) { try { await sb.functions.invoke('send-push', { body: orderId ? { order_id: orderId } : {} }); } catch { /* sans importance : la notification reste dans l'application */ } }

// Après une commande passée, demander l'envoi des notifications (sans toucher à checkout.js)
if (!sb.__pushPatched) {
  sb.__pushPatched = true;
  const orig = sb.rpc.bind(sb);
  sb.rpc = async (name, args, opts) => { const r = await orig(name, args, opts); if (name === 'place_order_once' && !r.error) setTimeout(() => flushPush(orderIdFrom(r.data)), 0); return r; };
}

const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, ko) => setTimeout(() => ko(new Error('Le service worker n’est pas actif. Rechargez la page.')), 5000))]);
export async function pushState() {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const s = await (await ready()).pushManager.getSubscription(); return s && Notification.permission === 'granted' ? 'on' : 'off'; } catch { return 'off'; }
}
export async function enablePush() {
  if (!supported()) throw new Error('Notifications non prises en charge ici.');
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const key = (await sb.rpc('get_vapid_public')).data;
  if (!key) throw new Error('Les notifications ne sont pas encore configurées (clé manquante).');
  const reg = await ready(), opt = { userVisibleOnly: true, applicationServerKey: urlB64ToBytes(key) };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe(opt);
  else { try { await sub.unsubscribe(); } catch { /* */ } sub = await reg.pushManager.subscribe(opt); } // clé changée : on repart propre
  const j = sub.toJSON();
  const r = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (r.error) throw r.error;
  return 'on';
}
export async function disablePush() {
  const sub = await (await ready()).pushManager.getSubscription();
  if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await sb.rpc('delete_push_subscription', { p_endpoint: ep }); }
  return 'off';
}
if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'goto' && /^#\/[\w\/-]*$/.test(e.data.url || '')) location.hash = e.data.url; });
