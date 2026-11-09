// OFFSTEP · lecture et réduction d'images avant envoi, avec plusieurs méthodes de lecture (téléphones variés)
async function load(file) {
  try { return { src: await createImageBitmap(file, { imageOrientation: 'from-image' }), w: 0, h: 0 }; } catch { /* option non gérée : on réessaie sans */ }
  try { return { src: await createImageBitmap(file), w: 0, h: 0 }; } catch { /* on essaie la lecture classique */ }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.src = url; await im.decode();
    return { src: im, w: im.naturalWidth, h: im.naturalHeight, url };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`Image illisible (${file.type || 'type inconnu'}). Utilisez une photo JPEG ou PNG, ou une capture d’écran.`);
  }
}
const size = (o) => ({ w: o.w || o.src.width, h: o.h || o.src.height });
const encode = (o, max, q) => new Promise((ok, ko) => {
  const { w, h } = size(o), k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(o.src, 0, 0, c.width, c.height);
  c.toBlob((b) => (b ? ok(b) : ko(new Error('Image illisible.'))), 'image/jpeg', q);
});
const done = (o) => { if (o.src.close) o.src.close(); if (o.url) URL.revokeObjectURL(o.url); };
export async function shrink(file, max = 1600, q = 0.82) { const o = await load(file); try { return await encode(o, max, q); } finally { done(o); } }
export async function shrinkBoth(file) { const o = await load(file); try { return { full: await encode(o, 1600, 0.82), thumb: await encode(o, 480, 0.8) }; } finally { done(o); } }
