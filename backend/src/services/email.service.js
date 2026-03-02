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

async function sendTrainingUpdatedEmails({ training, recipients, updatedByUsername, changes }) {
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

  const normalizedChanges = Array.isArray(changes)
    ? changes.map((change) => String(change || '').trim()).filter(Boolean)
    : [];

  const changesSection = normalizedChanges.length
    ? normalizedChanges.map((change) => `- ${change}`).join('\n')
    : '- Bez detailov';

  const subject = `OŠK: Zmena tréningu pre kategóriu ${formatTrainingCategory(training.category)}`;
  const text = [
    'Ahoj,',
    '',
    'tréning bol upravený. Zmeny nájdeš nižšie.',
    '',
    `Dátum: ${training.date}`,
    `Čas: ${training.time}`,
    `Typ: ${formatTrainingType(training.type)}`,
    `Trvanie: ${training.duration} min`,
    `Kategória: ${formatTrainingCategory(training.category)}`,
    `Upravil: ${updatedByUsername}`,
    '',
    'Čo sa zmenilo:',
    changesSection,
    '',
    'Prihlás sa do klubového systému pre aktuálne informácie.',
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

async function sendContactFormEmail({ name, email, message }) {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error('SMTP nie je nakonfigurované');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const recipient = String(env.contactFormToEmail || env.smtpFromEmail || '').trim();
  if (!recipient) {
    const error = new Error('Príjemca kontaktnej správy nie je nastavený');
    error.code = 'CONTACT_RECIPIENT_NOT_CONFIGURED';
    throw error;
  }

  const safeName = String(name || '').trim();
  const safeEmail = String(email || '').trim();
  const safeMessage = String(message || '').trim();

  await mailer.sendMail({
    from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
    to: recipient,
    replyTo: safeEmail,
    subject: `OŠK web: Nová kontaktná správa od ${safeName}`,
    text: [
      'Prišla nová správa z formulára na webe OŠK.',
      '',
      `Meno: ${safeName}`,
      `Email: ${safeEmail}`,
      '',
      'Správa:',
      safeMessage,
      '',
      `Odoslané: ${new Date().toISOString()}`
    ].join('\n')
  });
}

module.exports = {
  sendTrainingCreatedEmails,
  sendTrainingUpdatedEmails,
  sendContactFormEmail
};
