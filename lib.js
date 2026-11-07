// Fonctions simples, sans dépendance : testées automatiquement.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fcfa = (n) => (Math.round(Number(n) || 0)).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' FCFA';

export const digits = (p) => String(p || '').replace(/\D/g, '');

export const waLink = (phone, text) => 'https://wa.me/' + digits(phone) + '?text=' + encodeURIComponent(text);

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const num = (settings, key) => Number(settings && settings[key]) || 0;

// Totaux estimés du panier (le serveur recalcule toujours le vrai total)
export function cartTotals(cart, settings, fee = 0) {
  const shoes = cart.items.reduce((t, i) => t + i.price * i.qty, 0);
  const qtyOf = (list) => (list || []).reduce((t, o) => t + (Number(o.qty) || 0), 0);
  const socks = qtyOf(cart.socks_court) * num(settings, 'socks_court_price') + qtyOf(cart.socks_long) * num(settings, 'socks_long_price');
  const laces = qtyOf(cart.laces) * num(settings, 'laces_price');
  return { shoes, socks, laces, fee, total: shoes + socks + laces + fee };
}

export const cartCount = (cart) => cart.items.reduce((t, i) => t + i.qty, 0);

// Frais de service estimés : seulement pour la formule « par commande », après déduction du crédit
export function estimateFee(sub, settings, credit = 0) {
  if (!sub || sub.plan !== 'per_order') return 0;
  return Math.max(0, num(settings, 'price_per_order') - (Number(credit) || 0));
}

export function planActive(sub, today = new Date()) {
  if (!sub || sub.status !== 'active') return false;
  if (sub.plan === 'per_order') return true;
  if (!sub.ends_at) return false;
  const end = new Date(sub.ends_at + 'T23:59:59');
  return end >= today;
}

export const LABELS = {
  commande: { recue: 'Reçue', confirmee: 'Confirmée', terminee: 'Terminée', annulee: 'Annulée', refusee: 'Refusée' },
  livraison: { a_preparer: 'À préparer', prete: 'Prête', en_attente_retrait: 'En attente de retrait', en_cours: 'En cours de livraison', livree: 'Livrée', echouee: 'Échec de livraison', retour_en_cours: 'Retour en cours', retournee: 'Retournée', annulee: 'Annulée' },
  paiement: { en_attente: 'En attente', a_verifier: 'À vérifier', paye: 'Payé', refuse: 'Refusé', a_rembourser: 'Remboursement en cours', rembourse: 'Remboursé', annule: 'Annulé' },
  mode: { retrait: 'Retrait en boutique', mon_livreur: 'Mon livreur', livreur: 'Livreur' },
};
export const label = (kind, v) => (LABELS[kind] && LABELS[kind][v]) || v || '—';

