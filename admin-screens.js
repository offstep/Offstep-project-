import { sb, S, routes, handlers, go, render, toast, once, copyText } from './core.js';
import { esc, fcfa, label, fmtDate } from './lib.js';

const must = (r) => { if (r.error) throw r.error; return r.data; };
const tag = (kind, v) => `<span class="tag ${['paye', 'livree', 'terminee', 'confirmee'].includes(v) ? 'dark' : ''}">${esc(label(kind, v))}</span>`;
const back = (to) => `<a href="#/${to}" aria-label="Retour" style="display:inline-block;font-size:28px;min-height:44px">‹</a>`;
const title = (t, sub = '') => `<h1 class="h1" style="font-size:32px;margin-top:8px">${t}</h1>${sub ? `<div class="mono" style="margin-top:10px">${esc(sub)}</div>` : ''}`;
const kpi = (l, v, s = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="glass" style="padding:16px;display:block"><div class="mono" style="font-size:9px;letter-spacing:1.2px">${l}</div><div style="font-size:30px;font-weight:600;letter-spacing:-1px;margin-top:8px">${v}</div><div style="font-size:12px;color:#667085;margin-top:2px">${s}</div></${href ? 'a' : 'div'}>`;
const count = async (table, f) => { let q = sb.from(table).select('id', { count: 'exact', head: true }); if (f) q = f(q); const r = await q; return r.count || 0; };
const names = async (ids) => {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await sb.from('profiles').select('id,name,phone').in('id', ids);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
};
const boutiquesList = async () => must(await sb.from('boutiques').select('*').order('id'));

// ───────── Accueil
routes.accueil = async () => {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const [pay, rev, prep, today, col] = await Promise.all([
    count('payments', (q) => q.eq('status', 'a_verifier')),
    count('orders', (q) => q.eq('needs_review', true).neq('status', 'annulee')),
    count('orders', (q) => q.eq('delivery_status', 'a_preparer').not('status', 'in', '(annulee,refusee)')),
    count('orders', (q) => q.gte('created_at', day.toISOString())),
    sb.from('courier_collections').select('amount_collected,amount_remitted').not('amount_collected', 'is', null),
  ]);
  S.badgePay = pay;
  const due = (col.data || []).reduce((t, c) => t + (c.amount_collected - c.amount_remitted), 0);
  return `<div class="pad">${title('Tableau<br>de bord', 'Mis à jour en direct')}
    <div class="grid2" style="margin-top:18px">${kpi('Paiements à vérifier', pay, 'Captures en attente', '#/paiements')}${kpi('Commandes du jour', today, 'Toutes boutiques', '#/commandes')}${kpi('À préparer', prep, 'Prêtes à sortir', '#/commandes')}${kpi('Reversements', fcfa(due), 'Dus par les livreurs', '#/reversements')}</div>
    <div class="sec">À traiter</div>
    <div class="glass" style="padding:0 18px">
      <a class="row" style="min-height:64px" href="#/paiements"><span><span class="t1">Paiements à vérifier</span><span class="t2">Captures Mobile Money</span></span><span class="tag dark">${pay}</span></a>
      <a class="row" style="min-height:64px;border-top:1px solid rgba(10,12,20,.07)" href="#/commandes" data-act="filterReview"><span><span class="t1">Commandes à vérifier</span><span class="t2">Vente passée avec un stock insuffisant</span></span><span class="tag dark">${rev}</span></a>
      <a class="row" style="min-height:64px;border-top:1px solid rgba(10,12,20,.07)" href="#/reversements"><span><span class="t1">Reversements en attente</span><span class="t2">Sommes encaissées par les livreurs</span></span><span class="tag dark">${fcfa(due)}</span></a></div></div>`;
};
handlers.filterReview = () => { S.af = 'review'; };

// ───────── Paiements
routes.paiements = async () => {
  const rows = must(await sb.from('payments').select('*, orders(number,total,reseller_id), subscriptions(reseller_id,plan)').eq('status', 'a_verifier').order('id'));
  const who = await names(rows.map((r) => (r.orders || r.subscriptions || {}).reseller_id));
  S.badgePay = rows.length;
  return `<div class="pad">${title('Paiements<br>à vérifier', rows.length + ' en attente')}
    <div class="stack" style="margin-top:16px">${rows.map((r) => { const o = r.orders || r.subscriptions || {}; const w = who[o.reseller_id] || {}; return `<a class="glass" style="padding:16px;display:block" href="#/paiement/${r.id}"><div class="row"><b>${r.kind === 'order' ? 'N° ' + esc(r.orders.number) : 'Abonnement'}</b><span class="mono">${esc(fmtDate(r.created_at))}</span></div><div style="font-size:13px;color:#667085;margin-top:4px">${esc(w.name || 'Revendeur')} · ${fcfa(r.amount_expected)}</div></a>`; }).join('') || '<div class="glass" style="padding:18px">Aucun paiement à vérifier.</div>'}</div></div>`;
};
const CHECKS = [['date_heure', 'Date et heure visibles'], ['montant', 'Montant conforme'], ['numero', 'Numéro destinataire correct'], ['reference', 'Référence de transaction notée (facultatif)']];
routes.paiement = async (id) => {
  id = Number(id);
  const p = must(await sb.from('payments').select('*, orders(number,total,reseller_id), subscriptions(reseller_id,plan)').eq('id', id).single());
  if (!S.checks || S.checks.id !== id) S.checks = { id, date_heure: false, montant: false, numero: false, reference: false };
  let url = '';
  if (p.proof_url) { const s = await sb.storage.from('preuves').createSignedUrl(p.proof_url, 900); url = (s.data || {}).signedUrl || ''; }
  const rid = (p.orders || p.subscriptions || {}).reseller_id;
  const w = (await names([rid]))[rid] || {};
  const ready = S.checks.date_heure && S.checks.montant && S.checks.numero;
  return `<div class="pad">${back('paiements')}<div class="mono">${p.kind === 'order' ? 'Commande' : 'Abonnement'}</div><h1 class="h1" style="font-size:30px;margin-top:6px">${p.kind === 'order' ? 'N° ' + esc(p.orders.number) : esc(label('mode', 'x') && 'Abonnement')}</h1>
    <div style="font-size:13px;color:#667085;margin-top:6px">${esc(w.name || '')} ${esc(w.phone || '')}</div>
    <div class="ph" style="margin-top:14px;min-height:220px;border-radius:20px">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Capture du paiement" style="max-height:420px;width:100%;object-fit:contain"></a>` : 'Aucune capture'}</div>
    <div class="kv" style="margin-top:12px"><span>Montant attendu</span><b>${fcfa(p.amount_expected)}</b></div>
    <div class="mono" style="margin:14px 0 6px">Contrôles</div>
    <div class="stack">${CHECKS.map(([k, l]) => `<button class="opt" style="min-height:56px" role="checkbox" aria-checked="${S.checks[k]}" data-act="toggleCheck" data-k="${k}"><span class="t1">${l}</span><span class="rad"><span class="dot"></span></span></button>`).join('')}</div>
    <div class="row" style="gap:10px;margin-top:16px"><button class="btn2" style="flex:1" data-act="reviewNo" data-id="${p.id}">Refuser</button><button class="btn" style="flex:1.4" data-act="reviewOk" data-id="${p.id}" ${ready ? '' : 'disabled'}>Valider</button></div></div>`;
};
handlers.toggleCheck = (el) => { S.checks[el.dataset.k] = !S.checks[el.dataset.k]; render(true); };
handlers.reviewOk = (el) => once('review', async () => {
  const { id: _i, ...checks } = S.checks;
  must(await sb.rpc('review_payment', { p_payment: Number(el.dataset.id), p_decision: 'valide', p_checks: checks, p_reason: null }));
  toast('Paiement validé'); go('/paiements');
});
handlers.reviewNo = (el) => once('review', async () => {
  const reason = prompt('Motif du refus ? (ex : date et heure absentes)');
  if (reason === null) return;
  const { id: _i, ...checks } = S.checks;
  must(await sb.rpc('review_payment', { p_payment: Number(el.dataset.id), p_decision: 'refuse', p_checks: checks, p_reason: reason || null }));
  toast('Paiement refusé : commande annulée et stock rendu'); go('/paiements');
});

// ───────── Commandes
const AF = { prep: 'À préparer', review: 'À vérifier', open: 'En cours', all: 'Toutes' };
S.af = S.af || 'prep';
routes.commandes = async () => {
  let q = sb.from('orders').select('*').order('id', { ascending: false }).limit(100);
  if (S.af === 'prep') q = q.eq('delivery_status', 'a_preparer').not('status', 'in', '(annulee,refusee)');
  if (S.af === 'review') q = q.eq('needs_review', true);
  if (S.af === 'open') q = q.in('status', ['recue', 'confirmee']);
  const [rows, bs] = await Promise.all([q.then(must), boutiquesList()]);
  const who = await names(rows.map((r) => r.reseller_id));
  const bn = Object.fromEntries(bs.map((b) => [b.id, b.name]));
  return `<div class="pad">${title('Commandes')}
    <div class="chips" style="margin-top:14px">${Object.entries(AF).map(([k, l]) => `<button class="chip" aria-pressed="${S.af === k}" data-act="setAf" data-v="${k}">${l}</button>`).join('')}</div>
    ${rows.map((r) => `<a class="glass" style="display:block;padding:16px;margin-top:12px" href="#/commande/${r.id}"><div class="row"><b>N° ${esc(r.number)} · ${esc((who[r.reseller_id] || {}).name || '')}</b><span class="mono">${esc(fmtDate(r.created_at))}</span></div><div style="font-size:13px;color:#667085;margin-top:4px">${esc(label('mode', r.delivery_mode))} · ${esc(bn[r.boutique_id] || '')} · ${fcfa(r.total)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${tag('commande', r.status)}${tag('livraison', r.delivery_status)}${tag('paiement', r.payment_status)}${r.needs_review ? '<span class="tag dark">À vérifier</span>' : ''}</div></a>`).join('') || '<div class="glass" style="padding:18px;margin-top:14px">Aucune commande.</div>'}</div>`;
};
handlers.setAf = (el) => { S.af = el.dataset.v; render(true); };

const DELIV = ['a_preparer', 'prete', 'en_attente_retrait', 'en_cours', 'livree', 'echouee', 'retour_en_cours'];
routes.commande = async (id) => {
  id = Number(id);
  const o = must(await sb.from('orders').select('*').eq('id', id).single());
  const [items, opts, pays, cols, bs] = await Promise.all([
    sb.from('order_items').select('*').eq('order_id', id).then(must),
    sb.from('order_options').select('*').eq('order_id', id).then(must),
    sb.from('payments').select('*').eq('order_id', id).then(must),
    sb.from('courier_collections').select('*').eq('order_id', id).then(must),
    boutiquesList(),
  ]);
  const vids = [...new Set(items.flatMap((i) => [i.variant_requested, i.variant_assigned]).filter(Boolean))];
  const vs = vids.length ? must(await sb.from('variants').select('*').in('id', vids)) : [];
  const ms = vs.length ? must(await sb.from('models').select('id,name').in('id', [...new Set(vs.map((v) => v.model_id))])) : [];
  const vname = (vid) => { const v = vs.find((x) => x.id === vid); const m = v && ms.find((x) => x.id === v.model_id); return m ? `${m.name} · ${v.color} · ${v.size}` : '—'; };
  const w = (await names([o.reseller_id]))[o.reseller_id] || {};
  const pay = pays[0], col = cols[0];
  const bn = (bs.find((b) => b.id === o.boutique_id) || {}).name || '';
  const cancellable = ['a_preparer', 'prete', 'en_attente_retrait'].includes(o.delivery_status) && !['annulee', 'refusee', 'terminee'].includes(o.status);
  const act = (a, text, cls = 'btn2') => `<button class="${cls}" data-act="${a}" data-order="${o.id}">${text}</button>`;
  return `<div class="pad">${back('commandes')}<div class="mono">Commande</div><h1 class="h1" style="font-size:30px;margin-top:6px">N° ${esc(o.number)}</h1>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${tag('commande', o.status)}${tag('livraison', o.delivery_status)}${tag('paiement', o.payment_status)}${o.needs_review ? '<span class="tag dark">À vérifier</span>' : ''}</div>
    <div class="sec">Articles</div>
    <div class="glass" style="padding:6px 18px">${items.map((i) => `<div class="kv"><span>Demandé : ${esc(vname(i.variant_requested))}${i.substituted ? `<br><b>À sortir : ${esc(vname(i.variant_assigned))}</b> <span class="tag dark">Remplacement</span>` : ''}</span><b>× ${i.qty}</b></div>`).join('')}${opts.map((x) => `<div class="kv"><span>${esc(x.kind)} ${esc(x.color || '')} ${esc(x.subtype || '')}</span><b>× ${x.qty}</b></div>`).join('')}<div class="kv"><span>Carton</span><b>${o.carton ? 'Oui' : 'Non'}</b></div></div>
    <div class="sec">Livraison</div>
    <div class="glass" style="padding:6px 18px"><div class="kv"><span>Revendeur</span><b>${esc(w.name || '')} ${esc(w.phone || '')}</b></div><div class="kv"><span>Mode</span><b>${esc(label('mode', o.delivery_mode))}</b></div><div class="kv"><span>Boutique</span><b>${esc(bn)}</b></div>${o.quartier ? `<div class="kv"><span>Quartier</span><b>${esc(o.quartier)}</b></div>` : ''}${o.client_phone ? `<div class="kv"><span>Client</span><b>${esc(o.client_phone)}</b></div>` : ''}${o.wished_time ? `<div class="kv"><span>Horaire</span><b>${esc(String(o.wished_time).slice(0, 5))}</b></div>` : ''}${o.address_hint ? `<div class="kv"><span>Repère</span><b>${esc(o.address_hint)}</b></div>` : ''}${o.instructions ? `<div class="kv"><span>Précisions</span><b>${esc(o.instructions)}</b></div>` : ''}</div>
    <div class="mono" style="margin:14px 0 6px">Statut de livraison</div>
    <div class="chips" style="flex-wrap:wrap">${DELIV.map((s) => `<button class="chip" aria-pressed="${o.delivery_status === s}" data-act="setDelivery" data-order="${o.id}" data-v="${s}">${esc(label('livraison', s))}</button>`).join('')}</div>
    <div class="sec">Paiement</div>
    <div class="glass" style="padding:6px 18px"><div class="kv"><span>Mode</span><b>${esc(pay ? pay.method : '—')}</b></div><div class="kv"><span>Chaussures</span><b>${fcfa(o.shoes_total)}</b></div><div class="kv"><span>Chaussettes et lacets</span><b>${fcfa(o.socks_total + o.laces_total)}</b></div>${o.service_fee ? `<div class="kv"><span>Frais de service</span><b>${fcfa(o.service_fee)}</b></div>` : ''}<div class="kv"><span>Total</span><b>${fcfa(o.total)}</b></div>${col ? `<div class="kv"><span>Encaissé par le livreur</span><b>${col.amount_collected == null ? 'Pas encore' : fcfa(col.amount_collected)}</b></div><div class="kv"><span>Reversé</span><b>${fcfa(col.amount_remitted)}</b></div>` : ''}</div>
    <div class="stack" style="margin-top:18px">
      ${pay && pay.method === 'especes' && pay.status !== 'paye' && o.status !== 'annulee' ? act('cashIn', 'Espèces reçues', 'btn') : ''}
      ${col && col.amount_collected == null ? act('courierPaid', 'Le livreur a encaissé', 'btn') : ''}
      ${col && col.amount_collected != null && col.amount_remitted < col.amount_collected ? `<button class="btn" data-act="remit" data-v="${col.id}" data-due="${col.amount_collected - col.amount_remitted}">Enregistrer un reversement</button>` : ''}
      ${o.needs_review ? act('resolve', 'Marquer comme vérifiée') : ''}
      ${o.payment_status === 'a_rembourser' ? act('refunded', 'Remboursement fait') : ''}
      ${['retour_en_cours', 'echouee'].includes(o.delivery_status) ? act('returnOk', 'Retour confirmé en boutique') : ''}
      ${o.courier_id ? act('courierMsg', 'Copier le message au livreur') : ''}
      ${cancellable ? `<button class="btn2" style="color:#B42318;border-color:rgba(180,35,24,.35)" data-act="cancelAdmin" data-order="${o.id}">Annuler la commande</button>` : ''}</div></div>`;
};
const rpcThen = (name, args, msg) => async () => { must(await sb.rpc(name, args)); toast(msg); render(true); };
handlers.setDelivery = (el) => once('o', rpcThen('set_delivery_status', { p_order: Number(el.dataset.order), p_status: el.dataset.v }, 'Statut mis à jour'));
handlers.cashIn = (el) => once('o', rpcThen('record_cash_payment', { p_order: Number(el.dataset.order) }, 'Espèces enregistrées'));
handlers.resolve = (el) => once('o', rpcThen('resolve_review', { p_order: Number(el.dataset.order) }, 'Commande vérifiée'));
handlers.refunded = (el) => once('o', rpcThen('mark_refunded', { p_order: Number(el.dataset.order) }, 'Remboursement noté'));
handlers.returnOk = (el) => once('o', rpcThen('confirm_return', { p_order: Number(el.dataset.order) }, 'Retour confirmé, stock rendu'));
handlers.courierPaid = (el) => once('o', async () => {
  const v = prompt('Montant encaissé par le livreur (FCFA)');
  if (v === null) return;
  const n = parseInt(v, 10);
  if (isNaN(n) || n <= 0) throw new Error('Montant invalide');
  must(await sb.rpc('record_courier_collection', { p_order: Number(el.dataset.order), p_amount: n }));
  toast('Encaissement noté'); render(true);
});
handlers.remit = (el) => once('o', async () => {
  const v = prompt('Montant reversé par le livreur (FCFA)', el.dataset.due);
  if (v === null) return;
  const n = parseInt(v, 10);
  if (isNaN(n) || n <= 0) throw new Error('Montant invalide');
  const left = must(await sb.rpc('record_remittance', { p_collection: Number(el.dataset.v), p_amount: n }));
  toast('Reversement noté. Reste : ' + fcfa(left)); render(true);
});
handlers.courierMsg = (el) => once('o', async () => { const m = must(await sb.rpc('courier_message', { p_order: Number(el.dataset.order) })); await copyText(m.text); });
handlers.cancelAdmin = (el) => once('o', async () => {
  if (!confirm('Annuler cette commande ?')) return;
  const r = must(await sb.rpc('cancel_order', { p_order: Number(el.dataset.order), p_reason: 'admin' }));
  toast(`Annulée. Remboursement : ${fcfa(r.refund)} · crédit client : ${fcfa(r.credit)}`); render(true);
});

// ───────── Stocks
routes.stocks = async () => {
  const [bs, ms, vs, st] = await Promise.all([
    boutiquesList(),
    sb.from('models').select('id,name').order('name').then(must),
    sb.from('variants').select('*').order('color').order('size').then(must),
    sb.from('stock').select('*').then(must),
  ]);
  const q = (S.sq || '').trim().toLowerCase();
  const qty = (v, b) => ((st.find((s) => s.variant_id === v && s.boutique_id === b) || {}).qty) || 0;
  const short = (n) => n.replace('Ancien ', '').replace('PK3 — ', '');
  const groups = ms.filter((m) => !q || m.name.toLowerCase().includes(q)).map((m) => ({ m, rows: vs.filter((v) => v.model_id === m.id) })).filter((g) => g.rows.length);
  return `<div class="pad">${title('Stocks', 'Quantités exactes · en direct')}
    <input class="inp" type="search" placeholder="Rechercher un modèle…" aria-label="Rechercher" value="${esc(S.sq || '')}" data-input-act="stockSearch" style="margin-top:14px">
    ${groups.map(({ m, rows }) => `<div class="glass" style="padding:14px 12px 8px;margin-top:12px"><div style="font-size:15px;font-weight:600;padding:0 6px 8px">${esc(m.name)}</div>
      <div style="display:grid;grid-template-columns:1.3fr repeat(${bs.length},1fr) 44px;gap:4px;align-items:center;padding:0 2px"><span class="mono" style="font-size:9px">Variante</span>${bs.map((b) => `<span class="mono" style="font-size:9px;text-align:center">${esc(short(b.name))}</span>`).join('')}<span class="mono" style="font-size:9px;text-align:center">Rempl.</span>
      ${rows.map((v) => `<span style="font-size:13px;font-weight:600">${esc(v.color)} · ${v.size}</span>${bs.map((b) => { const n = qty(v.id, b.id); return `<button class="chip" style="height:40px;padding:0;border-radius:12px;${n < 0 ? 'color:#B42318;border-color:#B42318' : n === 0 ? 'color:#98A0AE' : ''}" data-act="adjust" data-v="${v.id}" data-b="${b.id}" data-q="${n}" aria-label="Modifier le stock">${n}</button>`; }).join('')}<button class="sw" style="margin:0 auto" role="checkbox" aria-checked="${v.can_substitute}" aria-label="Peut remplacer les pointures voisines" data-act="toggleSub" data-v="${v.id}" data-cur="${v.can_substitute}"><span class="rad" style="${v.can_substitute ? 'background:#0A0C14;border-color:#0A0C14' : ''}"></span></button>`).join('')}</div></div>`).join('') || '<div class="glass" style="padding:18px;margin-top:14px">Aucune variante. Créez un modèle dans Plus, puis Produits.</div>'}
    <div style="font-size:12px;color:#667085;margin-top:14px;line-height:1.5">Touchez un chiffre pour le modifier. « Rempl. » : cette variante peut remplacer les pointures voisines (±1) quand elles manquent, sans que le revendeur le sache.</div></div>`;
};
handlers.stockSearch = (el) => { S.sq = el.value; clearTimeout(handlers.stockSearch._t); handlers.stockSearch._t = setTimeout(() => render(true), 350); };
handlers.adjust = (el) => once('o', async () => {
  const v = prompt(`Nouvelle quantité (actuelle : ${el.dataset.q})`, el.dataset.q);
  if (v === null) return;
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 0) throw new Error('Quantité invalide');
  must(await sb.rpc('adjust_stock', { p_variant: Number(el.dataset.v), p_boutique: Number(el.dataset.b), p_mode: 'set', p_qty: n }));
  toast('Stock enregistré'); render(true);
});
handlers.toggleSub = (el) => once('o', async () => {
  must(await sb.from('variants').update({ can_substitute: el.dataset.cur !== 'true' }).eq('id', Number(el.dataset.v)));
  render(true);
});

// ───────── Produits
routes.produits = async () => {
  const ms = must(await sb.from('models').select('*').order('name'));
  return `<div class="pad">${back('plus')}${title('Produits et<br>variantes', 'Ce que voient les revendeurs')}
    <div class="stack" style="margin-top:16px">${ms.map((m) => `<a class="glass" style="padding:16px;display:block" href="#/produit/${m.id}"><div class="row"><b>${esc(m.name)}</b><span class="tag ${m.published ? 'dark' : ''}">${m.published ? 'Publié' : 'Masqué'}</span></div><div style="font-size:13px;color:#667085;margin-top:4px">Réf. ${esc(m.ref || '—')} · ${fcfa(m.price_fcfa)}</div></a>`).join('') || '<div class="glass" style="padding:18px">Aucun modèle.</div>'}</div>
    <div class="bar" style="bottom:90px"><a class="btn" style="display:flex;align-items:center;justify-content:center" href="#/produit/new">Ajouter un modèle</a></div></div>`;
};
routes.produit = async (id) => {
  const isNew = id === 'new';
  let m = {}, vars = [], photos = [];
  if (!isNew) {
    m = must(await sb.from('models').select('*').eq('id', Number(id)).single());
    vars = must(await sb.from('variants').select('*').eq('model_id', m.id));
    photos = must(await sb.from('model_photos').select('*').eq('model_id', m.id));
  }
  if (!S.edit || S.edit.key !== String(id)) S.edit = { key: String(id), id: isNew ? null : m.id, name: m.name || '', ref: m.ref || '', category: m.category || '', description: m.description || '', price: m.price_fcfa ?? '', published: isNew ? true : m.published, colors: '', sizes: '', photoColor: '' };
  const e = S.edit;
  const fld = (k, l, type = 'text') => `<label class="mono" for="e_${k}">${l}</label><input class="inp" id="e_${k}" type="${type}" value="${esc(e[k])}" data-bind="edit.${k}">`;
  return `<div class="pad">${back('produits')}<div class="mono">Modèle</div><h1 class="h1" style="font-size:30px;margin-top:6px">${esc(e.name || 'Nouveau modèle')}</h1>
    ${fld('name', 'Nom du modèle')}${fld('ref', 'Référence interne')}${fld('category', 'Catégorie')}${fld('price', 'Prix, identique pour tous (FCFA)', 'number')}
    <label class="mono" for="e_description">Description</label><textarea class="inp" id="e_description" style="height:90px;padding:14px 16px;resize:none" data-bind="edit.description">${esc(e.description)}</textarea>
    <div class="glass" style="margin-top:14px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;min-height:64px"><div><div class="t1">Publié</div><div class="t2">Visible dans le catalogue</div></div><button class="chip" aria-pressed="${e.published}" data-act="togglePub">${e.published ? 'Oui' : 'Non'}</button></div>
    <div class="sec">Ajouter des variantes</div>
    <div style="font-size:13px;color:#667085;line-height:1.4">Séparez par des virgules. Chaque couleur × pointure crée une variante, à 0 en stock dans les 3 boutiques.</div>
    ${fld('colors', 'Couleurs (ex : Noir, Blanc)')}${fld('sizes', 'Pointures (ex : 40, 41, 42)')}
    ${vars.length ? `<div style="font-size:13px;color:#667085;margin-top:10px">${vars.length} variante(s) existante(s) : ${[...new Set(vars.map((v) => v.color))].map(esc).join(', ')}</div>` : ''}
    ${!isNew ? `<div class="sec">Photos réelles</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${photos.map((p) => `<div style="position:relative"><div class="ph" style="aspect-ratio:1/1;border-radius:16px"><img src="${esc(p.url)}" alt=""></div><button class="chip" style="position:absolute;right:4px;top:4px;height:30px;padding:0 10px" data-act="delPhoto" data-v="${p.id}">×</button></div>`).join('')}</div>
      ${fld('photoColor', 'Couleur de la photo (facultatif)')}
      <label class="drop" style="margin-top:10px;cursor:pointer" for="photoFile">Ajouter des photos</label><input id="photoFile" type="file" accept="image/*" multiple data-change-act="uploadPhotos">` : '<div style="font-size:13px;color:#667085;margin-top:14px">Enregistrez le modèle pour ajouter des photos.</div>'}
    </div><div class="bar" style="bottom:90px"><button class="btn" data-act="saveModel">Enregistrer</button></div>`;
};
handlers.togglePub = () => { S.edit.published = !S.edit.published; render(true); };
handlers.saveModel = () => once('save', async () => {
  const e = S.edit;
  if (!e.name.trim()) throw new Error('Indiquez le nom du modèle.');
  const price = parseInt(e.price, 10);
  if (isNaN(price) || price < 0) throw new Error('Prix invalide.');
  const row = { name: e.name.trim(), ref: e.ref || null, category: e.category || null, description: e.description || null, price_fcfa: price, published: e.published };
  let id = e.id;
  if (id) must(await sb.from('models').update(row).eq('id', id));
  else id = must(await sb.from('models').insert(row).select('id').single()).id;
  const colors = e.colors.split(',').map((x) => x.trim()).filter(Boolean);
  const sizes = e.sizes.split(',').map((x) => parseInt(x, 10)).filter((n) => !isNaN(n));
  if (colors.length && sizes.length) must(await sb.rpc('create_variants_for_model', { p_model: id, p_colors: colors, p_sizes: sizes }));
  S.edit = null; toast('Modèle enregistré');
  if (location.hash === '#/produit/' + id) await render(); else go('/produit/' + id);
});
handlers.uploadPhotos = (el) => once('photo', async () => {
  const e = S.edit;
  if (!e || !e.id) throw new Error('Enregistrez d’abord le modèle.');
  for (const f of el.files) {
    const path = `${e.id}/${Date.now()}-${f.name.replace(/[^a-z0-9.]/gi, '_')}`;
    must(await sb.storage.from('photos').upload(path, f, { contentType: f.type || 'image/jpeg' }));
    const { data } = sb.storage.from('photos').getPublicUrl(path);
    must(await sb.from('model_photos').insert({ model_id: e.id, color: e.photoColor || null, url: data.publicUrl }));
  }
  toast('Photos ajoutées'); render(true);
});
handlers.delPhoto = (el) => once('photo', async () => { must(await sb.from('model_photos').delete().eq('id', Number(el.dataset.v))); render(true); });

// ───────── Livreurs
routes.livreurs = async () => {
  const rows = must(await sb.from('couriers').select('*').order('name'));
  if (!S.nc) S.nc = { name: '', whatsapp: '', zones: '' };
  return `<div class="pad">${back('plus')}${title('Livreurs', 'Proposés aux revendeurs')}
    <div class="stack" style="margin-top:16px">${rows.map((c) => `<div class="glass" style="padding:16px"><div class="row"><div><b>${esc(c.name)}</b><div style="font-size:13px;color:#667085;margin-top:2px">${esc(c.whatsapp)} · ${esc((c.zones || []).join(', '))}</div></div><button class="chip" aria-pressed="${c.active}" data-act="toggleCourier" data-v="${c.id}" data-cur="${c.active}">${c.active ? 'Actif' : 'Inactif'}</button></div></div>`).join('') || '<div class="glass" style="padding:18px">Aucun livreur.</div>'}</div>
    <div class="sec">Ajouter un livreur</div>
    <label class="mono" for="n1">Nom</label><input class="inp" id="n1" value="${esc(S.nc.name)}" data-bind="nc.name">
    <label class="mono" for="n2">Numéro WhatsApp (avec +229)</label><input class="inp" id="n2" type="tel" value="${esc(S.nc.whatsapp)}" data-bind="nc.whatsapp">
    <label class="mono" for="n3">Quartiers desservis (séparés par des virgules)</label><input class="inp" id="n3" value="${esc(S.nc.zones)}" data-bind="nc.zones">
    <button class="btn" style="margin-top:16px" data-act="addCourier">Ajouter le livreur</button></div>`;
};
handlers.addCourier = () => once('o', async () => {
  const c = S.nc;
  if (!c.name.trim() || !c.whatsapp.trim()) throw new Error('Indiquez le nom et le numéro WhatsApp.');
  must(await sb.from('couriers').insert({ name: c.name.trim(), whatsapp: c.whatsapp.trim(), zones: c.zones.split(',').map((x) => x.trim()).filter(Boolean) }));
  S.nc = null; toast('Livreur ajouté'); render(true);
});
handlers.toggleCourier = (el) => once('o', async () => { must(await sb.from('couriers').update({ active: el.dataset.cur !== 'true' }).eq('id', Number(el.dataset.v))); render(true); });

// ───────── Reversements
routes.reversements = async () => {
  const rows = must(await sb.from('courier_collections').select('*, couriers(name), orders(number)').not('amount_collected', 'is', null).order('id', { ascending: false }));
  const byC = {};
  rows.forEach((r) => { const n = (r.couriers || {}).name || 'Livreur'; (byC[n] ||= []).push(r); });
  const total = rows.reduce((t, r) => t + (r.amount_collected - r.amount_remitted), 0);
  return `<div class="pad">${back('plus')}${title('Reverse-<br>ments', 'Sommes encaissées par les livreurs')}
    <div class="glass" style="padding:18px;margin-top:16px"><div class="mono">Total à reverser</div><div style="font-size:34px;font-weight:600;letter-spacing:-1px;margin-top:8px">${fcfa(total)}</div></div>
    ${Object.entries(byC).map(([n, list]) => { const due = list.reduce((t, r) => t + (r.amount_collected - r.amount_remitted), 0); return `<div class="glass" style="padding:16px;margin-top:12px"><div class="row"><b style="font-size:17px">${esc(n)}</b><span class="tag ${due ? 'dark' : ''}">${due ? 'Solde dû' : 'À jour'}</span></div><div class="kv" style="margin-top:6px"><span>Reste à reverser</span><b>${fcfa(due)}</b></div>${list.filter((r) => r.amount_collected > r.amount_remitted).map((r) => `<div class="row" style="margin-top:8px"><span style="font-size:13px">N° ${esc((r.orders || {}).number || '')} · reste ${fcfa(r.amount_collected - r.amount_remitted)}</span><button class="chip" data-act="remit" data-v="${r.id}" data-due="${r.amount_collected - r.amount_remitted}">Reversement</button></div>`).join('')}</div>`; }).join('')}</div>`;
};

// ───────── Plus
routes.plus = async () => `<div class="pad">${title('Plus', 'Gestion de la plateforme')}
  <div class="glass" style="padding:0 18px;margin-top:16px">
    ${[['produits', 'Produits et variantes', 'Modèles, couleurs, pointures, photos'], ['livreurs', 'Livreurs', 'Ajouter et gérer les livreurs'], ['reversements', 'Reversements', 'Sommes encaissées par les livreurs']].map(([k, t, d], i) => `<a class="row" style="min-height:72px;${i ? 'border-top:1px solid rgba(10,12,20,.07)' : ''}" href="#/${k}"><span><span class="t1">${t}</span><span class="t2">${d}</span></span><span>›</span></a>`).join('')}
    ${[['Revendeurs', 'Comptes et abonnements'], ['Zones et frais de livraison', 'Quartiers et tarifs'], ['Utilisateurs et horaires', 'Boutiques, administrateurs, équipe'], ['Réglages', 'Prix, bêta, priorité de substitution']].map(([t, d]) => `<div class="row" style="min-height:72px;border-top:1px solid rgba(10,12,20,.07);opacity:.5"><span><span class="t1">${t}</span><span class="t2">${d} · bientôt</span></span></div>`).join('')}</div>
  <button class="btn2" style="margin-top:22px" data-act="logout">Se déconnecter</button></div>`;
