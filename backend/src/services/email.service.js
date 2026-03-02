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

function getTrainingNoteLine(training) {
  const note = String(training?.note || '').trim();
  return note || 'Bez poznámky';
}

function normalizeRecipientAddresses(recipients) {
  const unique = new Set();

  (Array.isArray(recipients) ? recipients : [])
    .map((recipient) => String(recipient?.email || '').trim().toLowerCase())
    .filter(Boolean)
    .forEach((email) => unique.add(email));

  return Array.from(unique);
}

async function sendToRecipients(mailer, recipientAddresses, messageFactory) {
  const jobs = recipientAddresses.map((recipientEmail) =>
    mailer.sendMail({
      ...messageFactory(recipientEmail),
      to: recipientEmail
    })
  );

  const results = await Promise.allSettled(jobs);
  const sent = results.filter((result) => result.status === 'fulfilled').length;
  return { sent, skipped: sent > 0 ? null : 'send_failed' };
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

  const recipientAddresses = normalizeRecipientAddresses(recipients);

  if (!recipientAddresses.length) {
    return { sent: 0, skipped: 'no_valid_emails' };
  }

  const categoryLabel = formatTrainingCategory(training.category);
  const subject = `OŠK: Nový tréning (${categoryLabel}) ${training.date} ${training.time}`;
  const trainingNote = getTrainingNoteLine(training);
  const text = [
    'Ahoj,',
    '',
    'bol vytvorený nový tréning pre tvoju skupinu.',
    '',
    `Kategória: ${categoryLabel}`,
    `Dátum: ${training.date}`,
    `Čas: ${training.time}`,
    `Typ: ${formatTrainingType(training.type)}`,
    `Trvanie: ${training.duration} min`,
    `Poznámka: ${trainingNote}`,
    `Vytvoril: ${createdByUsername}`,
    '',
    'Prihlás sa do klubového systému pre potvrdenie účasti.',
    '',
    'OŠK Kamenná Poruba'
  ].join('\n');

  return sendToRecipients(mailer, recipientAddresses, () => ({
    from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
    subject,
    text
  }));
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

  const recipientAddresses = normalizeRecipientAddresses(recipients);

  if (!recipientAddresses.length) {
    return { sent: 0, skipped: 'no_valid_emails' };
  }

  const normalizedChanges = Array.isArray(changes)
    ? changes.map((change) => String(change || '').trim()).filter(Boolean)
    : [];

  const changesSection = normalizedChanges.length
    ? normalizedChanges.map((change) => `- ${change}`).join('\n')
    : '- Bez detailov';

  const categoryLabel = formatTrainingCategory(training.category);
  const subject = `OŠK: Zmena tréningu (${categoryLabel}) ${training.date} ${training.time}`;
  const trainingNote = getTrainingNoteLine(training);
  const text = [
    'Ahoj,',
    '',
    'tréning pre tvoju skupinu bol upravený. Zmeny nájdeš nižšie.',
    '',
    `Kategória: ${categoryLabel}`,
    `Dátum: ${training.date}`,
    `Čas: ${training.time}`,
    `Typ: ${formatTrainingType(training.type)}`,
    `Trvanie: ${training.duration} min`,
    `Poznámka: ${trainingNote}`,
    `Upravil: ${updatedByUsername}`,
    '',
    'Čo sa zmenilo:',
    changesSection,
    '',
    'Prihlás sa do klubového systému pre aktuálne informácie.',
    '',
    'OŠK Kamenná Poruba'
  ].join('\n');

  return sendToRecipients(mailer, recipientAddresses, () => ({
    from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
    subject,
    text
  }));
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
