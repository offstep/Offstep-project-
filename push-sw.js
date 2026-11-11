// OFFSTEP · réception des notifications push. Ajouter UNE ligne en haut de sw.js :  importScripts('./push-sw.js');
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'OFFSTEP', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'OFFSTEP', { body: d.body || '', icon: self.registration.scope + 'icon-192.png', tag: d.tag, data: { url: /^#\/[\w\/-]*$/.test(d.url || '') ? d.url : '#/accueil' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#/accueil';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((x) => 'focus' in x);
    if (c) { c.postMessage({ type: 'goto', url }); return c.focus(); }
    return self.clients.openWindow(self.registration.scope + url);
  }));
});
