'use strict';

/**
 * Modèles d'e-mails. Chaque fonction renvoie { subject, html, text }.
 * Toutes les valeurs dynamiques passent par esc() (anti-injection HTML).
 */
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ title, body, button, color = '#2563eb' }) {
  const btn = button
    ? `<p style="text-align:center;margin:28px 0"><a href="${esc(button.url)}" style="background:${color};color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${esc(button.label)}</a></p>
       <p style="font-size:12px;color:#6b7280">Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all">${esc(button.url)}</span></p>`
    : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0f172a;padding:18px 28px;color:#fff;font-size:20px;font-weight:700">ShopSphere</td></tr>
      <tr><td style="height:4px;background:${color}"></td></tr>
      <tr><td style="padding:28px">
        <h1 style="font-size:22px;margin:0 0 16px">${esc(title)}</h1>
        ${body}
        ${btn}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#6b7280">Cet e-mail a été envoyé automatiquement par ShopSphere. Merci de ne pas y répondre.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const p = (text) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${text}</p>`;

module.exports = {
  welcome: ({ firstName }) => ({
    subject: 'Bienvenue sur ShopSphere 🎉',
    html: layout({
      title: `Bienvenue, ${firstName} !`,
      color: '#059669',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p('Votre compte ShopSphere a bien été créé. Merci de nous avoir rejoints !') +
        p('Pensez à confirmer votre adresse e-mail grâce au lien que nous venons de vous envoyer : c\'est obligatoire pour passer commande.')
    }),
    text: `Bonjour ${firstName},\nVotre compte ShopSphere a bien été créé. Confirmez votre adresse e-mail pour pouvoir commander.`
  }),

  verification: ({ firstName, link, hours }) => ({
    subject: 'Confirmez votre adresse e-mail',
    html: layout({
      title: 'Confirmez votre adresse e-mail',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p('Cliquez sur le bouton ci-dessous pour activer votre compte.') +
        p(`Ce lien est valable <strong>${esc(hours)} heures</strong>.`),
      button: { label: 'Confirmer mon adresse', url: link }
    }),
    text: `Bonjour ${firstName},\nConfirmez votre adresse e-mail (lien valable ${hours} h) :\n${link}`
  }),

  passwordReset: ({ firstName, link, minutes }) => ({
    subject: 'Réinitialisation de votre mot de passe',
    html: layout({
      title: 'Mot de passe oublié ?',
      color: '#d97706',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p('Nous avons reçu une demande de réinitialisation de votre mot de passe.') +
        p(`Ce lien est valable <strong>${esc(minutes)} minutes</strong> et ne peut être utilisé qu'une fois.`) +
        p("Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe ne changera pas."),
      button: { label: 'Choisir un nouveau mot de passe', url: link }
    }),
    text: `Bonjour ${firstName},\nRéinitialisez votre mot de passe (lien valable ${minutes} min) :\n${link}`
  }),

  verificationReminder: ({ firstName, link, hours }) => ({
    subject: 'Il ne reste qu\'une étape pour activer votre compte',
    html: layout({
      title: 'Votre adresse n\'est pas encore confirmée',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p('Vous avez créé votre compte ShopSphere mais votre adresse e-mail n\'est pas encore confirmée. Sans cette étape, vous ne pourrez pas passer commande.') +
        p(`Voici un nouveau lien, valable <strong>${esc(hours)} heures</strong>.`),
      button: { label: 'Confirmer mon adresse', url: link }
    }),
    text: `Bonjour ${firstName},\nConfirmez votre adresse e-mail pour pouvoir commander :\n${link}`
  }),

  dailyReport: ({ firstName, stats, dashboardUrl }) => {
    const days = stats.registrationsPerDay;
    const yesterday = days[days.length - 2] || { count: 0, date: '' };
    const row = (label, value) =>
      `<tr><td style="padding:9px 14px;border-bottom:1px solid #eef0f3;color:#475569;font-size:14px">${esc(label)}</td><td style="padding:9px 14px;border-bottom:1px solid #eef0f3;text-align:right;font-weight:600;font-size:14px">${esc(value)}</td></tr>`;
    return {
      subject: `ShopSphere — rapport du ${yesterday.date}`,
      html: layout({
        title: 'Rapport quotidien',
        color: '#0f766e',
        body:
          p(`Bonjour ${esc(firstName)}, voici l'activité de ShopSphere.`) +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f3;border-radius:10px;margin:8px 0 16px">
            ${row(`Inscriptions le ${yesterday.date}`, yesterday.count)}
            ${row('Inscriptions sur 7 jours', stats.clients.newLast7Days)}
            ${row('Clients au total', stats.clients.total)}
            ${row('Adresses vérifiées', `${stats.clients.verified} (${stats.clients.verifiedRate} %)`)}
            ${row('Comptes suspendus', stats.clients.suspended)}
            ${row('Sessions actives', stats.sessions.active)}
          </table>`,
        button: { label: 'Ouvrir le tableau de bord', url: dashboardUrl }
      }),
      text: `Rapport ShopSphere : ${yesterday.count} inscription(s) le ${yesterday.date}, ${stats.clients.total} clients, ${stats.clients.suspended} suspendu(s).`
    };
  },

  securityAlert: ({ firstName, event, link }) => ({
    subject: `Alerte sécurité : compte suspendu (${event.email})`,
    html: layout({
      title: 'Compte suspendu automatiquement',
      color: '#dc2626',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p(`Le compte ${event.type === 'admin' ? 'administrateur' : 'client'} <strong>${esc(event.name)}</strong> (${esc(event.email)}) vient d'être suspendu après 5 mots de passe incorrects.`) +
        p("Le titulaire a reçu un lien pour réactiver son compte. Si ces tentatives vous semblent suspectes, laissez le compte suspendu."),
      button: { label: 'Voir le compte', url: link, }
    }),
    text: `Le compte ${event.email} a été suspendu après 5 mots de passe incorrects.\n${link}`
  }),

  autoSuspended: ({ firstName, attempts, link, minutes }) => ({
    subject: 'Votre compte a été suspendu (tentatives de connexion)',
    html: layout({
      title: 'Compte suspendu par sécurité',
      color: '#dc2626',
      body:
        p(`Bonjour ${esc(firstName)},`) +
        p(`Nous avons détecté <strong>${esc(attempts)} tentatives de connexion</strong> avec un mot de passe incorrect sur votre compte. Par sécurité, il a été <strong>suspendu</strong> et toutes vos sessions ont été fermées.`) +
        p(`Si c'était vous, choisissez un nouveau mot de passe : votre compte sera réactivé immédiatement. Ce lien est valable ${esc(minutes)} minutes.`) +
        p("Si ce n'était pas vous, quelqu'un essaie peut-être d'accéder à votre compte : choisissez un mot de passe que vous n'utilisez nulle part ailleurs."),
      button: { label: 'Réactiver mon compte', url: link }
    }),
    text: `Bonjour ${firstName},\nVotre compte a été suspendu après ${attempts} tentatives de connexion échouées.\nRéactivez-le en choisissant un nouveau mot de passe (lien valable ${minutes} min) :\n${link}`
  }),

  statusChanged: ({ firstName, status, reason }) => {
    const suspended = status === 'SUSPENDED';
    return {
      subject: suspended ? 'Votre compte a été suspendu' : 'Votre compte a été réactivé',
      html: layout({
        title: suspended ? 'Compte suspendu' : 'Compte réactivé',
        color: suspended ? '#dc2626' : '#059669',
        body:
          p(`Bonjour ${esc(firstName)},`) +
          (suspended
            ? p("Votre compte ShopSphere a été suspendu par un administrateur. Vous ne pouvez plus vous connecter pour l'instant.") +
              (reason ? p(`<strong>Motif :</strong> ${esc(reason)}`) : '') +
              p('Contactez le support si vous pensez qu\'il s\'agit d\'une erreur.')
            : p('Bonne nouvelle : votre compte ShopSphere est de nouveau actif. Vous pouvez vous reconnecter.'))
      }),
      text: suspended
        ? `Bonjour ${firstName},\nVotre compte a été suspendu.${reason ? ` Motif : ${reason}` : ''}`
        : `Bonjour ${firstName},\nVotre compte est de nouveau actif.`
    };
  }
};
