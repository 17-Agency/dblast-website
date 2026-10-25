/**
 * Riceve le iscrizioni alla beta dal modulo su www.dblast.it/iscrizione,
 * le salva nel foglio Google e manda un'email di notifica a info@dblast.it.
 *
 * Le email NON partono dall'account Google che ospita il foglio: le invia
 * Resend (resend.com) da noreply@dblast.it. L'account Google serve solo
 * per il foglio e per far girare questo script.
 *
 * Questo file NON viene eseguito dal sito: va copiato in Google Apps Script.
 *
 * Installazione (una volta sola):
 *  1. Resend: crea un account gratuito su resend.com, aggiungi il dominio
 *     dblast.it (Domains > Add domain) e inserisci nel DNS di dblast.it i record
 *     che ti mostra. Non toccano Zoho: la posta in arrivo resta com'è.
 *     Quando il dominio risulta "Verified", crea una API key con permesso
 *     "Sending access" (API Keys > Create API key) e copiala.
 *  2. Apri il foglio Google delle iscrizioni (o creane uno nuovo).
 *     Estensioni > Apps Script. Cancella il codice di esempio e incolla tutto questo file.
 *  3. Impostazioni progetto (icona ingranaggio) > Proprietà script > Aggiungi:
 *     proprietà RESEND_API_KEY, valore = la chiave copiata al punto 1.
 *     La chiave NON va scritta in questo file (che è pubblico nel repository del sito).
 *  4. Esegui > seleziona la funzione "test" > Esegui. Google chiede le autorizzazioni
 *     (foglio + connessione a servizi esterni): accetta. Deve arrivare un'email di
 *     prova a info@dblast.it e comparire una riga nel foglio "Iscrizioni sito"
 *     (poi cancellala).
 *  5. Esegui il deployment > Nuovo deployment > tipo "App web".
 *     - Esegui come: Me
 *     - Chi ha accesso: Chiunque
 *  6. Copia l'URL che finisce con /exec e incollalo nell'attributo action del
 *     modulo in iscrizione.html, al posto di
 *     https://script.google.com/macros/s/INCOLLA_QUI_ID_DEPLOYMENT/exec
 *
 * Se modifichi questo codice: Esegui il deployment > Gestisci deployment >
 * matita > Versione: "Nuova versione" > Esegui il deployment. L'URL resta lo stesso.
 */

// Chi riceve la notifica a ogni iscrizione.
var NOTIFY_TO = ['info@dblast.it'];

// Mittente delle email (il dominio deve essere verificato su Resend).
var FROM = 'DBlast <noreply@dblast.it>';

// true = manda anche un'email di conferma a chi si iscrive, da FROM con
// "rispondi a" info@dblast.it.
var SEND_CONFIRMATION = false;

// Nome del foglio (tab) in cui salvare le iscrizioni. Se non esiste viene creato.
var SHEET_NAME = 'Iscrizioni sito';

var HEADERS = ['Data', 'Nome', 'Email', 'Database', 'Altro database', 'Età 14+', 'Consenso'];

function doPost(e) {
  var p = e.parameter || {};
  var ajax = p.ajax === '1';

  // Campo trappola: le persone non lo vedono, i bot lo riempiono.
  // Rispondiamo "ok" per non dare indizi, ma non salviamo nulla.
  if (p.sito) return reply(ajax, true);

  var nome = clean(p.nome, 100);
  var email = clean(p.email, 200).toLowerCase();
  var databases = (e.parameters.database || []).map(function (d) { return clean(d, 50); }).join(', ');
  var altro = clean(p.altro, 200);

  if (!nome) return reply(ajax, false, 'Inserisci il tuo nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(ajax, false, 'Controlla l\'indirizzo email.');
  if (p.eta !== 'si') return reply(ajax, false, 'L\'iscrizione è riservata a chi ha almeno 14 anni.');
  if (p.consenso !== 'si') return reply(ajax, false, 'Per iscriverti serve il consenso al trattamento dei dati.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    sheet.appendRow([new Date(), cell(nome), cell(email), cell(databases), cell(altro), 'sì', 'sì']);
  } finally {
    lock.releaseLock();
  }

  // L'iscrizione è già salvata: se l'email non parte la registriamo nei log
  // (Esecuzioni) ma rispondiamo comunque "ok" a chi si è iscritto.
  try {
    sendEmail({
      to: NOTIFY_TO,
      reply_to: email,
      subject: '[DBlast] Nuova iscrizione alla beta: ' + nome,
      text: 'Nuova iscrizione dal sito.\n\n' +
        'Nome: ' + nome + '\n' +
        'Email: ' + email + '\n' +
        'Database: ' + (databases || '-') + '\n' +
        'Altro: ' + (altro || '-') + '\n'
    });

    if (SEND_CONFIRMATION) {
      sendEmail({
        to: [email],
        reply_to: 'info@dblast.it',
        subject: 'Sei nella lista della beta di DBlast',
        text: 'Ciao ' + nome + ',\n\n' +
          'grazie per l\'iscrizione alla closed beta di DBlast. Ti scriveremo appena la prima versione sarà pronta da provare.\n\n' +
          'Se non hai fatto tu questa iscrizione o vuoi cancellare i tuoi dati, rispondi a questa email.\n\n' +
          'Il team DBlast\nhttps://www.dblast.it'
      });
    }
  } catch (err) {
    console.error('Invio email non riuscito: ' + err);
  }

  return reply(ajax, true);
}

// Invia un'email tramite l'API di Resend.
function sendEmail(message) {
  var key = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
  if (!key) throw new Error('Manca la proprietà script RESEND_API_KEY.');
  message.from = FROM;
  var res = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify(message),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Resend ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clean(value, max) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

// Evita che un testo che inizia con = + - @ venga interpretato come formula nel foglio.
function cell(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function reply(ajax, ok, error) {
  if (ajax) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: ok, error: error || null }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Senza JavaScript il browser arriva qui direttamente: mostriamo una pagina semplice.
  var msg = ok
    ? '<h1>Grazie!</h1><p>Sei nella lista: ti scriveremo appena la beta di DBlast sarà pronta.</p>'
    : '<h1>Iscrizione non inviata</h1><p>' + error + '</p>';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px">' +
    msg + '<p><a href="https://www.dblast.it/" target="_top">Torna a dblast.it</a></p></div>'
  ).setTitle('DBlast');
}

// Prova manuale dall'editor di Apps Script (Esegui > test).
// A differenza di doPost, qui un errore di invio email viene mostrato.
function test() {
  sendEmail({ to: NOTIFY_TO, subject: '[DBlast] Prova notifiche iscrizioni', text: 'Se leggi questa email, le notifiche funzionano.' });
  var res = doPost({
    parameter: { nome: 'Prova', email: 'prova@example.com', eta: 'si', consenso: 'si', ajax: '1' },
    parameters: { database: ['PostgreSQL', 'Oracle'] }
  });
  Logger.log(res.getContent());
}
