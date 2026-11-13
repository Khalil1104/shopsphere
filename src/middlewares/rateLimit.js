'use strict';

const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');

/** Limite les tentatives (login, mot de passe oublié...) pour bloquer le brute-force. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : config.rateLimitAuthMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives, réessayez dans 15 minutes' })
});

module.exports = { authLimiter };