// Messages simples pour les erreurs du serveur : jamais de détail sur le stock
export function friendlyError(msg) {
  const m = String(msg || '');
  if (m.includes('Article indisponible')) return "Cet article n'est plus disponible. Choisissez une autre solution.";
  if (m.includes('Abonnement requis')) return 'Choisissez votre formule pour commander.';
  if (m.includes('Capture requise')) return "Ajoutez la capture d'écran du paiement.";
  if (m.includes('Boutique requise')) return 'Choisissez une boutique.';
  if (m.includes('Livreur et téléphone')) return 'Choisissez un livreur et indiquez le téléphone de votre client.';
  if (m.includes('Panier vide')) return 'Votre panier est vide.';
  if (m.includes('Commande déjà partie')) return 'Cette commande est déjà partie : contactez OFFSTEP.';
  if (m.includes('Commande non annulable')) return "Cette commande ne peut plus être annulée.";
  if (m.includes('bêta')) return "La bêta n'est pas ouverte.";
  if (m.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('Email not confirmed') || m.includes('E-mail non confirmé')) return "Confirmez d'abord votre e-mail (lien reçu par message).";
  if (m.includes('User already registered')) return 'Cet e-mail a déjà un compte. Connectez-vous.';
  if (m.includes('Password should be')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Pas de connexion. Réessayez.';
  return m || 'Une erreur est survenue.';
}

export const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

// Couleurs : accepte les noms français ou anglais, avec ou sans accents ; « Noir/Blanc » donne un dégradé
export const strip = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const COLORS = { noir: '#0A0C14', blanc: '#FFFFFF', marron: '#7A5230', brun: '#7A5230', rouge: '#C0392B', bleu: '#1F4E9C', 'bleu marine': '#14264F', 'bleu ciel': '#7EC8E3', beige: '#D9C7A3', creme: '#F3EBD3', gris: '#9AA0AE', 'gris clair': '#D0D3DA', 'gris fonce': '#4B5060', vert: '#2E7D32', 'vert fonce': '#1B4D2B', kaki: '#8A8B4A', jaune: '#F2C200', moutarde: '#D9A400', rose: '#E88DB4', fuchsia: '#C2185B', orange: '#E67E22', violet: '#6A3FA0', mauve: '#B08AC9', turquoise: '#1ABC9C', bordeaux: '#6D1A2B', camel: '#C19A6B', dore: '#C9A227', or: '#C9A227', argent: '#C0C4CC', argente: '#C0C4CC', black: '#0A0C14', white: '#FFFFFF', brown: '#7A5230', red: '#C0392B', blue: '#1F4E9C', green: '#2E7D32', yellow: '#F2C200', gray: '#9AA0AE', grey: '#9AA0AE', pink: '#E88DB4', gold: '#C9A227', silver: '#C0C4CC' };
export function colorCss(name, custom = {}) {
  const k = strip(name);
  if (custom[k]) return custom[k];
  if (COLORS[k]) return COLORS[k];
  if (k.includes('/')) {
    const p = k.split('/').map((x) => colorCss(x, custom));
    return `linear-gradient(135deg, ${p[0]} 50%, ${p[1]} 50%)`;
  }
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', k)) return k;
  return '#C9CDD6';
}

// Bloc de texte -> modèles, couleurs, pointures et quantités
//   Modèle A | 10000 | Sneakers
//   Noir : 40 41 42x2
//   Jaune #F2C200 : 39 40
export function parseStockBlock(text) {
  const models = [], errors = [];
  let cur = null;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim(), n = i + 1;
    if (!line) return;
    if (line.includes(':')) {
      if (!cur) { errors.push({ line: n, msg: 'Ligne de couleur avant tout modèle' }); return; }
      const at = line.indexOf(':'), left = line.slice(0, at), right = line.slice(at + 1);
      const hm = left.match(/#([0-9a-f]{6})\b/i);
      const name = cap(left.replace(/#[0-9a-f]{6}/i, '').trim());
      if (!name) { errors.push({ line: n, msg: 'Couleur manquante' }); return; }
      const sizes = []; let bad = false;
      for (const t of right.split(/[\s,;]+/).filter(Boolean)) {
        const q = t.match(/^[x×*](\d+)$/i);
        if (q && sizes.length) { sizes[sizes.length - 1].qty = parseInt(q[1], 10); continue; }
        const m = t.match(/^(\d{2})(?:[x×*](\d+))?$/i);
        if (!m || +m[1] < 20 || +m[1] > 60) { errors.push({ line: n, msg: `« ${t} » n’est pas une pointure valide` }); bad = true; continue; }
        sizes.push({ size: +m[1], qty: m[2] ? +m[2] : 1 });
      }
      if (!sizes.length && !bad) errors.push({ line: n, msg: 'Aucune pointure pour ' + name });
      let col = cur.colors.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!col) { col = { name, hex: null, sizes: [] }; cur.colors.push(col); }
      if (hm) col.hex = '#' + hm[1].toUpperCase();
      for (const s of sizes) { const ex = col.sizes.find((x) => x.size === s.size); if (ex) ex.qty += s.qty; else col.sizes.push(s); }
    } else {
      const parts = line.split('|').map((p) => p.trim());
      if (!parts[0]) { errors.push({ line: n, msg: 'Nom de modèle manquant' }); return; }
      let price = null;
      if (parts[1]) { price = parseInt(parts[1].replace(/\D/g, ''), 10); if (isNaN(price)) { errors.push({ line: n, msg: 'Prix invalide' }); price = null; } }
      cur = { name: parts[0], price, category: parts[2] || '', ref: parts[3] || '', colors: [] };
      models.push(cur);
    }
  });
  models.forEach((m) => { if (!m.colors.length) errors.push({ line: 0, msg: 'Aucune couleur pour ' + m.name }); });
  return { models, errors };
}
