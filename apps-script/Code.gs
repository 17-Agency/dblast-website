/**
 * Riceve i moduli del sito www.dblast.it:
 *  - iscrizione alla beta (/iscrizione): salva l'iscrizione nel foglio Google e
 *    manda un'email di notifica a info@dblast.it;
 *  - modulo di contatto (/contatti): non salva nulla, inoltra il messaggio via email
 *    a supporto@dblast.it (supporto) o a info@dblast.it (tutto il resto).
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
 *  2. Apri il foglio Google delle iscrizioni (quello con la tabella delle risposte
 *     e le colonne "Informazioni cronologiche", "Email", "Nome", "Che database usi?",
 *     "Ho letto l'informativa privacy..."). Le colonne vengono riconosciute dal nome,
 *     quindi l'ordine non conta, ma i nomi non vanno cambiati.
 *     Estensioni > Apps Script. Cancella il codice di esempio e incolla tutto questo file.
 *  3. Impostazioni progetto (icona ingranaggio) > Proprietà script > Aggiungi:
 *     proprietà RESEND_API_KEY, valore = la chiave copiata al punto 1.
 *     La chiave NON va scritta in questo file (che è pubblico nel repository del sito).
 *  4. Esegui > seleziona la funzione "test" > Esegui. Google chiede le autorizzazioni
 *     (foglio + connessione a servizi esterni): accetta. Deve arrivare un'email di
 *     prova a info@dblast.it e comparire una riga "Prova" in fondo alla tabella
 *     (poi cancellala).
 *  5. Esegui il deployment > Nuovo deployment > tipo "App web".
 *     - Esegui come: Me
 *     - Chi ha accesso: Chiunque
 *  6. Copia l'URL che finisce con /exec e incollalo nell'attributo action del
 *     modulo in iscrizione.html, al posto di
 *     https://script.google.com/macros/s/INCOLLA_QUI_ID_DEPLOYMENT/exec
 *
 * Se modifichi questo codice (o lo sostituisci con una versione nuova di questo file):
 * Esegui il deployment > Gestisci deployment > matita > Versione: "Nuova versione"
 * > Esegui il deployment. L'URL resta lo stesso e non va cambiato sul sito.
 */

// Chi riceve la notifica a ogni iscrizione.
var NOTIFY_TO = ['info@dblast.it'];

// Argomenti del modulo di contatto: etichetta nell'oggetto dell'email e destinatari.
var TOPICS = {
  supporto: { label: 'Supporto', to: ['supporto@dblast.it'] },
  collaborazione: { label: 'Progetto / collaborazione', to: ['info@dblast.it'] },
  altro: { label: 'Contatto generale', to: ['info@dblast.it'] }
};

// Mittente delle email (il dominio deve essere verificato su Resend).
var FROM = 'DBlast <noreply@dblast.it>';

// true = manda anche un'email di conferma a chi si iscrive, da FROM con
// "rispondi a" info@dblast.it.
var SEND_CONFIRMATION = false;

// Colonne della tabella, riconosciute dall'inizio dell'intestazione.
var COLUMNS = {
  data: 'Informazioni cronologiche',
  email: 'Email',
  nome: 'Nome',
  database: 'Che database usi',
  consenso: 'Ho letto'
};

