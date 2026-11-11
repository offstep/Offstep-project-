// Lot D · Accueil du revendeur : sections composées dans l'administration (#/accueil)
import { S, routes, handlers, view, render, NAVCONF, sb } from './core.js';
import { ensureCatalogue } from './shop.js';
import { esc } from './lib.js';
import { renderBlock, makeCtx, FALLBACK, skeleton } from './home-blocks.js';
import './home-anim.js';

// L'accueil devient la page d'arrivée et entre dans la barre ; le panier est passé dans l'en-tête
NAVCONF.home = 'accueil';
NAVCONF.items = [['accueil', 'Accueil', '<path d="M4 11l8-7 8 7v9H4z"/>'], ...NAVCONF.items.filter((i) => i[0] !== 'panier')];
NAVCONF.badge = () => 0;

const inWindow = (b, now = Date.now()) => b.active !== false && (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) >= now);

routes.accueil = async () => {
  if (!S.homeSeen) view().innerHTML = skeleton();
  let blocks, c;
  try {
    c = await ensureCatalogue();
    const r = await sb.from('home_blocks').select('*').order('position');
    if (r.error) {
      if (/relation|schema cache|does not exist|home_blocks/i.test(r.error.message || '')) blocks = []; // table pas encore créée : accueil de secours
      else throw r.error;
    } else blocks = r.data || [];
  } catch (e) {
    return `<div class="pad"><div class="glass" style="padding:18px"><div class="t1">Impossible de charger l’accueil.</div><div class="t2">Vérifiez votre connexion.</div><button class="btn" style="margin-top:14px;width:100%" data-act="homeRetry">Réessayer</button></div></div>`;
  }
  S.homeSeen = true;
  const ctx = makeCtx({ models: c.models, photos: c.photos });
  let html = blocks.filter((b) => inWindow(b)).map((b) => renderBlock(b, ctx)).join('');
  if (!html.trim()) html = FALLBACK.map((b) => renderBlock(b, ctx)).join('');
  return `<div class="pad home">${html || '<div class="glass" style="padding:18px">Le catalogue arrive bientôt.</div>'}</div>`;
};
handlers.homeRetry = () => render(true);

// ───────── Diaporama : défilement par scroll-snap, minuterie de 5 s
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const live = new Set();
let io = null;
function initHS(el) {
  if (el._ok) return; el._ok = true;
  const track = el.querySelector('.hs-track'), slides = el.querySelectorAll('.hs-slide'), dots = [...el.querySelectorAll('.hs-dot')];
  if (!track || slides.length < 2) return;
  el._i = 0; el._n = slides.length; el._paused = false; el._vis = false;
  el._at = (i) => track.scrollTo({ left: i * track.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' });
  track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== el._i) { el._i = i; dots.forEach((d, k) => d.classList.toggle('on', k === i)); } }, { passive: true });
  dots.forEach((d, k) => d.addEventListener('click', () => el._at(k)));
  const hold = () => { el._paused = true; }, free = () => { el._paused = false; };
  track.addEventListener('touchstart', hold, { passive: true });
  track.addEventListener('touchend', free, { passive: true });
  track.addEventListener('touchcancel', free, { passive: true });
  if ('IntersectionObserver' in window) {
    if (!io) io = new IntersectionObserver((es) => es.forEach((e) => { e.target._vis = e.isIntersecting; }), { threshold: 0.4 });
    io.observe(el);
  } else el._vis = true;
  live.add(el);
}
setInterval(() => {
  if (reduce.matches || document.hidden) return;
  for (const el of [...live]) {
    if (!el.isConnected) { live.delete(el); continue; }
    if (!el._paused && el._vis) el._at((el._i + 1) % el._n);
  }
}, 5000);
const scan = () => document.querySelectorAll('.hs').forEach(initHS);
let raf = 0;
new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
scan();
