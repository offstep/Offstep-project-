// Fonction Edge « send-push » : envoie les notifications push non envoyées d'une commande.
// Secrets à créer (Edge Functions › Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex. mailto:vous@exemple.com).
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY existent déjà.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!pub || !priv) return json({ ok: false, error: 'vapid_missing' }, 500);
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@offstep.app', pub, priv);
    const db = createClient(url, srk, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.order_id) || null;

    // Qui appelle ? (le service lui-même, le personnel, ou un revendeur pour SES commandes seulement)
    let staff = token === srk, caller: { id: string } | null = null;
    if (!staff) {
      const { data: u, error } = await db.auth.getUser(token);
      if (error || !u.user) return json({ error: 'unauthorized' }, 401);
      let { data: p } = await db.from('profiles').select('id, role').eq('id', u.user.id).maybeSingle();
      if (!p && u.user.email) ({ data: p } = await db.from('profiles').select('id, role').ilike('email', u.user.email).maybeSingle());
      if (!p) return json({ error: 'forbidden' }, 403);
      caller = p; staff = ['admin', 'admin_limite', 'boutique'].includes(p.role);
    }
    let q = db.from('notifications').select('id').is('push_sent_at', null).gt('created_at', new Date(Date.now() - 6 * 3600e3).toISOString());
    if (orderId) q = q.eq('order_id', orderId);
    if (!staff) {
      const { data: mine } = await db.from('orders').select('id').eq('reseller_id', caller!.id).order('id', { ascending: false }).limit(20);
      const ids = (mine || []).map((o) => o.id);
      if (!ids.length || (orderId && !ids.includes(orderId))) return json({ ok: true, sent: 0 });
      q = q.in('order_id', ids);
    }
    const { data: cand } = await q.limit(200);
    if (!cand || !cand.length) return json({ ok: true, sent: 0 });
    // Réservation atomique : deux appels simultanés n'envoient jamais deux fois
    const { data: claimed } = await db.from('notifications').update({ push_sent_at: new Date().toISOString() })
      .in('id', cand.map((c) => c.id)).is('push_sent_at', null).select('id, profile_id, title, body, url');
    if (!claimed || !claimed.length) return json({ ok: true, sent: 0 });
    const { data: subs } = await db.from('push_subscriptions').select('id, profile_id, endpoint, p256dh, auth').in('profile_id', [...new Set(claimed.map((n) => n.profile_id))]);
    let sent = 0, failed = 0; const dead: number[] = [];
    for (const n of claimed) {
      for (const s of (subs || []).filter((x) => x.profile_id === n.profile_id)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: 'n' + n.id }), { TTL: 3600 });
          sent++;
        } catch (e) { failed++; const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) dead.push(s.id); }
      }
    }
    if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
    return json({ ok: true, sent, failed });
  } catch (e) { return json({ ok: false, error: String((e as Error).message || e) }, 500); }
});
