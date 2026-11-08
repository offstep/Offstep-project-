import { S, render } from './core.js';
import { startSession } from './auth.js';
import './shop.js';
import './checkout.js';
import './account.js';
import './photos.js';
import './home.js';
import './notifications.js';

// Le catalogue se met à jour tout seul : toutes les 30 secondes et au retour sur l'application
const LIVE = ['accueil', 'catalogue', 'produit', 'photos'];
const routeName = () => location.hash.replace(/^#/, '').split('/').filter(Boolean)[0] || 'catalogue';
const typing = () => document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
async function refresh() {
  if (document.hidden || !S.profile || !LIVE.includes(routeName()) || typing()) return;
  S.catalogue = null;
  await render(true);
}

(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  const ok = await startSession();
  if (!ok) return;
  await render();
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
