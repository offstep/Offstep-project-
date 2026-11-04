import { sb, S, routes, handlers, persist, go, render, toast, once, resetOrder, copyText, shareWithPhoto, fmtPhone } from './core.js';
import { esc, fcfa, cartTotals, label, fmtDate, waLink, uuid } from './lib.js';
import { feeNow } from './shop.js';

const radio = (act, v, on, title, desc) => `<button class="opt" role="radio" aria-checked="${on}" data-act="${act}" data-v="${esc(v)}"><span><span class="t1">${esc(title)}</span><span class="t2">${esc(desc || '')}</span></span><span class="rad"><span class="dot"></span></span></button>`;
const steps = (n, name) => `<div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div><div class="mono" style="margin:8px 0 0">0${n} — ${name}</div>`;

async function availableBoutiques() {
  const items = S.cart.items.map((i) => ({ variant: i.variantId, qty: i.qty }));
  const { data, error } = await sb.rpc('available_boutiques', { p_items: items });
  if (error) throw error;
  return data || [];
}
const getList = async (table, order) => { const { data, error } = await sb.from(table).select('*').eq('active', true).order(order); if (error) throw error; return data || []; };

routes.livraison = async () => {
  if (!S.cart.items.length) return '<div class="pad"><div class="glass" style="padding:18px">Votre panier est vide.</div></div>';
  const c = S.checkout;
  const boutiques = await availableBoutiques();
  if (!boutiques.some((b) => b.boutique_id === c.boutique_id)) c.boutique_id = boutiques.length === 1 ? boutiques[0].boutique_id : null;
  const couriers = c.mode === 'livreur' ? await getList('couriers', 'name') : [];
  const zones = c.mode === 'livreur' ? await getList('zones', 'name') : [];
  persist();
  return `<div class="pad">${steps(2, 'Livraison')}<h1 class="h1" style="margin-top:12px">Livraison</h1>
    <div class="stack" role="radiogroup" aria-label="Mode de livraison" style="margin-top:18px">
      ${radio('setMode', 'retrait', c.mode === 'retrait', 'Retrait en boutique', 'Vous récupérez la commande')}
      ${radio('setMode', 'mon_livreur', c.mode === 'mon_livreur', 'Mon livreur', 'Il récupère la commande en boutique')}
      ${radio('setMode', 'livreur', c.mode === 'livreur', 'Contacter un livreur', 'Vous lui écrivez sur WhatsApp')}</div>
    <div class="sec">Boutique</div>
    <div style="font-size:13px;color:#667085;line-height:1.4">Choisissez la boutique où la commande sera récupérée. Seules les boutiques où elle est disponible sont proposées.</div>
    <div class="stack" role="radiogroup" aria-label="Boutique" style="margin-top:12px">${boutiques.map((b) => radio('setShop', b.boutique_id, c.boutique_id === b.boutique_id, b.boutique_name, b.boutique_address || '')).join('') || '<div class="glass" style="padding:16px">Aucune boutique disponible pour le moment.</div>'}</div>
    ${c.mode === 'livreur' ? `<div class="sec">Livreur</div>
      <div class="stack" role="radiogroup" aria-label="Livreur">${couriers.map((k) => radio('setCourier', k.id, c.courier_id === k.id, k.name, (k.zones || []).join(', '))).join('') || '<div class="glass" style="padding:16px">Aucun livreur disponible.</div>'}</div>
      <div class="sec">Votre client</div>
      <label class="mono" for="cp">Téléphone · obligatoire</label><input class="inp" id="cp" type="tel" placeholder="+229 00 00 00 00" value="${esc(c.client_phone)}" data-bind="checkout.client_phone">
      <label class="mono" for="cq">Quartier</label><input class="inp" id="cq" type="text" value="${esc(c.quartier)}" data-bind="checkout.quartier">
      <div class="glass" style="margin-top:8px;padding:2px 16px">${zones.map((z) => `<button class="row" style="width:100%;min-height:52px;border:0;background:transparent;border-top:1px solid rgba(10,12,20,.07);color:#0A0C14;font-size:15px;font-weight:600;padding:0" data-act="setZone" data-v="${esc(z.name)}"><span>${esc(z.name)}</span><span style="font-size:13px">${z.fee_fcfa != null ? fcfa(z.fee_fcfa) : ''}</span></button>`).join('')}</div>
      <div style="font-size:12px;color:#667085;margin-top:8px">Tarifs indicatifs. Vous réglez la livraison directement avec le livreur.</div>
      <label class="mono" for="ca">Adresse ou repère · facultatif</label><input class="inp" id="ca" type="text" value="${esc(c.address_hint)}" data-bind="checkout.address_hint">
      <label class="mono" for="ci">Instructions · facultatif</label><input class="inp" id="ci" type="text" value="${esc(c.instructions)}" data-bind="checkout.instructions">
      <label class="mono" for="ch">Horaire de livraison · facultatif</label><input class="inp" id="ch" type="time" value="${esc(c.wished_time)}" data-bind="checkout.wished_time">` : ''}
    </div><div class="bar" style="bottom:90px"><button class="btn" data-act="toPayment">Continuer</button></div>`;
};
handlers.setMode = (el) => { S.checkout.mode = el.dataset.v; if (S.checkout.mode !== 'livreur') S.checkout.courier_id = null; persist(); render(true); };
handlers.setShop = (el) => { S.checkout.boutique_id = Number(el.dataset.v); persist(); render(true); };
handlers.setCourier = (el) => { S.checkout.courier_id = Number(el.dataset.v); persist(); render(true); };
handlers.setZone = (el) => { S.checkout.quartier = el.dataset.v; persist(); render(true); };
handlers.toPayment = () => {
  const c = S.checkout;
  if (!c.boutique_id) throw new Error('Boutique requise');
  if (c.mode === 'livreur' && (!c.courier_id || !String(c.client_phone).trim())) throw new Error('Livreur et téléphone du client requis');
  persist(); go('/paiement');
};

