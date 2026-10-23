import nodemailer from 'nodemailer';

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

const API_URL = required('BETA_API_URL');
const API_TOKEN = required('BETA_API_TOKEN');
const NOTIFY_TO = required('NOTIFY_TO', 'info@dblast.it');

async function api(params) {
  const url = new URL(API_URL);
  url.searchParams.set('token', API_TOKEN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`API HTTP ${response.status}`);

  const data = await response.json();
  if (data.ok === false) throw new Error(`API: ${data.error || 'errore'}`);
  return data;
}

function transport() {
  return nodemailer.createTransport({
    host: required('ZOHO_HOST', 'smtp.zoho.eu'),
    port: Number(required('ZOHO_PORT', '465')),
    secure: (process.env.ZOHO_SECURE || 'true') !== 'false',
    auth: { user: required('ZOHO_USER'), pass: required('ZOHO_PASS') }
  });
}

function buildBody(pending) {
  const rows = pending.map((entry) => {
    const parts = [`- ${entry.nome || '(senza nome)'} <${entry.email}>`, entry.database || '-'];
    if (entry.note) parts.push(`note: ${entry.note}`);
    return parts.join(' · ');
  });

  return [
    `${pending.length} nuove iscrizioni alla beta dall'ultimo controllo.`,
    '',
    ...rows,
    '',
    `Report generato il ${new Date().toISOString()}`
  ].join('\n');
}

async function main() {
  const { pending } = await api({ action: 'pending' });

  if (!pending.length) {
    console.log('Nessuna nuova iscrizione: nessuna email inviata.');
    return;
  }

  await transport().sendMail({
    from: required('MAIL_FROM', `DBlast <${NOTIFY_TO}>`),
    to: NOTIFY_TO,
    subject: `[DBlast] ${pending.length} nuove iscrizioni beta`,
    text: buildBody(pending)
  });

  // Segna come notificate solo dopo l'invio riuscito: un errore non perde iscrizioni.
  await api({ action: 'ack', rows: pending.map((entry) => entry.row).join(',') });
  console.log(`${pending.length} nuove iscrizioni notificate.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
