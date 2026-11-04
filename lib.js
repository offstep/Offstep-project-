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