export function momoPanel(amount) {
  const num = S.settings.momo_number || '', name = S.settings.momo_name || '';
  return `<div class="glass" style="padding:18px;border-radius:24px">
    <div class="row" style="justify-content:flex-start;gap:10px"><span style="width:30px;height:30px;border-radius:50%;background:#FFCC00;color:#0A0C14;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800">MTN</span><span class="mono">Envoyez sur ce numéro MTN</span></div>
    <div class="row" style="margin-top:10px"><div style="font-size:24px;font-weight:700;letter-spacing:.6px">${esc(fmtPhone(num))}</div><button class="chip" style="height:44px" data-act="copy" data-v="${esc(String(num).replace(/\D/g, ''))}">Copier</button></div>
    <div style="font-size:15px;font-weight:600;margin-top:4px">${esc(name)}</div>
    <div class="kv" style="margin-top:14px"><span>Montant à envoyer</span><b>${fcfa(amount)}</b></div>
    <div class="mono" style="margin-top:14px">Preuve de paiement</div>
    <label class="drop" style="margin-top:10px;cursor:pointer" for="proof"><span id="proofName">${S.proofFile ? esc(S.proofFile.name) : 'Ajouter la capture d’écran'}</span></label>
    <input id="proof" type="file" accept="image/*" data-change-act="pickProof">
    <div style="font-size:13px;line-height:1.45;color:#3B4150;margin-top:12px">La capture doit montrer la <b>date et l’heure</b> du paiement. Sans cela, la commande sera refusée.</div></div>`;
}
handlers.copy = (el) => copyText(el.dataset.v);
handlers.pickProof = (el) => { S.proofFile = el.files[0] || null; const n = document.getElementById('proofName'); if (n) n.textContent = S.proofFile ? S.proofFile.name : 'Ajouter la capture d’écran'; };

export async function uploadProof(paymentId, file) {
  const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `${S.profile.id}/${paymentId}-${Date.now()}.${ext}`;
  const up = await sb.storage.from('preuves').upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (up.error) throw up.error;
  const { error } = await sb.rpc('submit_payment_proof', { p_payment: paymentId, p_url: path });
  if (error) throw error;
}

function allowedPay(mode) { return mode === 'retrait' ? ['momo', 'especes'] : ['momo', 'livraison']; }

