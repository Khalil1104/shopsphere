const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Sans SMTP_HOST, le mail est simplement affiché dans la console (mode démo)
const sendMail = async ({ to, subject, text }) => {
  if (!transporter) {
    console.log(`[MAIL simulé] À : ${to}\nObjet : ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'ShopSphere <no-reply@shopsphere.tn>',
    to, subject, text
  });
};

module.exports = { sendMail };
