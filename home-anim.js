// OFFSTEP · animations des blocs d'accueil : apparition, compteurs, compte à rebours, carrousel 3D, parallaxe.
// Tout est coupé si l'appareil demande « réduire les animations ». Seuls transform et opacity bougent.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
if (!reduce.matches) root.classList.add('js-anim'); // sans cette classe, les blocs restent visibles (aucun risque si le script échoue)

const vis = new WeakMap();
let io = null;
const watch = (el, onIn) => {
  if (!('IntersectionObserver' in window)) { vis.set(el, true); if (onIn) onIn(el); return; }
  io = io || new IntersectionObserver((es) => es.forEach((e) => { vis.set(e.target, e.isIntersecting); if (e.isIntersecting && e.target._in) { const f = e.target._in; e.target._in = null; f(e.target); } }), { threshold: 0.18 });
  el._in = onIn || null; io.observe(el);
};
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── Apparition
function initReveal(el) { if (reduce.matches) return; watch(el, (x) => x.classList.add('in')); }

// ── Compteurs : de 0 à la valeur, une seule fois, quand le bloc est visible
function initCounter(el) {
  if (reduce.matches) return;
  const b = el.querySelector('b'), v = Number(el.dataset.v), s = el.dataset.s || '';
  if (!b || !Number.isFinite(v)) return;
  b.textContent = '0' + s;
  watch(el, () => {
    const t0 = performance.now(), dur = 1300;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = num(v * e) + s; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// ── Compte à rebours : une mise à jour par seconde, seulement pour ce qui est à l'écran
const cds = new Set();
const p2 = (n) => String(n).padStart(2, '0');
function tickCd(el) {
  const left = Number(el.dataset.end) - Date.now();
  const grid = el.querySelector('.cd-g'), after = el.querySelector('.cd-after');
  if (left <= 0) {
    if (grid) grid.hidden = true;
    if (after && after.textContent.trim()) after.hidden = false; else { const hb = el.closest('.hb'); if (hb) hb.hidden = true; }
    cds.delete(el); return;
  }
  const t = Math.floor(left / 1000), v = { d: p2(Math.floor(t / 86400)), h: p2(Math.floor((t % 86400) / 3600)), m: p2(Math.floor((t % 3600) / 60)), s: p2(t % 60) };
  el.querySelectorAll('b[data-u]').forEach((b) => { if (b.textContent !== v[b.dataset.u]) { b.textContent = v[b.dataset.u]; if (!reduce.matches) { b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); } } });
}
function initCd(el) { cds.add(el); watch(el); tickCd(el); }
setInterval(() => { if (document.hidden) return; for (const el of [...cds]) { if (!el.isConnected) { cds.delete(el); continue; } if (vis.get(el) !== false) tickCd(el); } }, 1000);

// ── Carrousel 3D : le modèle central grandit, les autres s'inclinent
function initCf(el) {
  if (reduce.matches) return;
  const upd = () => {
    const mid = el.scrollLeft + el.clientWidth / 2;
    el.querySelectorAll('.hcard').forEach((c) => {
      const d = (c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth, a = Math.min(1, Math.abs(d)), side = d < 0 ? 1 : -1;
      c.style.transform = `perspective(900px) rotateY(${(side * a * 26).toFixed(1)}deg) scale(${(1 - a * 0.14).toFixed(3)})`;
      c.style.opacity = (1 - a * 0.35).toFixed(2);
    });
  };
  let r = 0;
  el.addEventListener('scroll', () => { if (!r) r = requestAnimationFrame(() => { r = 0; upd(); }); }, { passive: true });
  upd(); setTimeout(upd, 120); watch(el);
}

// ── Parallaxe : l'image se déplace un peu moins vite que la page
const pars = new Set(); let pr = 0;
function updPar() {
  pr = 0;
  for (const el of [...pars]) {
    if (!el.isConnected) { pars.delete(el); continue; }
    if (vis.get(el) === false) continue;
    const r = el.getBoundingClientRect(), img = el.querySelector('.par-img img');
    if (img) img.style.transform = `translate3d(0,${Math.max(-40, Math.min(40, (r.top + r.height / 2 - innerHeight / 2) * -0.12)).toFixed(1)}px,0)`;
  }
}
function initPar(el) { if (reduce.matches) return; pars.add(el); watch(el); updPar(); }
addEventListener('scroll', () => { if (!pr && pars.size) pr = requestAnimationFrame(updPar); }, { passive: true });

const scan = () => {
  document.querySelectorAll('.hb[data-anim]').forEach((el) => { if (!el._a) { el._a = 1; initReveal(el); } });
  document.querySelectorAll('.cnt').forEach((el) => { if (!el._a) { el._a = 1; initCounter(el); } });
  document.querySelectorAll('.cd[data-end]').forEach((el) => { if (!el._a) { el._a = 1; initCd(el); } });
  document.querySelectorAll('.cf').forEach((el) => { if (!el._a) { el._a = 1; initCf(el); } });
  document.querySelectorAll('.hb-par').forEach((el) => { if (!el._a) { el._a = 1; initPar(el); } });
};
let raf = 0;
new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
scan();
