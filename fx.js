// OFFSTEP · effets « lac », galerie de photos et plein écran. Aucune dépendance.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const MAX = 12; // éléments animés en même temps, au plus
const live = new Set();
let io = null, n = 0;

function refresh() {
  let k = 0;
  for (const el of [...live]) {
    if (!el.isConnected) { live.delete(el); continue; }
    const on = !reduce.matches && !document.hidden && k < MAX;
    el.classList.toggle('in-view', on);
    if (on) k++;
  }
}
function setupIO() {
  if (io || !('IntersectionObserver' in window)) return;
  io = new IntersectionObserver((es) => {
    for (const e of es) { if (e.isIntersecting) live.add(e.target); else { live.delete(e.target); e.target.classList.remove('in-view'); } }
    refresh();
  }, { rootMargin: '60px' });
}
function scan() {
  setupIO();
  document.querySelectorAll('.card, .gal-wrap, .btn:not(:disabled)').forEach((el) => {
    if (el._fl) return;
    el._fl = true; el.classList.add('fl'); el.style.setProperty('--i', n++ % 9);
    if (io) io.observe(el);
  });
  document.querySelectorAll('.gal').forEach(initGal);
}

// ── Galerie : points, diapo centrale, flèches, aller à une diapo
function initGal(g) {
  if (g._ok) return; g._ok = true;
  const slides = [...g.querySelectorAll('.slide')], dots = [...g.parentElement.querySelectorAll('.dots i')];
  const at = (i, smooth) => {
    const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    if (s) g.scrollTo({ left: s.offsetLeft - (g.clientWidth - s.clientWidth) / 2, behavior: smooth && !reduce.matches ? 'smooth' : 'auto' });
  };
  let cur = -1;
  const upd = () => {
    const c = g.scrollLeft + g.clientWidth / 2; let b = 0, bd = 1e9;
    slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - c); if (d < bd) { bd = d; b = i; } });
    if (b === cur) return; cur = b;
    slides.forEach((s, i) => s.classList.toggle('cur', i === b));
    dots.forEach((d, i) => d.classList.toggle('on', i === b));
    root.dataset.galIdx = b;
  };
  g.addEventListener('scroll', () => { if (!g._r) g._r = requestAnimationFrame(() => { g._r = 0; upd(); }); }, { passive: true });
  g._at = at;
  const start = Number(g.dataset.start) || 0, go = g.dataset.go;
  at(start, false); upd();
  if (go !== undefined && go !== '' && Number(go) !== start) setTimeout(() => at(Number(go), true), 60);
}

// ── Plein écran : balayage, pincer pour zoomer, fermer (bouton, Échap)
function openLB(g, idx) { viewer([...g.querySelectorAll('.slide .pf-fg')].map((i) => i.currentSrc || i.src), idx); }
function viewer(srcs, idx = 0, onShare) {
  if (!srcs.length) return;
  const prevFocus = document.activeElement, prevOv = document.body.style.overflow;
  const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo en plein écran');
  const x = document.createElement('button'); x.className = 'lb-x'; x.setAttribute('aria-label', 'Fermer'); x.textContent = '×';
  const track = document.createElement('div'); track.className = 'lb-track';
  const num = document.createElement('div'); num.className = 'lb-n';
  const st = srcs.map((src) => {
    const s = document.createElement('div'); s.className = 'lb-s';
    const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; s.appendChild(im); track.appendChild(s);
    return { im, k: 1, x: 0, y: 0 };
  });
  lb.append(x, track, num);
  if (onShare) { const sh = document.createElement('button'); sh.className = 'lb-share'; sh.textContent = 'Partager'; sh.addEventListener('click', onShare); lb.append(sh); } document.body.appendChild(lb); document.body.style.overflow = 'hidden';
  const apply = (o) => { o.im.style.transform = `translate(${o.x}px,${o.y}px) scale(${o.k})`; track.classList.toggle('zoomed', st.some((z) => z.k > 1.02)); };
  const cur = () => Math.round(track.scrollLeft / track.clientWidth);
  const label = () => { num.textContent = srcs.length > 1 ? `${cur() + 1} / ${srcs.length}` : ''; };
  track.scrollLeft = idx * track.clientWidth; label();
  track.addEventListener('scroll', label, { passive: true });
  let d0 = 0, k0 = 1, px = 0, py = 0;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  track.addEventListener('touchstart', (e) => {
    const o = st[cur()]; if (!o) return;
    if (e.touches.length === 2) { d0 = dist(e.touches); k0 = o.k; } else if (e.touches.length === 1) { px = e.touches[0].clientX; py = e.touches[0].clientY; }
  }, { passive: true });
  track.addEventListener('touchmove', (e) => {
    const o = st[cur()]; if (!o) return;
    if (e.touches.length === 2 && d0) { e.preventDefault(); o.k = Math.max(1, Math.min(4, k0 * dist(e.touches) / d0)); if (o.k === 1) { o.x = 0; o.y = 0; } apply(o); }
    else if (e.touches.length === 1 && o.k > 1.02) { e.preventDefault(); o.x += e.touches[0].clientX - px; o.y += e.touches[0].clientY - py; px = e.touches[0].clientX; py = e.touches[0].clientY; apply(o); }
  }, { passive: false });
  track.addEventListener('touchend', () => { d0 = 0; const o = st[cur()]; if (o && o.k < 1.05) { o.k = 1; o.x = 0; o.y = 0; apply(o); } }, { passive: true });
  track.addEventListener('dblclick', () => { const o = st[cur()]; if (!o) return; o.k = o.k > 1 ? 1 : 2.5; o.x = 0; o.y = 0; apply(o); });
  const close = () => { document.removeEventListener('keydown', key); window.removeEventListener('hashchange', close); lb.remove(); document.body.style.overflow = prevOv; if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  const key = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
    else if (e.key === 'ArrowLeft') track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
  };
  x.addEventListener('click', close); document.addEventListener('keydown', key); window.addEventListener('hashchange', close); x.focus();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('[data-gal]');
  if (a) { const g = a.closest('.gal-wrap').querySelector('.gal'); if (g && g._at) g._at((Number(root.dataset.galIdx) || 0) + Number(a.dataset.gal), true); return; }
  const s = e.target.closest && e.target.closest('.gal .slide');
  if (s) openLB(s.closest('.gal'), Number(s.dataset.i) || 0);
});

// ── Ondulation au toucher
addEventListener('pointerdown', (e) => {
  if (reduce.matches || !e.target.closest) return;
  const t = e.target.closest('.btn,.btn2,.card,.chip,.sb,.nav a');
  if (!t || t.disabled) return;
  const r = t.getBoundingClientRect(), w = document.createElement('span');
  w.className = 'rw'; w.style.cssText = `--x:${e.clientX - r.left}px;--y:${e.clientY - r.top}px;--d:${Math.round(Math.max(r.width, r.height) * 1.5)}px`;
  w.innerHTML = '<i></i><i></i><i></i>'; t.appendChild(w);
  setTimeout(() => w.remove(), 1200);
}, { passive: true });

document.addEventListener('visibilitychange', () => { root.classList.toggle('paused', document.hidden); refresh(); });
reduce.addEventListener && reduce.addEventListener('change', refresh);
let raf = 0;
new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
scan();

window.offstepViewer = viewer; // utilisé par photos.js (lot C)
