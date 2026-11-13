'use strict';

/**
 * Lecture et vérification du fichier .env.
 * Si une variable obligatoire manque, le serveur refuse de démarrer avec un message clair.
 */
const path = require('path');
const Joi = require('joi');

require('dotenv').config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../.env'), quiet: true });

const { value: env, error } = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  APP_URL: Joi.string().uri().default('http://localhost:3001'),
  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  MAIL_TRANSPORT: Joi.string().valid('smtp', 'json').default('smtp'),
  SMTP_HOST: Joi.string().when('MAIL_TRANSPORT', { is: 'smtp', then: Joi.required() }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow(''),
  SMTP_PASS: Joi.string().allow(''),
  MAIL_FROM: Joi.string().default('ShopSphere <no-reply@shopsphere.local>'),
  EMAIL_VERIFICATION_HOURS: Joi.number().integer().min(1).default(24),
  PASSWORD_RESET_MINUTES: Joi.number().integer().min(5).default(30),
  MAX_FAILED_LOGINS: Joi.number().integer().min(3).default(5),
  MAX_SESSIONS: Joi.number().integer().min(1).max(50).default(10),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(5).default(50),
  TWO_FACTOR_MINUTES: Joi.number().integer().min(1).max(30).default(10),
  CAPTCHA_ENABLED: Joi.boolean().default(true)
})
  .unknown(true)
  .validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Fichier .env invalide :\n${error.details.map((d) => `  - ${d.message}`).join('\n')}`);
}

const appUrl = new URL(env.APP_URL);

module.exports = Object.freeze({
  env: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  mongoUri: env.MONGODB_URI,
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
  mail: {
    transport: env.MAIL_TRANSPORT,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM
  },
  emailVerificationHours: env.EMAIL_VERIFICATION_HOURS,
  passwordResetMinutes: env.PASSWORD_RESET_MINUTES,
  maxFailedLogins: env.MAX_FAILED_LOGINS,
  maxSessions: env.MAX_SESSIONS,
  rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
  twoFactorMinutes: env.TWO_FACTOR_MINUTES,
  twoFactorMaxAttempts: 5,
  captchaEnabled: env.CAPTCHA_ENABLED,
  // Face ID (WebAuthn) : lié au domaine de APP_URL (ex. "localhost")
  webauthn: { rpName: 'ShopSphere Admin', rpId: appUrl.hostname, origin: appUrl.origin },
  bcryptRounds: env.NODE_ENV === 'test' ? 4 : 12
});
