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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTrainingNoteLine(training) {
  const note = String(training?.note || '').trim();
  return note || 'Bez poznámky';
}

function buildHiddenPreheader(text) {
  const safeText = escapeHtml(String(text || '').trim());
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;">${safeText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`;
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

function buildTrainingEmailHtml({
  introTitle,
  introText,
  training,
  categoryLabel,
  actorLabel,
  actorValue,
  changesHtml
}) {
  const note = getTrainingNoteLine(training);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5eaf3;overflow:hidden;">
      <tr>
        <td style="background:#003399;padding:20px 24px;">
          <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#ffd700;font-weight:700;">OŠK Kamenná Poruba</div>
          <div style="font-size:26px;line-height:1.2;font-weight:800;color:#ffffff;margin-top:6px;">${escapeHtml(introTitle)}</div>
          <div style="font-size:14px;color:#dbe7ff;margin-top:8px;">${escapeHtml(introText)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px;">
          <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:10px;">Detaily tréningu</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
            <tr><td style="padding:8px 0;color:#5f6b7a;width:160px;">Kategória</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(categoryLabel)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Dátum</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.date)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Čas</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.time)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Typ</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(formatTrainingType(training.type))}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Trvanie</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.duration)} min</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Poznámka</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(note)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">${escapeHtml(actorLabel)}</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(actorValue)}</td></tr>
          </table>
          ${changesHtml || ''}
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <div style="background:#f0f5ff;border:1px solid #d8e5ff;border-radius:10px;padding:14px 16px;color:#20304d;font-size:14px;line-height:1.45;">
            Prosím, prihlás sa do klubového systému a potvrď účasť.
            <a href="https://osk-kamenna-poruba.vercel.app" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#003399;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">Přejít do systému</a>
          </div>
        </td>
      </tr>
    </table>
  </div>`;
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
    text,
    html: buildTrainingEmailHtml({
      introTitle: 'NOVÝ TRÉNING',
      introText: 'Bol vytvorený nový tréning pre tvoju skupinu.',
      training,
      categoryLabel,
      actorLabel: 'Vytvoril',
      actorValue: createdByUsername
    })
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
  const changesHtml = normalizedChanges.length
    ? `
      <div style="margin-top:16px;">
        <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:8px;">Čo sa zmenilo</div>
        <ul style="margin:0;padding-left:20px;color:#1b2330;font-size:14px;line-height:1.5;">
          ${normalizedChanges.map((change) => `<li style="margin:4px 0;">${escapeHtml(change)}</li>`).join('')}
        </ul>
      </div>`
    : '';

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
    text,
    html: buildTrainingEmailHtml({
      introTitle: 'ÚPRAVA TRÉNINGU',
      introText: 'Tréning pre tvoju skupinu bol upravený.',
      training,
      categoryLabel,
      actorLabel: 'Upravil',
      actorValue: updatedByUsername,
      changesHtml
    })
  }));
}

function buildSubtrainingAssignmentHtml({
  training,
  categoryLabel,
  assignedByUsername,
  recipientUsername,
  groupName,
  groupTime,
  groupCapacity,
  preheaderText
}) {
  const note = getTrainingNoteLine(training);
  const groupTimeLine = groupTime ? `<tr><td style="padding:8px 0;color:#5f6b7a;width:170px;">Čas podtréningu</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(groupTime)}</td></tr>` : '';
  const capacityLine = groupCapacity ? `<tr><td style="padding:8px 0;color:#5f6b7a;">Kapacita podtréningu</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(groupCapacity)}</td></tr>` : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;padding:24px;color:#1a1a1a;">
    ${buildHiddenPreheader(preheaderText)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5eaf3;overflow:hidden;">
      <tr>
        <td style="background:#003399;padding:20px 24px;">
          <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#ffd700;font-weight:700;">OŠK Kamenná Poruba</div>
          <div style="font-size:26px;line-height:1.2;font-weight:800;color:#ffffff;margin-top:6px;">PODTRÉNING PRIRADENÝ</div>
          <div style="font-size:14px;color:#dbe7ff;margin-top:8px;">Ahoj ${escapeHtml(recipientUsername)}, tréner ti priradil podtréning s presným časom.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px;">
          <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:10px;">Detaily tréningu</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
            <tr><td style="padding:8px 0;color:#5f6b7a;width:170px;">Kategória</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(categoryLabel)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Dátum</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.date)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Hlavný čas tréningu</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.time)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Podtréning</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(groupName)}</td></tr>
            ${groupTimeLine}
            ${capacityLine}
            <tr><td style="padding:8px 0;color:#5f6b7a;">Typ</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(formatTrainingType(training.type))}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Trvanie</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(training.duration)} min</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Poznámka</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(note)}</td></tr>
            <tr><td style="padding:8px 0;color:#5f6b7a;">Priradil tréner</td><td style="padding:8px 0;font-weight:700;color:#1b2330;">${escapeHtml(assignedByUsername)}</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <div style="background:#f0f5ff;border:1px solid #d8e5ff;border-radius:10px;padding:14px 16px;color:#20304d;font-size:14px;line-height:1.45;">
            Skontroluj dochádzku v klubovom systéme.
            <a href="https://osk-kamenna-poruba.vercel.app/pages/trainings.html" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#003399;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">Otvoriť tréningy</a>
          </div>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendSubtrainingAssignedEmails({ training, assignments, assignedByUsername }) {
  if (!env.emailNotificationsEnabled) {
    return { sent: 0, skipped: 'disabled' };
  }

  if (!Array.isArray(assignments) || !assignments.length) {
    return { sent: 0, skipped: 'no_recipients' };
  }

  const mailer = getTransporter();
  if (!mailer) {
    return { sent: 0, skipped: 'smtp_not_configured' };
  }

  const categoryLabel = formatTrainingCategory(training.category);
  const jobs = assignments.map((assignment) => {
    const recipientEmail = String(assignment.email || '').trim().toLowerCase();
    if (!recipientEmail) {
      return Promise.resolve({ skipped: true });
    }

    const groupTime = assignment.groupStartTime && assignment.groupEndTime
      ? `${assignment.groupStartTime} - ${assignment.groupEndTime}`
      : '';
    const capacity = Number.isInteger(Number(assignment.groupMaxPlayers)) && Number(assignment.groupMaxPlayers) > 0
      ? String(assignment.groupMaxPlayers)
      : '';
    const previewLine = `${assignment.groupName}${groupTime ? ` (${groupTime})` : ''}, ${training.date}`;
    const subject = `OŠK: Podtréning ${previewLine}`;
    const text = [
      `Podtréning: ${previewLine}.`,
      '',
      `Ahoj ${assignment.playerUsername},`,
      '',
      'tréner priradil podtréning pre tvoj najbližší tréning.',
      '',
      `Kategória: ${categoryLabel}`,
      `Dátum: ${training.date}`,
      `Hlavný čas tréningu: ${training.time}`,
      groupTime ? `Čas podtréningu: ${groupTime}` : '',
      `Typ: ${formatTrainingType(training.type)}`,
      `Trvanie: ${training.duration} min`,
      `Priradil tréner: ${assignedByUsername}`,
      '',
      'Skontroluj dochádzku v klubovom systéme.',
      '',
      'OŠK Kamenná Poruba'
    ].filter(Boolean).join('\n');

    return mailer.sendMail({
      from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
      to: recipientEmail,
      subject,
      text,
      html: buildSubtrainingAssignmentHtml({
        training,
        categoryLabel,
        assignedByUsername,
        recipientUsername: assignment.playerUsername,
        groupName: assignment.groupName,
        groupTime,
        groupCapacity: capacity,
        preheaderText: `Podtréning: ${previewLine}`
      })
    });
  });

  const results = await Promise.allSettled(jobs);
  const sent = results.filter((result) => result.status === 'fulfilled').length;
  return { sent, skipped: sent > 0 ? null : 'send_failed' };
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
  sendSubtrainingAssignedEmails,
  sendContactFormEmail
};
