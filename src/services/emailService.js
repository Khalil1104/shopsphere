'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env');
const templates = require('../templates/emails');

/**
 * Envoi des e-mails avec Nodemailer.
 *  - MAIL_TRANSPORT=smtp : envoi réel (Gmail...)
 *  - MAIL_TRANSPORT=json : rien n'est envoyé, le message est gardé dans "outbox" (tests)
 * Un échec d'envoi ne fait jamais échouer l'opération (inscription, etc.) : il est affiché dans la console.
 */
const outbox = [];
let transporter;

function getTransporter() {
  if (!transporter) {
    transporter =
      config.mail.transport === 'json'
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({
            host: config.mail.host,
            port: config.mail.port,
            secure: config.mail.secure,
            auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined
          });
  }
  return transporter;
}

async function send(template, to, data) {
  const { subject, html, text } = templates[template](data);
  try {
    await getTransporter().sendMail({ from: config.mail.from, to, subject, html, text });
    if (config.mail.transport === 'json') outbox.push({ template, to, subject, html, text });
    else console.log(`E-mail "${template}" envoyé à ${to}`);
    return true;
  } catch (err) {
    console.error(`Échec d'envoi de l'e-mail "${template}" à ${to} : ${err.message}`);
    return false;
  }
}

async function verifySmtp() {
  if (config.mail.transport !== 'smtp') return;
  try {
    await getTransporter().verify();
    console.log('SMTP prêt');
  } catch (err) {
    console.error(`SMTP indisponible : ${err.message} (vérifiez SMTP_USER / SMTP_PASS dans .env)`);
  }
}

module.exports = {
  outbox,
  verifySmtp,
  sendWelcome: (user) => send('welcome', user.email, { firstName: user.firstName }),
  sendVerification: (user, token) =>
    send('verification', user.email, {
      firstName: user.firstName,
      link: `${config.appUrl}/api/auth/verify-email?token=${token}`,
      hours: config.emailVerificationHours
    }),
  sendPasswordReset: (user, token, type) =>
    send('passwordReset', user.email, {
      firstName: user.firstName,
      link: `${config.appUrl}/api/auth/reset-password?token=${token}&type=${type}`,
      minutes: config.passwordResetMinutes
    }),
  sendAutoSuspended: (user, token, type) =>
    send('autoSuspended', user.email, {
      firstName: user.firstName,
      attempts: config.maxFailedLogins,
      link: `${config.appUrl}/api/auth/reset-password?token=${token}&type=${type}`,
      minutes: config.passwordResetMinutes
    }),
  sendVerificationReminder: (user, token) =>
    send('verificationReminder', user.email, {
      firstName: user.firstName,
      link: `${config.appUrl}/api/auth/verify-email?token=${token}`,
      hours: config.emailVerificationHours
    }),
  sendDailyReport: (admin, stats) => send('dailyReport', admin.email, { firstName: admin.firstName, stats, dashboardUrl: `${config.appUrl}/admin` }),
  sendSecurityAlert: (admin, event) =>
    send('securityAlert', admin.email, {
      firstName: admin.firstName,
      event,
      link: `${config.appUrl}/admin/${event.type === 'admin' ? 'admins' : 'clients'}/${event.id}`
    }),
  sendStatusChanged: (user, status, reason) => send('statusChanged', user.email, { firstName: user.firstName, status, reason }),
  sendTwoFactorCode: (user, code) => send('twoFactorCode', user.email, { firstName: user.firstName, code, minutes: config.twoFactorMinutes }),
  sendSecurityNotice: (user, title, text) => send('securityNotice', user.email, { firstName: user.firstName, title, text })
};
