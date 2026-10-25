/**
 * Riceve le iscrizioni alla beta dal modulo su www.dblast.it/iscrizione,
 * le salva nel foglio Google e manda un'email di notifica a info@dblast.it.
 *
 * Questo file NON viene eseguito dal sito: va copiato in Google Apps Script.
 *
 * Installazione (una volta sola):
 *  1. Apri il foglio Google delle iscrizioni (o creane uno nuovo) con l'account
 *     che deve inviare le email.
 *  2. Estensioni > Apps Script. Cancella il codice di esempio e incolla tutto questo file.
 *  3. Controlla le impostazioni qui sotto (NOTIFY_TO, SEND_CONFIRMATION).
 *  4. Esegui > seleziona la funzione "test" > Esegui. Google chiede le autorizzazioni
 *     (foglio + invio email): accetta. Deve arrivare un'email di prova e comparire
 *     una riga nel foglio "Iscrizioni sito" (poi cancellala).
 *  5. Esegui il deployment > Nuovo deployment > tipo "App web".
 *     - Esegui come: Me
 *     - Chi ha accesso: Chiunque
 *  6. Copia l'URL che finisce con /exec e incollalo nell'attributo action del
 *     modulo in iscrizione.html, al posto di
 *     https://script.google.com/macros/s/INCOLLA_QUI_ID_DEPLOYMENT/exec
 *
 * Se modifichi questo codice: Esegui il deployment > Gestisci deployment >
 * matita > Versione: "Nuova versione" > Esegui il deployment. L'URL resta lo stesso.
 *
 * Limiti di Google (account gratuito): circa 100 email al giorno.
 */

// Chi riceve la notifica a ogni iscrizione (più indirizzi separati da virgola).
var NOTIFY_TO = 'info@dblast.it';

// true = manda anche un'email di conferma a chi si iscrive. Parte dall'account
// Google che ha fatto il deployment, con "rispondi a" info@dblast.it.
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

  MailApp.sendEmail({
    to: NOTIFY_TO,
    replyTo: email,
    subject: '[DBlast] Nuova iscrizione alla beta: ' + nome,
    body: 'Nuova iscrizione dal sito.\n\n' +
      'Nome: ' + nome + '\n' +
      'Email: ' + email + '\n' +
      'Database: ' + (databases || '-') + '\n' +
      'Altro: ' + (altro || '-') + '\n\n' +
      'Foglio: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  });

  if (SEND_CONFIRMATION) {
    MailApp.sendEmail({
      to: email,
      replyTo: 'info@dblast.it',
      name: 'DBlast',
      subject: 'Sei nella lista della beta di DBlast',
      body: 'Ciao ' + nome + ',\n\n' +
        'grazie per l\'iscrizione alla closed beta di DBlast. Ti scriveremo appena la prima versione sarà pronta da provare.\n\n' +
        'Se non hai fatto tu questa iscrizione o vuoi cancellare i tuoi dati, rispondi a questa email.\n\n' +
        'Il team DBlast\nhttps://www.dblast.it'
    });
  }

  return reply(ajax, true);
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
function test() {
  var res = doPost({
    parameter: { nome: 'Prova', email: 'prova@example.com', eta: 'si', consenso: 'si', ajax: '1' },
    parameters: { database: ['PostgreSQL', 'Oracle'] }
  });
  Logger.log(res.getContent());
}
