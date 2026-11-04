import { sb, S, handlers, view, toast } from './core.js';
import { esc, friendlyError } from './lib.js';
import { loadAccount } from './core.js';

const val = (id) => (document.getElementById(id) || {}).value || '';

export function showLogin(message = '') {
  document.getElementById('nav').hidden = true;
  const up = S.authMode === 'up';
  view().innerHTML = `<div class="pad">
    <h1 class="h1" style="margin-top:20px">Connexion</h1>
    <div class="mono" style="margin-top:10px">Revendeurs OFFSTEP</div>
    ${message ? `<div class="glass" style="padding:14px 16px;margin-top:16px;font-size:14px;line-height:1.45">${esc(message)}</div>` : ''}
    <button class="btn" style="margin-top:22px" data-act="google">Continuer avec Google</button>
    <div class="mono" style="text-align:center;margin:18px 0">ou avec votre e-mail</div>
    ${up ? `<label class="mono" for="nm">Nom</label><input class="inp" id="nm" autocomplete="name"><label class="mono" for="ph">Téléphone</label><input class="inp" id="ph" type="tel" autocomplete="tel">` : ''}
    <label class="mono" for="em">E-mail</label><input class="inp" id="em" type="email" autocomplete="email">
    <label class="mono" for="pw">Mot de passe</label><input class="inp" id="pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}">
    <button class="btn2" style="margin-top:18px" data-act="${up ? 'emailSignup' : 'emailLogin'}">${up ? 'Créer mon compte' : 'Me connecter'}</button>
    <button style="margin-top:8px;border:0;background:transparent;font-size:14px;font-weight:600;min-height:44px;width:100%" data-act="toggleAuth">${up ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
  </div>`;
}

handlers.google = async () => {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
};
handlers.toggleAuth = () => { S.authMode = S.authMode === 'up' ? 'in' : 'up'; showLogin(); };
handlers.emailLogin = async () => {
  const { error } = await sb.auth.signInWithPassword({ email: val('em').trim(), password: val('pw') });
  if (error) throw error;
  location.reload();
};
handlers.emailSignup = async () => {
  const name = val('nm').trim(), phone = val('ph').trim();
  if (!name || !phone) throw new Error('Indiquez votre nom et votre téléphone.');
  const { error } = await sb.auth.signUp({ email: val('em').trim(), password: val('pw'), options: { data: { name, phone }, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  S.authMode = 'in';
  showLogin('Un e-mail de confirmation vient de vous être envoyé. Ouvrez le lien, puis connectez-vous.');
};
handlers.logout = async () => { await sb.auth.signOut(); location.hash = ''; location.reload(); };

function notice(title, text, extra = '') {
  document.getElementById('nav').hidden = true;
  view().innerHTML = `<div class="pad"><h1 class="h1" style="margin-top:20px">${esc(title)}</h1><div class="glass" style="padding:18px;margin-top:18px;line-height:1.5">${text}</div>${extra}<button class="btn2" style="margin-top:16px" data-act="logout">Se déconnecter</button></div>`;
}

// Retourne true si l'utilisateur est un revendeur actif prêt à utiliser l'application
export async function startSession() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { showLogin(); return false; }
  S.session = data.session;
  const md = data.session.user.user_metadata || {};
  const claim = await sb.rpc('claim_profile', { p_name: md.name || md.full_name || null, p_phone: md.phone || null });
  if (claim.error) { await sb.auth.signOut(); showLogin(friendlyError(claim.error.message)); return false; }
  const { data: prof } = await sb.from('profiles').select('*').eq('auth_user_id', data.session.user.id).maybeSingle();
  if (!prof || !prof.active) { notice('Compte indisponible', 'Ce compte est désactivé. Contactez OFFSTEP.'); return false; }
  S.profile = prof;
  if (prof.role !== 'revendeur') {
    notice('Compte administration', 'Ce compte n’est pas un compte revendeur. Utilisez l’application <b>Administration</b> ou <b>OFFSTEP NOTES</b>.',
      '<a class="btn" style="margin-top:16px;display:flex;align-items:center;justify-content:center" href="./admin.html">Administration</a><a class="btn2" style="margin-top:10px;display:flex;align-items:center;justify-content:center" href="./notes.html">OFFSTEP NOTES</a>');
    return false;
  }
  await loadAccount();
  return true;
}
