'use strict';

const authService = require('../services/authService');
const sessionService = require('../services/sessionService');
const { message, resetForm, wantsHtml } = require('../utils/page');

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

/** Réponse de connexion : soit le jeton, soit "code envoyé par e-mail" si la 2FA est active. */
function sendLogin(res, type, result) {
  if (result.twoFactorRequired) {
    return res.json({
      message: 'Code de connexion envoyé par e-mail.',
      twoFactorRequired: true,
      challengeToken: result.challengeToken,
      expiresAt: result.expiresAt
    });
  }
  const { token, sessionId, expiresAt, user } = result;
  return res.json({ message: 'Connexion réussie', token, sessionId, expiresAt, [type]: user });
}

const GENERIC = "Si un compte correspond à cette adresse, un e-mail vient d'être envoyé.";

module.exports = {
  /** POST /api/auth/register : inscription d'un client. */
  async register(req, res) {
    const client = await authService.createClient(req.body);
    res.status(201).json({
      message: 'Compte créé. Un e-mail de bienvenue et un lien de vérification ont été envoyés.',
      client
    });
  },

  /** POST /api/auth/login (client) */
  async loginClient(req, res) {
    sendLogin(res, 'client', await authService.login('client', req.body, ctxOf(req)));
  },

  /** POST /api/auth/admin/login */
  async loginAdmin(req, res) {
    sendLogin(res, 'admin', await authService.login('admin', req.body, ctxOf(req)));
  },

  // --- Double authentification ---
  /** POST /api/auth/2fa/verify : code reçu par e-mail + challengeToken → jeton de session. */
  async verifyTwoFactor(req, res) {
    const result = await authService.verifyTwoFactor(req.body, ctxOf(req));
    sendLogin(res, result.type, result);
  },

  /** POST /api/auth/2fa/enable et /disable (mot de passe demandé). */
  async enableTwoFactor(req, res) {
    await authService.setTwoFactor(req.auth.type, req.auth.id, { password: req.body.password, enabled: true });
    res.json({ message: 'Double authentification activée : un code vous sera envoyé par e-mail à chaque connexion.', twoFactorEnabled: true });
  },

  async disableTwoFactor(req, res) {
    await authService.setTwoFactor(req.auth.type, req.auth.id, { password: req.body.password, enabled: false });
    res.json({ message: 'Double authentification désactivée.', twoFactorEnabled: false });
  },

  /** GET /api/auth/me : utilisateur du jeton. */
  async me(req, res) {
    res.json({ type: req.auth.type, sessionId: req.auth.sid, user: req.user });
  },

  // --- Sessions (appareils connectés) ---
  /** GET /api/auth/sessions */
  async listSessions(req, res) {
    const items = await sessionService.list(req.auth.id, req.auth.type, req.auth.sid);
    res.json({ total: items.length, items });
  },

  /** DELETE /api/auth/sessions/:sid : déconnecte un appareil. */
  async closeSession(req, res) {
    await sessionService.close(req.auth.id, req.auth.type, req.params.sid);
    res.status(204).end();
  },

  /** POST /api/auth/logout : ferme la session de ce jeton (le jeton devient inutilisable). */
  async logout(req, res) {
    await sessionService.close(req.auth.id, req.auth.type, req.auth.sid);
    res.json({ message: 'Déconnexion réussie' });
  },

  /** POST /api/auth/logout-all : ferme toutes les sessions du compte. */
  async logoutAll(req, res) {
    const closed = await sessionService.closeAll(req.auth.id, req.auth.type);
    res.json({ message: 'Toutes les sessions ont été fermées', closedSessions: closed });
  },

  /** GET /api/auth/verify-email?token=... : lien cliqué dans l'e-mail. */
  async verifyEmail(req, res) {
    try {
      const client = await authService.verifyEmail(req.validated.query.token);
      if (wantsHtml(req)) return res.send(message('Adresse vérifiée ✔', `Merci ${client.firstName}, votre adresse e-mail est confirmée. Vous pouvez fermer cette page.`));
      return res.json({ message: 'Adresse e-mail vérifiée', email: client.email });
    } catch (err) {
      if (wantsHtml(req)) return res.status(400).send(message('Lien invalide', err.message, false));
      throw err;
    }
  },

  async resendVerification(req, res) {
    await authService.resendVerification(req.body.email);
    res.json({ message: GENERIC });
  },

  async forgotPassword(req, res) {
    await authService.forgotPassword(req.body);
    res.json({ message: GENERIC });
  },

  /** GET /api/auth/reset-password?token=...&type=... : formulaire ouvert depuis l'e-mail. */
  showResetForm(req, res) {
    res.send(resetForm(String(req.query.token || ''), req.query.type === 'admin' ? 'admin' : 'client'));
  },

  /** POST /api/auth/reset-password : JSON (Postman) ou formulaire (navigateur). */
  async resetPassword(req, res) {
    const { reactivated } = await authService.resetPassword(req.body);
    const text = reactivated
      ? 'Votre compte est réactivé. Vous pouvez vous connecter avec votre nouveau mot de passe.'
      : 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe. Vos autres appareils ont été déconnectés.';
    if (wantsHtml(req)) return res.send(message('Mot de passe modifié ✔', text));
    return res.json({ message: text, reactivated });
  }
};