function doPost(e) {
  var p = e.parameter || {};
  var ajax = p.ajax === '1';

  // Campo trappola: le persone non lo vedono, i bot lo riempiono.
  // Rispondiamo "ok" per non dare indizi, ma non salviamo nulla.
  if (p.sito) return reply(ajax, true);

  if (p.form === 'contatto') return doContact(p, ajax);

  var nome = clean(p.nome, 100);
  var email = clean(p.email, 200).toLowerCase();
  var databases = (e.parameters.database || []).map(function (d) { return clean(d, 50); });
  var altro = clean(p.altro, 200);
  if (altro) databases.push('Altro: ' + altro);
  databases = databases.join(', ');

  if (!nome) return reply(ajax, false, 'Inserisci il tuo nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(ajax, false, 'Controlla l\'indirizzo email.');
  if (p.eta !== 'si') return reply(ajax, false, 'L\'iscrizione è riservata a chi ha almeno 14 anni.');
  if (p.consenso !== 'si') return reply(ajax, false, 'Per iscriverti serve il consenso al trattamento dei dati.');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendSignup({
      data: new Date(),
      email: cell(email),
      nome: cell(nome),
      database: cell(databases),
      consenso: 'Sì (almeno 14 anni)'
    });
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
        'Database: ' + (databases || '-') + '\n'
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

// Modulo di contatto: inoltra il messaggio alla casella giusta, con "rispondi a"
// impostato su chi ha scritto. Qui l'email è l'unica copia del messaggio, quindi
// se l'invio non riesce lo diciamo a chi sta scrivendo.
function doContact(p, ajax) {
  var topic = TOPICS[p.tipo];
  var nome = clean(p.nome, 100);
  var email = clean(p.email, 200).toLowerCase();
  var messaggio = String(p.messaggio || '').trim().slice(0, 5000);

  if (!topic) return reply(ajax, false, 'Scegli di cosa si tratta.');
  if (!nome) return reply(ajax, false, 'Scrivi il tuo nome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(ajax, false, 'Controlla l\'indirizzo email.');
  if (!messaggio) return reply(ajax, false, 'Scrivi il tuo messaggio.');

  var details = '';
  if (p.tipo === 'supporto') {
    details = 'Versione DBlast: ' + (clean(p.versione, 50) || '-') + '\n' +
      'Sistema operativo: ' + (clean(p.sistema, 80) || '-') + '\n' +
      'Database: ' + (clean(p.database, 100) || '-') + '\n';
  }

  try {
    sendEmail({
      to: topic.to,
      reply_to: email,
      subject: '[Sito] ' + topic.label + ': ' + nome,
      text: 'Messaggio dal modulo di contatto del sito.\n\n' +
        'Nome: ' + nome + '\n' +
        'Email: ' + email + '\n' +
        'Argomento: ' + topic.label + '\n' +
        details + '\n' +
        messaggio + '\n'
    });
  } catch (err) {
    console.error('Invio messaggio di contatto non riuscito: ' + err);
    return reply(ajax, false, 'Non siamo riusciti a inviare il messaggio. Riprova tra poco oppure scrivici a ' + topic.to[0] + '.');
  }

  return reply(ajax, true, null, '<h1>Messaggio inviato</h1><p>Grazie, ti risponderemo all\'indirizzo email che ci hai lasciato.</p>');
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

// Cerca, tra i fogli del file, la riga di intestazione con le colonne di COLUMNS
// e aggiunge l'iscrizione sotto l'ultima riga compilata.
function appendSignup(values) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var lastCol = sheet.getLastColumn();
    if (!lastCol) continue;
    var top = sheet.getRange(1, 1, Math.min(5, sheet.getMaxRows()), lastCol).getDisplayValues();
    for (var r = 0; r < top.length; r++) {
      var index = findColumns(top[r]);
      if (!index) continue;
      var row = new Array(lastCol).fill('');
      Object.keys(index).forEach(function (key) { row[index[key]] = values[key]; });
      sheet.getRange(Math.max(sheet.getLastRow(), r + 1) + 1, 1, 1, lastCol).setValues([row]);
      return;
    }
  }
  throw new Error('Non trovo la tabella delle iscrizioni: controlla i nomi delle colonne (COLUMNS).');
}

// Restituisce {chiave: indice colonna} se l'intestazione contiene tutte le colonne, altrimenti null.
function findColumns(header) {
  var index = {};
  for (var key in COLUMNS) {
    var col = header.findIndex(function (h) {
      return String(h).trim().toLowerCase().indexOf(COLUMNS[key].toLowerCase()) === 0;
    });
    if (col < 0) return null;
    index[key] = col;
  }
  return index;
}

function clean(value, max) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

// Evita che un testo che inizia con = + - @ venga interpretato come formula nel foglio.
function cell(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function reply(ajax, ok, error, okHtml) {
  if (ajax) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: ok, error: error || null }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Senza JavaScript il browser arriva qui direttamente: mostriamo una pagina semplice.
  var msg = ok
    ? (okHtml || '<h1>Grazie!</h1><p>Sei nella lista: ti scriveremo appena la beta di DBlast sarà pronta.</p>')
    : '<h1>Invio non riuscito</h1><p>' + error + '</p>';
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px">' +
    msg + '<p><a href="https://www.dblast.it/" target="_top">Torna a dblast.it</a></p></div>'
  ).setTitle('DBlast');
}

// Prova del modulo di contatto dall'editor (Esegui > testContatto):
// arriva un messaggio di prova a supporto@dblast.it.
function testContatto() {
  var res = doContact({
    tipo: 'supporto', nome: 'Prova', email: 'prova@example.com', versione: '0.1', sistema: 'Windows 11',
    database: 'PostgreSQL 16', messaggio: 'Messaggio di prova dal modulo di contatto.', ajax: '1'
  }, true);
  Logger.log(res.getContent());
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
