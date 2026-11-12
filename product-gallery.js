// OFFSTEP · galerie de la fiche produit : cadre adapté aux photos, compteur, miniatures, plein écran. Aucune dépendance.
import { galleryFrame } from './lib.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
window.__pgr = window.__pgr || {}; // format retenu par modèle : évite un saut de mise en page au retour sur la fiche

function initPG(pg) {
  if (pg._ok) return; pg._ok = true;
  const track = pg.querySelector('.pg-track'), slides = [...pg.querySelectorAll('.pg-s')], box = pg.parentElement;
  const thumbs = [...box.querySelectorAll('.pg-t')], count = pg.querySelector('.pg-count'), n = slides.length;
  if (!track || !n) return;
  const at = (i, smooth) => track.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * track.clientWidth, behavior: smooth && !reduce.matches ? 'smooth' : 'auto' });
  let cur = -1;
  const upd = () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i === cur) return; cur = i;
    thumbs.forEach((t, k) => t.classList.toggle('on', k === i));
    if (count) count.textContent = `${i + 1} / ${n}`;
    root.dataset.galIdx = i;
    const t = thumbs[i];
    if (t && t.parentElement) t.parentElement.scrollTo({ left: t.offsetLeft - (t.parentElement.clientWidth - t.clientWidth) / 2, behavior: 'smooth' });
  };
  track.addEventListener('scroll', () => { if (!pg._r) pg._r = requestAnimationFrame(() => { pg._r = 0; upd(); }); }, { passive: true });
  thumbs.forEach((t, k) => t.addEventListener('click', () => at(k, true)));
  pg.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => at(cur + Number(b.dataset.pg), true)));
  slides.forEach((s, k) => s.addEventListener('click', () => { if (window.offstepViewer) window.offstepViewer(slides.map((x) => { const im = x.querySelector('img'); return im.currentSrc || im.src; }), k); }));
  // Le cadre suit le format habituel des photos ; une photo très différente est montrée entière sur un fond flou
  const ratios = slides.map(() => 0);
  const adapt = () => {
    const f = galleryFrame(ratios);
    pg.style.setProperty('--r', f.r.toFixed(3));
    if (pg.dataset.m) window.__pgr[pg.dataset.m] = Number(f.r.toFixed(3));
    slides.forEach((s, k) => { s.classList.toggle('fit', f.fits[k]); if (f.fits[k]) s.style.setProperty('--u', `url("${s.querySelector('img').src}")`); });
  };
  slides.forEach((s, k) => {
    const im = s.querySelector('img'), done = () => { if (im.naturalWidth && im.naturalHeight) { ratios[k] = im.naturalWidth / im.naturalHeight; adapt(); } };
    if (im.complete) done(); else im.addEventListener('load', done, { once: true });
  });
  const start = Number(pg.dataset.start) || 0, go = pg.dataset.go;
  at(start, false); upd();
  if (go !== undefined && go !== '' && Number(go) !== start) setTimeout(() => at(Number(go), true), 60);
}
const scan = () => document.querySelectorAll('.pg').forEach(initPG);
let raf = 0;
new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
scan();
