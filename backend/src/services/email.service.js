const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass || !env.smtpFromEmail) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  return transporter;
}

function formatTrainingType(trainingType) {
  const labels = {
    technical: 'Technický',
    tactical: 'Taktický',
    physical: 'Kondičný',
    friendly: 'Priateľský'
  };

  return labels[trainingType] || trainingType;
}

function formatTrainingCategory(trainingCategory) {
  const labels = {
    pripravky: 'Prípravky',
    ziaci: 'Žiaci',
    dorastenci: 'Dorastenci',
    adults_young: 'Dospelí - Mladí',
    adults_pro: 'Dospelí - Skúsení'
  };

  return labels[trainingCategory] || trainingCategory;
}

async function sendTrainingCreatedEmails({ training, recipients, createdByUsername }) {
  if (!env.emailNotificationsEnabled) {
    return { sent: 0, skipped: 'disabled' };
  }

  if (!recipients || !recipients.length) {
    return { sent: 0, skipped: 'no_recipients' };
  }

  const mailer = getTransporter();
  if (!mailer) {
    return { sent: 0, skipped: 'smtp_not_configured' };
  }

  const recipientAddresses = recipients
    .map((recipient) => (recipient.email || '').trim())
    .filter(Boolean);

  if (!recipientAddresses.length) {
    return { sent: 0, skipped: 'no_valid_emails' };
  }

  const subject = `OŠK: Nový tréning pre kategóriu ${formatTrainingCategory(training.category)}`;
  const text = [
    'Ahoj,',
    '',
    'bol vytvorený nový tréning.',
    '',
    `Dátum: ${training.date}`,
    `Čas: ${training.time}`,
    `Typ: ${formatTrainingType(training.type)}`,
    `Trvanie: ${training.duration} min`,
    `Kategória: ${formatTrainingCategory(training.category)}`,
    `Vytvoril: ${createdByUsername}`,
    '',
    'Prihlás sa do klubového systému pre potvrdenie účasti.',
    '',
    'OŠK Kamenná Poruba'
  ].join('\n');

  await mailer.sendMail({
    from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
    to: env.smtpFromEmail,
    bcc: recipientAddresses,
    subject,
    text
  });

  return { sent: recipientAddresses.length, skipped: null };
}

module.exports = {
  sendTrainingCreatedEmails
};
