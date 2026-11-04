import { sb, S, routes, handlers, go, render, toast, once, loadAccount, hex } from './core.js';
import { esc, fcfa, label, fmtDate, planActive } from './lib.js';
import { ensureCatalogue, photoOf } from './shop.js';
import { momoPanel, uploadProof, orderBundle } from './checkout.js';

const tagFor = (kind, v) => `<span class="tag ${['paye', 'livree', 'terminee', 'confirmee'].includes(v) ? 'dark' : ''}">${esc(label(kind, v))}</span>`;
const nameOf = (variantId) => {
  const v = S.catalogue.variants.find((x) => x.id === variantId);
  const m = v && S.catalogue.models.find((x) => x.model_id === v.model_id);
  return m ? `${m.name} · ${v.color} · ${v.size}` : 'Article';
};
const FILTERS = { all: 'Toutes', open: 'En cours', done: 'Terminées' };
S.ofilter = S.ofilter || 'all';

routes.commandes = async () => {
  const [o, it] = await Promise.all([sb.from('my_orders').select('*').order('created_at', { ascending: false }), sb.from('my_order_items').select('*')]);
  if (o.error) throw o.error;
  await ensureCatalogue();
  const items = it.data || [];
  const list = (o.data || []).filter((x) => S.ofilter === 'all' || (S.ofilter === 'open' ? ['recue', 'confirmee'].includes(x.status) : ['terminee', 'annulee', 'refusee'].includes(x.status)));
  return `<div class="pad"><h1 class="h1" style="margin-top:12px">Mes<br>commandes</h1>
    <div class="chips" style="margin-top:14px">${Object.entries(FILTERS).map(([k, l]) => `<button class="chip" aria-pressed="${S.ofilter === k}" data-act="setFilter" data-v="${k}">${l}</button>`).join('')}</div>
    ${list.map((x) => { const mine = items.filter((i) => i.order_id === x.id); const first = mine[0]; return `<a class="glass" href="#/commande/${x.id}" style="display:block;padding:16px;margin-top:12px">
      <div class="row"><b style="font-size:14px">N° ${esc(x.number)}</b><span class="mono">${esc(fmtDate(x.created_at))}</span></div>
      <div class="row" style="margin-top:10px"><div style="font-size:14px;font-weight:600">${first ? esc(nameOf(first.variant_id)) + ' · Qté ' + first.qty : 'Commande'}${mine.length > 1 ? ` <span style="color:#667085;font-weight:500">+ ${mine.length - 1} article(s)</span>` : ''}</div><b style="font-size:13px;white-space:nowrap">${fcfa(x.total)}</b></div>
      <div class="row" style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(10,12,20,.08);justify-content:flex-start;gap:6px;flex-wrap:wrap">${tagFor('commande', x.status)}${tagFor('livraison', x.delivery_status)}${tagFor('paiement', x.payment_status)}</div></a>`; }).join('') || '<div class="glass" style="padding:18px;margin-top:14px">Aucune commande pour le moment.</div>'}</div>`;
};
handlers.setFilter = (el) => { S.ofilter = el.dataset.v; render(true); };

