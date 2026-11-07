import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, cartCount, friendlyError, planActive, colorCss } from './lib.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const emptyCart = () => ({ items: [], carton: true, socks_court: [], socks_long: [], laces: [] });
const emptyCheckout = () => ({ mode: 'retrait', boutique_id: null, courier_id: null, client_phone: '', quartier: '', address_hint: '', instructions: '', wished_time: '', pay: 'momo', who: 'client', token: null });
function load(key, make) {
  try { const v = JSON.parse(localStorage.getItem('offstep.' + key)); return v && typeof v === 'object' ? v : make(); } catch { return make(); }
}

export const S = {
  session: null, profile: null, sub: null, credit: 0, settings: {}, catalogue: null,
  q: '', cat: '', sel: null, authMode: 'in', busy: {}, proofFile: null, photoSel: [],
  cart: load('cart', emptyCart), checkout: load('checkout', emptyCheckout),
};

export function persist() {
  localStorage.setItem('offstep.cart', JSON.stringify(S.cart));
  localStorage.setItem('offstep.checkout', JSON.stringify(S.checkout));
}
export function resetOrder() { S.cart = emptyCart(); S.checkout = emptyCheckout(); S.proofFile = null; persist(); }

export const routes = {};
export const handlers = {};
export const view = () => document.getElementById('view');
export const go = (path) => { location.hash = '#' + path; };

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// Empêche un double appui d'envoyer deux fois la même action
export async function once(key, fn) {
  if (S.busy[key]) return;
  S.busy[key] = true;
  try { return await fn(); } finally { delete S.busy[key]; }
}

export async function loadAccount() {
  const [st, sub, cr] = await Promise.all([
    sb.from('public_settings').select('*'),
    sb.from('subscriptions').select('*').eq('status', 'active').order('id', { ascending: false }).limit(5),
    sb.from('my_credit').select('*').maybeSingle(),
  ]);
  S.settings = {};
  (st.data || []).forEach((r) => { S.settings[r.key] = r.value; });
  S.sub = (sub.data || []).find((x) => planActive(x)) || null;
  S.credit = (cr.data && cr.data.fee_credit) || 0;
}

const NAV = [
  ['catalogue', 'Catalogue', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'],
  ['photos', 'Photos', '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>'],
  ['panier', 'Panier', '<path d="M6 7h13l-1.5 9h-10z"/><path d="M6 7L5 3H2"/><circle cx="9" cy="20" r="1"/><circle cx="16" cy="20" r="1"/>'],
  ['commandes', 'Commandes', '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M10 8h4M10 12h4"/>'],
  ['compte', 'Compte', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'],
];
const GROUP = { produit: 'catalogue', livraison: 'panier', paiement: 'panier', confirmation: 'commandes', commande: 'commandes', formule: 'compte' };

export const NAVCONF = { home: 'catalogue', items: NAV, group: GROUP, badge: (k) => (k === 'panier' ? cartCount(S.cart) : 0) };

export function renderNav(name) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const active = NAVCONF.group[name] || name;
  nav.hidden = false;
  nav.innerHTML = NAVCONF.items.map(([k, l, p]) => { const n = NAVCONF.badge(k); return `<a href="#/${k}" class="${k === active ? 'on' : ''}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>${l}${n ? `<span class="badge">${n}</span>` : ''}</a>`; }).join('');
}

export async function render(keepScroll = false) {
  const raw = location.hash.replace(/^#/, '') || '/' + NAVCONF.home;
  const [name, ...args] = raw.split('/').filter(Boolean);
  const fn = routes[name] || routes[NAVCONF.home];
  const y = window.scrollY;
  try {
    view().innerHTML = await fn(...args.map(decodeURIComponent));
  } catch (e) {
    console.error(e);
    view().innerHTML = `<div class="pad"><div class="glass" style="padding:18px">${esc(friendlyError(e.message))}</div></div>`;
  }
  renderNav(name);
  window.scrollTo(0, keepScroll ? y : 0);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = handlers[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try { await fn(el, e); } catch (err) { console.error(err); toast(friendlyError(err.message || String(err))); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.bind) { setPath(S, el.dataset.bind, el.value); persist(); }
  if (el.dataset && el.dataset.inputAct && handlers[el.dataset.inputAct]) Promise.resolve(handlers[el.dataset.inputAct](el, e)).catch((err) => toast(friendlyError(err.message || String(err))));
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.changeAct && handlers[el.dataset.changeAct]) Promise.resolve(handlers[el.dataset.changeAct](el, e)).catch((err) => toast(friendlyError(err.message || String(err))));
});
window.addEventListener('hashchange', () => render());

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
  toast('Copié');
}

// Partage avec photo (feuille de partage du téléphone) ; sinon texte seul
export async function shareWithPhoto(text, photoUrl) {
  if (photoUrl && navigator.canShare) {
    try {
      const blob = await (await fetch(photoUrl)).blob();
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
  }
  if (navigator.share) { try { await navigator.share({ text }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; } }
  return false;
}

export function stepper(actDec, actInc, qty, data = '') {
  return `<div class="stepper"><button class="sb" aria-label="Diminuer" data-act="${actDec}" ${data}>−</button><b>${qty}</b><button class="sb" aria-label="Augmenter" data-act="${actInc}" ${data}>+</button></div>`;
}

export const COLORMAP = { noir: '#0A0C14', blanc: '#FFFFFF', marron: '#7A5230', rouge: '#C0392B', bleu: '#1F4E9C', beige: '#D9C7A3', gris: '#9AA0AE', vert: '#2E7D32', jaune: '#F2C200', rose: '#E88DB4', orange: '#E67E22' };
export const hex = (name) => colorCss(name, S.colorHex || {});
export const fmtPhone = (p) => String(p || '').replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