routes.paiement = async () => {
  if (!S.cart.items.length) return '<div class="pad"><div class="glass" style="padding:18px">Votre panier est vide.</div></div>';
  const c = S.checkout;
  if (!allowedPay(c.mode).includes(c.pay)) c.pay = 'momo';
  const t = cartTotals(S.cart, S.settings, feeNow());
  const opts = allowedPay(c.mode);
  const meta = { momo: ['Mobile Money', 'Vous payez maintenant'], especes: ['Espèces', 'Vous réglez en main propre à la boutique'], livraison: ['Paiement à la livraison', 'Le règlement se fait à la remise'] };
  return `<div class="pad">${steps(3, 'Paiement')}<h1 class="h1" style="margin-top:12px">Paiement</h1>
    <div class="stack" role="radiogroup" aria-label="Mode de paiement" style="margin-top:18px">${opts.map((k) => radio('setPay', k, c.pay === k, meta[k][0], meta[k][1])).join('')}</div>
    <div style="margin-top:20px">${c.pay === 'momo' ? momoPanel(t.total) : ''}
    ${c.pay === 'especes' ? `<div class="glass" style="padding:18px;line-height:1.5">Remettez <b>${fcfa(t.total)}</b> en espèces au responsable de la boutique choisie, au moment de récupérer vos chaussures.</div>` : ''}
    ${c.pay === 'livraison' ? `<div class="mono" style="margin-bottom:10px">Qui encaisse ?</div><div class="stack">${radio('setWho', 'client', c.who === 'client', 'Mon client me paie', 'Il vous paie directement. Vous confirmez ensuite au livreur.')}${c.mode === 'livreur' ? radio('setWho', 'livreur', c.who === 'livreur', 'Le livreur encaisse', 'Il reçoit l’argent de votre client et le reverse à OFFSTEP.') : ''}</div>` : ''}</div>
    <div class="glass" style="padding:6px 18px 16px;margin-top:20px"><div class="kv"><span>Chaussures</span><b>${fcfa(t.shoes)}</b></div><div class="kv"><span>Chaussettes et lacets</span><b>${fcfa(t.socks + t.laces)}</b></div>${t.fee ? `<div class="kv"><span>Frais de service</span><b>${fcfa(t.fee)}</b></div>` : ''}<div class="row" style="border-top:1px solid rgba(10,12,20,.12);padding-top:14px"><span style="font-size:20px;font-weight:600">À régler</span><b style="font-size:18px">${fcfa(t.total)}</b></div></div>
    </div><div class="bar" style="bottom:90px"><button class="btn" data-act="submitOrder">Valider la commande</button></div>`;
};
handlers.setPay = (el) => { S.checkout.pay = el.dataset.v; persist(); render(true); };
handlers.setWho = (el) => { S.checkout.who = el.dataset.v; persist(); render(true); };

handlers.submitOrder = () => once('order', async () => {
  const c = S.checkout, cart = S.cart;
  if (c.pay === 'momo' && !S.proofFile) throw new Error('Capture requise');
  if (!c.token) { c.token = uuid(); persist(); }
  const method = c.pay === 'livraison' ? (c.who === 'livreur' && c.mode === 'livreur' ? 'livraison_livreur' : 'livraison_client') : c.pay;
  const options = [
    ...cart.socks_court.map((o) => ({ kind: 'socks_court', color: o.color, qty: o.qty })),
    ...cart.socks_long.map((o) => ({ kind: 'socks_long', color: o.color, subtype: o.sub, qty: o.qty })),
    ...cart.laces.map((o) => ({ kind: 'laces', color: o.color, qty: o.qty })),
  ].filter((o) => o.qty > 0);
  const payload = { token: c.token, boutique_id: c.boutique_id, delivery_mode: c.mode, courier_id: c.courier_id, quartier: c.quartier || null, client_phone: c.client_phone || null, address_hint: c.address_hint || null, instructions: c.instructions || null, wished_time: c.wished_time || null, carton: cart.carton, payment_method: method, items: cart.items.map((i) => ({ variant: i.variantId, qty: i.qty })), options };
  const { data, error } = await sb.rpc('place_order_once', { p: payload });
  if (error) throw error;
  const orderId = data.id, file = S.proofFile, wantsProof = method === 'momo';
  resetOrder();
  await loadFeeCredit();
  if (wantsProof && file) {
    try {
      const { data: pay } = await sb.from('my_payments').select('id').eq('order_id', orderId).single();
      await uploadProof(pay.id, file);
    } catch (e) { console.error(e); toast('Commande enregistrée. Envoyez la capture depuis la commande.'); }
  }
  go('/confirmation/' + orderId);
});
async function loadFeeCredit() { const { data } = await sb.from('my_credit').select('*').maybeSingle(); S.credit = (data && data.fee_credit) || 0; }

async function orderBundle(id) {
  const [o, items, opts, pays] = await Promise.all([
    sb.from('my_orders').select('*').eq('id', id).single(),
    sb.from('my_order_items').select('*').eq('order_id', id),
    sb.from('my_order_options').select('*').eq('order_id', id),
    sb.from('my_payments').select('*').eq('order_id', id),
  ]);
  if (o.error) throw o.error;
  const order = o.data;
  const [b, k, ct] = await Promise.all([
    sb.from('boutiques').select('*').eq('id', order.boutique_id).single(),
    order.courier_id ? sb.from('couriers').select('*').eq('id', order.courier_id).single() : Promise.resolve({ data: null }),
    sb.rpc('boutique_contacts', { p_order: id }),
  ]);
  return { order, items: items.data || [], opts: opts.data || [], pay: (pays.data || [])[0] || null, boutique: b.data, courier: k.data, contacts: ct.data || [] };
}
export { orderBundle };