routes.commande = async (id) => {
  id = Number(id);
  const [b] = await Promise.all([orderBundle(id), ensureCatalogue()]);
  const { order, items, opts, pay, boutique, courier, contacts } = b;
  const cancellable = ['a_preparer', 'prete', 'en_attente_retrait'].includes(order.delivery_status) && !['annulee', 'refusee', 'terminee'].includes(order.status);
  const optName = { socks_court: 'Chaussettes coupées', socks_long: 'Chaussettes longues', laces: 'Lacets' };
  return `<div class="pad"><a href="#/commandes" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>
    <div class="mono">Commande</div><h1 class="h1" style="font-size:32px;margin-top:6px">N° ${esc(order.number)}</h1>
    <div class="row" style="justify-content:flex-start;gap:6px;flex-wrap:wrap;margin-top:12px">${tagFor('commande', order.status)}${tagFor('livraison', order.delivery_status)}${tagFor('paiement', order.payment_status)}</div>
    <div class="sec">Articles</div>
    <div class="glass" style="padding:6px 18px">${items.map((i) => `<div class="kv"><span>${esc(nameOf(i.variant_id))}</span><b>× ${i.qty}</b></div>`).join('')}${opts.map((o) => `<div class="kv"><span>${esc(optName[o.kind] || o.kind)} ${esc(o.color || '')} ${esc(o.subtype || '')}</span><b>× ${o.qty}</b></div>`).join('')}<div class="kv"><span>Carton</span><b>${order.carton ? 'Avec carton' : 'Sans carton'}</b></div></div>
    <div class="sec">Livraison</div>
    <div class="glass" style="padding:6px 18px"><div class="kv"><span>Mode</span><b>${esc(label('mode', order.delivery_mode))}</b></div><div class="kv"><span>Boutique</span><b>${esc(boutique ? boutique.name : '')}</b></div>${contacts.length ? `<div class="kv"><span>Contact</span><b>${contacts.map((x) => esc(x.contact_name) + ' ' + esc(x.contact_phone)).join('<br>')}</b></div>` : ''}${order.quartier ? `<div class="kv"><span>Quartier</span><b>${esc(order.quartier)}</b></div>` : ''}${order.client_phone ? `<div class="kv"><span>Téléphone client</span><b>${esc(order.client_phone)}</b></div>` : ''}${order.wished_time ? `<div class="kv"><span>Horaire</span><b>${esc(String(order.wished_time).slice(0, 5))}</b></div>` : ''}${courier ? `<div class="kv"><span>Livreur</span><b>${esc(courier.name)}</b></div>` : ''}</div>
    <div class="sec">Paiement</div>
    <div class="glass" style="padding:6px 18px"><div class="kv"><span>Chaussures</span><b>${fcfa(order.shoes_total)}</b></div><div class="kv"><span>Chaussettes</span><b>${fcfa(order.socks_total)}</b></div><div class="kv"><span>Lacets</span><b>${fcfa(order.laces_total)}</b></div>${order.service_fee ? `<div class="kv"><span>Frais de service</span><b>${fcfa(order.service_fee)}</b></div>` : ''}<div class="kv"><span>Total</span><b>${fcfa(order.total)}</b></div></div>
    ${pay && pay.method === 'momo' && pay.status === 'en_attente' && order.status === 'recue' ? `<div style="margin-top:14px">${momoPanel(order.total)}<button class="btn" style="margin-top:12px" data-act="sendProof" data-pay="${pay.id}" data-order="${order.id}">Envoyer la capture</button></div>` : ''}
    <div class="stack" style="margin-top:20px">
      ${pay && pay.method === 'livraison_client' && pay.status !== 'paye' && order.status !== 'annulee' ? `<button class="btn" data-act="confirmClient" data-order="${order.id}">J’ai reçu le paiement de mon client</button>` : ''}
      ${courier ? `<button class="btn2" data-act="writeCourier" data-order="${order.id}" data-courier="${courier.id}">Écrire au livreur sur WhatsApp</button>` : ''}
      ${cancellable ? `<button class="btn2" style="color:#B42318;border-color:rgba(180,35,24,.35)" data-act="cancelOrder" data-order="${order.id}">Annuler la commande</button>` : ''}</div></div>`;
};
handlers.confirmClient = (el) => once('confirm', async () => {
  const { error } = await sb.rpc('confirm_client_payment', { p_order: Number(el.dataset.order) });
  if (error) throw error;
  toast('Paiement confirmé'); render(true);
});
handlers.cancelOrder = (el) => once('cancel', async () => {
  if (!confirm('Annuler cette commande ?')) return;
  const { data, error } = await sb.rpc('cancel_order', { p_order: Number(el.dataset.order), p_reason: 'client' });
  if (error) throw error;
  await loadAccount();
  toast(data.credit > 0 ? `Commande annulée. Crédit de ${fcfa(data.credit)} sur votre prochaine commande.` : 'Commande annulée.');
  render(true);
});

