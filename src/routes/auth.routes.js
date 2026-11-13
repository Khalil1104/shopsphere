'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');
const { auth: v } = require('../validators/schemas');
const { resetForm, wantsHtml } = require('../utils/page');

const router = Router();

router.post('/register', authLimiter, validate(v.register), ctrl.register);
router.post('/login', authLimiter, validate(v.login), ctrl.loginClient);
router.post('/admin/login', authLimiter, validate(v.login), ctrl.loginAdmin);
router.get('/me', authenticate, ctrl.me);

// --- Double authentification (code par e-mail) ---
router.post('/2fa/verify', authLimiter, validate(v.twoFactorVerify), ctrl.verifyTwoFactor);
router.post('/2fa/enable', authenticate, validate(v.twoFactorToggle), ctrl.enableTwoFactor);
router.post('/2fa/disable', authenticate, validate(v.twoFactorToggle), ctrl.disableTwoFactor);

// --- Sessions (stockées dans le compte, pas de collection en plus) ---
router.get('/sessions', authenticate, ctrl.listSessions);
router.delete('/sessions/:sid', authenticate, validate(v.sessionId), ctrl.closeSession);
router.post('/logout', authenticate, ctrl.logout);
router.post('/logout-all', authenticate, ctrl.logoutAll);

router.get('/verify-email', validate(v.verifyEmail), ctrl.verifyEmail);
router.post('/resend-verification', authLimiter, validate(v.emailOnly), ctrl.resendVerification);

router.post('/forgot-password', authLimiter, validate(v.forgotPassword), ctrl.forgotPassword);
router.get('/reset-password', ctrl.showResetForm);
router.post('/reset-password', authLimiter, validate(v.resetPassword), ctrl.resetPassword);

// Formulaire envoyé depuis le navigateur : en cas d'erreur, on réaffiche le formulaire avec le message.
router.use('/reset-password', (err, req, res, next) => {
  if (!wantsHtml(req) || !req.body || !req.body.token) return next(err);
  const detail = err.details && err.details[0] ? err.details[0].message : err.message;
  return res.status(err.status || 400).send(resetForm(req.body.token, req.body.type === 'admin' ? 'admin' : 'client', detail));
});

module.exports = router;
