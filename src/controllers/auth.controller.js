'use strict';

const authService = require('../services/authService');
const sessionService = require('../services/sessionService');
const { message, resetForm, wantsHtml } = require('../utils/page');

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

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
    const { token, sessionId, expiresAt, user } = await authService.login('client', req.body, ctxOf(req));
    res.json({ message: 'Connexion réussie', token, sessionId, expiresAt, client: user });
  },

  /** POST /api/auth/admin/login */
  async loginAdmin(req, res) {
    const { token, sessionId, expiresAt, user } = await authService.login('admin', req.body, ctxOf(req));
    res.json({ message: 'Connexion réussie', token, sessionId, expiresAt, admin: user });
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