const planLabel = (sub) => {
  if (!sub) return 'Aucune formule active';
  if (sub.plan === 'beta') return `Bêta gratuite jusqu’au ${fmtDate(sub.ends_at)}`;
  if (sub.plan === 'monthly') return `Mensuelle · jusqu’au ${fmtDate(sub.ends_at)}`;
  return `Par commande · ${fcfa(S.settings.price_per_order)} de frais par commande`;
};

routes.compte = async () => {
  const { data: pays } = await sb.from('my_payments').select('*').eq('kind', 'subscription').order('id', { ascending: false }).limit(5);
  const p = S.profile;
  return `<div class="pad"><h1 class="h1" style="margin-top:12px">Compte</h1>
    <div class="glass" style="padding:16px;margin-top:16px"><div style="font-size:20px;font-weight:600">${esc(p.name || '')}</div><div style="font-size:13px;color:#667085;margin-top:2px">${esc(p.phone || '')} ${esc(p.email || '')}</div></div>
    <div class="sec">Ma formule</div>
    <div class="glass" style="padding:18px"><div style="font-size:17px;font-weight:600">${esc(planLabel(S.sub))}</div>${S.credit ? `<div style="font-size:13px;color:#667085;margin-top:6px">Crédit de frais : ${fcfa(S.credit)} sur votre prochaine commande.</div>` : ''}<a class="btn" style="margin-top:14px;display:flex;align-items:center;justify-content:center" href="#/formule">${S.sub ? 'Changer de formule' : 'Choisir ma formule'}</a></div>
    ${(pays || []).length ? `<div class="sec">Paiements d’abonnement</div><div class="glass" style="padding:6px 18px">${pays.map((x) => `<div class="kv"><span>${fcfa(x.amount_expected)}</span><b>${esc(label('paiement', x.status))}</b></div>`).join('')}</div>` : ''}
    <button class="btn2" style="margin-top:26px" data-act="logout">Se déconnecter</button></div>`;
};

routes.formule = async () => {
  const s = S.settings;
  const betaOn = s.beta_mode === true && s.beta_until && new Date(s.beta_until + 'T23:59:59') >= new Date();
  const { data: pend } = await sb.from('my_payments').select('*').eq('kind', 'subscription').in('status', ['en_attente', 'refuse', 'a_verifier']).order('id', { ascending: false }).limit(1);
  const pay = (pend || [])[0];
  return `<div class="pad"><a href="#/compte" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>
    <h1 class="h1" style="font-size:32px;margin-top:6px">Votre<br>formule</h1><div class="mono" style="margin-top:10px">${esc(planLabel(S.sub))}</div>
    <div class="stack" style="margin-top:20px">
      ${betaOn ? `<div class="glass" style="padding:18px"><b style="font-size:17px">Bêta gratuite</b><div style="font-size:13px;color:#667085;margin:4px 0 12px">Accès offert jusqu’au ${esc(fmtDate(s.beta_until))}, sans frais de service.</div><button class="btn" data-act="joinBeta">Rejoindre la bêta</button></div>` : ''}
      <div class="glass" style="padding:18px"><b style="font-size:17px">Mensuelle</b><div style="font-size:13px;color:#667085;margin:4px 0 12px">${fcfa(s.price_monthly)} par mois, commandes illimitées.</div><button class="btn2" data-act="chooseMonthly">Choisir la mensuelle</button></div>
      <div class="glass" style="padding:18px"><b style="font-size:17px">Par commande</b><div style="font-size:13px;color:#667085;margin:4px 0 12px">${fcfa(s.price_per_order)} de frais de service ajoutés à chaque commande.</div><button class="btn2" data-act="choosePerOrder">Choisir par commande</button></div></div>
    ${pay ? `<div class="sec">Paiement de l’abonnement</div>${pay.status === 'a_verifier' ? '<div class="glass" style="padding:16px"><b>Paiement en cours de vérification</b><div style="font-size:13px;color:#667085;margin-top:4px">Votre formule sera activée dès la validation.</div></div>' : `${momoPanel(pay.amount_expected)}<button class="btn" style="margin-top:12px" data-act="sendSubProof" data-pay="${pay.id}">Envoyer la capture</button>`}` : ''}</div>`;
};
handlers.joinBeta = () => once('beta', async () => {
  const { error } = await sb.rpc('join_beta');
  if (error) throw error;
  await loadAccount(); toast('Bienvenue dans la bêta !'); go('/compte');
});
handlers.chooseMonthly = () => once('plan', async () => {
  const { error } = await sb.rpc('choose_plan', { p_plan: 'monthly' });
  if (error) throw error;
  render(true);
});
handlers.choosePerOrder = () => once('plan', async () => {
  const { error } = await sb.rpc('choose_plan', { p_plan: 'per_order' });
  if (error) throw error;
  await loadAccount(); toast('Formule activée'); go('/compte');
});
handlers.sendSubProof = (el) => once('proof', async () => {
  if (!S.proofFile) throw new Error('Capture requise');
  await uploadProof(Number(el.dataset.pay), S.proofFile);
  S.proofFile = null; toast('Capture envoyée'); render(true);
});