routes.confirmation = async (id) => {
  const { order, pay, boutique, courier, contacts } = await orderBundle(Number(id));
  return `<div class="pad">${steps(4, 'Confirmation')}
    <div style="text-align:center;margin-top:28px"><div style="width:84px;height:84px;margin:0 auto;border-radius:50%;border:1px solid rgba(10,12,20,.12);background:radial-gradient(circle at 30% 25%,#fff,#E6EAF1);box-shadow:0 18px 40px -16px rgba(10,12,20,.4);display:flex;align-items:center;justify-content:center;font-size:34px">✓</div>
    <h1 class="h1" style="margin-top:22px">Commande<br>reçue</h1><div class="mono" style="margin-top:12px">N° ${esc(order.number)}</div></div>
    ${pay && pay.method === 'momo' && pay.status === 'en_attente' ? `<div class="glass" style="padding:16px;margin-top:22px"><b>Capture à envoyer</b><div style="font-size:13px;color:#667085;margin:4px 0 12px">Envoyez la capture d’écran du paiement : sans elle, la commande sera annulée automatiquement.</div>${momoPanel(order.total)}<button class="btn" style="margin-top:12px" data-act="sendProof" data-pay="${pay.id}" data-order="${order.id}">Envoyer la capture</button></div>` : ''}
    ${pay && pay.status === 'a_verifier' ? `<div class="glass" style="padding:16px;margin-top:22px"><b>Paiement en cours de vérification</b><div style="font-size:13px;color:#667085;margin-top:4px">Nous vérifions votre capture d’écran. Vous serez informé dès la validation.</div></div>` : ''}
    <div class="glass" style="padding:6px 18px 12px;margin-top:16px"><div class="kv"><span>Livraison</span><b>${esc(label('mode', order.delivery_mode))}</b></div><div class="kv"><span>Boutique</span><b>${esc(boutique ? boutique.name : '')}</b></div>${contacts.length ? `<div class="kv"><span>Contact boutique</span><b>${contacts.map((x) => esc(x.contact_name) + ' ' + esc(x.contact_phone)).join('<br>')}</b></div>` : ''}<div class="kv"><span>Paiement</span><b>${esc(label('paiement', order.payment_status))}</b></div><div class="kv"><span>Total</span><b>${fcfa(order.total)}</b></div></div>
    ${courier ? `<div class="glass" style="padding:16px;margin-top:12px"><div class="mono">Votre livreur</div><div style="font-size:16px;font-weight:600;margin-top:6px">${esc(courier.name)}</div><div style="font-size:13px;color:#667085;margin-top:2px">Le message est prêt : boutique, lieu, pointure, horaire et paiement.</div><button class="btn" style="margin-top:12px;height:50px" data-act="writeCourier" data-order="${order.id}" data-courier="${courier.id}">Écrire au livreur sur WhatsApp</button><button class="btn2" style="margin-top:8px" data-act="shareCourier" data-order="${order.id}">Partager avec la photo</button></div>` : ''}
    <a class="btn" style="margin-top:20px;display:flex;align-items:center;justify-content:center" href="#/commandes">Voir mes commandes</a></div>`;
};
handlers.sendProof = (el) => once('proof', async () => {
  if (!S.proofFile) throw new Error('Capture requise');
  await uploadProof(Number(el.dataset.pay), S.proofFile);
  S.proofFile = null; toast('Capture envoyée'); render(true);
});
async function courierText(orderId) {
  const { data, error } = await sb.rpc('courier_message', { p_order: orderId });
  if (error) throw error;
  return data;
}
handlers.writeCourier = async (el) => {
  const msg = await courierText(Number(el.dataset.order));
  const { data: c, error } = await sb.from('couriers').select('*').eq('id', Number(el.dataset.courier)).single();
  if (error) throw error;
  window.open(waLink(c.whatsapp, msg.text), '_blank');
};
handlers.shareCourier = async (el) => {
  const msg = await courierText(Number(el.dataset.order));
  const done = await shareWithPhoto(msg.text, msg.photo);
  if (!done) toast('Partage indisponible : utilisez « Écrire au livreur ».');
};