// Demande de photos : photos réelles, sans prix
routes.photos = async () => {
  const c = await ensureCatalogue();
  const cats = [...new Set(c.models.map((m) => m.category).filter(Boolean))];
  const list = c.models.filter((m) => !S.cat || m.category === S.cat);
  return `<div class="pad"><h1 class="h1" style="font-size:32px;margin-top:12px">Demande<br>de photos</h1><div class="mono" style="margin-top:10px">Photos réelles · sans prix</div>
    <div class="chips" style="margin-top:14px"><button class="chip" aria-pressed="${!S.cat}" data-act="setCat" data-v="">Tous</button>${cats.map((k) => `<button class="chip" aria-pressed="${S.cat === k}" data-act="setCat" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="row" style="margin:6px 0 10px"><span class="mono">${S.photoSel.length} sélectionnée(s)</span><button style="border:0;background:transparent;font-weight:600;min-height:44px" data-act="photoAll">Tout sélectionner</button></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px 10px">${list.map((m) => { const on = S.photoSel.includes(m.model_id); const u = photoOf(m.model_id); return `<button style="border:0;background:transparent;padding:0;text-align:left;color:#0A0C14" aria-pressed="${on}" data-act="togglePhoto" data-v="${m.model_id}"><span class="ph" style="position:relative;display:flex;width:100%;aspect-ratio:1/1;border-radius:18px;${on ? 'outline:2px solid #0A0C14;outline-offset:-2px;' : ''}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : 'Photo'}<span style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;${on ? 'background:#0A0C14;color:#fff' : 'background:rgba(255,255,255,.9);border:1.5px solid #AEB3BF'};display:flex;align-items:center;justify-content:center;font-size:14px">${on ? '✓' : ''}</span></span><span style="display:block;font-size:12px;font-weight:600;margin-top:6px">${esc(m.name)}</span></button>`; }).join('')}</div></div>
    <div class="bar" style="bottom:90px"><button class="btn" data-act="sharePhotos" ${S.photoSel.length ? '' : 'disabled'}>Partager sur WhatsApp</button></div>`;
};
handlers.togglePhoto = (el) => { const id = Number(el.dataset.v); S.photoSel = S.photoSel.includes(id) ? S.photoSel.filter((x) => x !== id) : [...S.photoSel, id]; render(true); };
handlers.photoAll = () => { S.photoSel = S.catalogue.models.filter((m) => !S.cat || m.category === S.cat).map((m) => m.model_id); render(true); };
handlers.sharePhotos = () => once('photos', async () => {
  const urls = S.photoSel.map((id) => photoOf(id)).filter(Boolean);
  if (!urls.length) throw new Error('Aucune photo disponible pour cette sélection.');
  const files = [];
  for (const [i, u] of urls.entries()) { const blob = await (await fetch(u)).blob(); files.push(new File([blob], `offstep-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' })); }
  if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files }); } catch (e) { if (!e || e.name !== 'AbortError') throw e; } return; }
  window.open(urls[0], '_blank'); toast('Partage de plusieurs photos indisponible : appuyez longuement sur la photo pour l’enregistrer.');
});
