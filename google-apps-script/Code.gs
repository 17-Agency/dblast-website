/**
 * Backend dei form di dblast.it e API per il report giornaliero della beta.
 *
 * Gestisce due form sullo stesso Google Sheet:
 *  - form contatti  -> foglio "Richieste" + email immediata a CONTACT_NOTIFY_TO
 *  - form beta      -> foglio "Beta", senza email immediata: il report
 *                      giornaliero (GitHub Actions) legge le righe non ancora
 *                      notificate, manda l'email da info@dblast.it via Zoho SMTP
 *                      e le segna come notificate.
 *
 * Configurazione:
 * 1. Crea un Google Sheet nel tuo account (il nome non conta).
 * 2. Nel foglio: Estensioni > Apps Script, cancella il contenuto e incolla questo file.
 * 3. Imposta API_TOKEN con una stringa lunga e casuale (la usa il report giornaliero).
 * 4. Esegui una volta la funzione `setup` (icona ▶) e autorizza lo script.
 * 5. Deploy > Nuovo deployment > tipo "Web app":
 *    - Esegui come: Me
 *    - Chi ha accesso: Chiunque
 *    Copia l'URL che finisce in /exec: va in FORM_ENDPOINT (form.js),
 *    BETA_ENDPOINT (beta.js) e nel secret BETA_API_URL su GitHub.
 */

// Lascia vuoto se lo script è collegato al foglio (Estensioni > Apps Script).
// Altrimenti incolla l'ID del foglio preso dall'URL: docs.google.com/spreadsheets/d/<ID>/edit
var SPREADSHEET_ID = '';

// Token condiviso con il report giornaliero. Sostituiscilo con una stringa lunga e casuale.
var API_TOKEN = 'cambia-questo-token-con-una-stringa-lunga-e-casuale';

// --- Form contatti ---
var CONTACT_TAB = 'Richieste';
var CONTACT_HEADER = ['Data', 'Nome', 'Email', 'Oggetto', 'Messaggio'];
var CONTACT_NOTIFY_TO = 'info@dblast.it';

// --- Form beta ---
var BETA_TAB = 'Beta';
var BETA_HEADER = ['Data', 'Nome', 'Email', 'Database', 'Consenso', 'Note', 'Notificato'];
var DATABASES = [
  'PostgreSQL',
  'MySQL/MariaDB',
  'MongoDB',
  'SQL Server',
  'SQLite',
  'Oracle',
  'Redis',
  'DynamoDB',
  'Cassandra',
  'Firebird',
  'Altro'
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return reply({ ok: false, error: 'richiesta vuota' });
    }

    var data = JSON.parse(e.postData.contents);

    // Honeypot: se il campo nascosto è compilato è un bot, si ignora.
    if (data.sito) {
      return reply({ ok: true });
    }

    return data.tipo === 'beta' ? saveBeta(data) : saveContact(data);
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    // Nessuna azione: risposta di cortesia, serve solo a verificare il deploy.
    if (!params.action) {
      return reply({ ok: true, service: 'dblast-forms' });
    }
    if (params.token !== API_TOKEN) {
      return reply({ ok: false, error: 'token non valido' });
    }
    if (params.action === 'pending') return listPendingBeta();
    if (params.action === 'ack') return ackBeta(params.rows);
    return reply({ ok: false, error: 'azione sconosciuta' });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function saveContact(data) {
  var nome = clean(data.nome);
  var email = clean(data.email);
  var oggetto = clean(data.oggetto) || 'Altro';
  var messaggio = clean(data.messaggio);

  if (!isEmail(email) || !messaggio) {
    return reply({ ok: false, error: 'dati mancanti' });
  }

  tab(CONTACT_TAB, CONTACT_HEADER).appendRow([new Date(), nome, email, oggetto, messaggio]);

  if (CONTACT_NOTIFY_TO) {
    MailApp.sendEmail({
      to: CONTACT_NOTIFY_TO,
      subject: '[DBlast] ' + oggetto,
      replyTo: email,
      body: 'Nome: ' + nome + '\n' +
        'Email: ' + email + '\n' +
        'Oggetto: ' + oggetto + '\n\n' +
        messaggio
    });
  }

  return reply({ ok: true });
}

function saveBeta(data) {
  var nome = clean(data.nome);
  var email = clean(data.email);
  var note = clean(data.note);
  var consenso = data.consenso === true || data.consenso === 'SI';

  var raw = data.database;
  if (typeof raw === 'string') raw = raw.split(',');
  var database = [];
  if (raw && raw.length) {
    for (var i = 0; i < raw.length; i++) {
      var value = clean(raw[i]);
      if (DATABASES.indexOf(value) !== -1 && database.indexOf(value) === -1) {
        database.push(value);
      }
    }
  }

  if (!nome || !isEmail(email) || !database.length || !consenso) {
    return reply({ ok: false, error: 'dati mancanti' });
  }

  tab(BETA_TAB, BETA_HEADER).appendRow([new Date(), nome, email, database.join(', '), 'SI', note, '']);

  return reply({ ok: true });
}

function listPendingBeta() {
  var values = tab(BETA_TAB, BETA_HEADER).getDataRange().getValues();
  var pending = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[6] || '').trim() !== '') continue; // già notificata
    if (!String(row[2] || '').trim()) continue; // riga vuota
    pending.push({
      row: i + 1,
      createdAt: toIso(row[0]),
      nome: String(row[1] || ''),
      email: String(row[2] || ''),
      database: String(row[3] || ''),
      note: String(row[5] || '')
    });
  }

  return reply({ ok: true, pending: pending });
}

function ackBeta(rows) {
  var sheet = tab(BETA_TAB, BETA_HEADER);
  var list = String(rows || '')
    .split(',')
    .map(function (value) { return parseInt(value, 10); })
    .filter(function (value) { return value > 1; });

  var stamp = new Date();
  for (var i = 0; i < list.length; i++) {
    sheet.getRange(list[i], 7).setValue(stamp);
  }

  return reply({ ok: true, notificati: list.length });
}

// Esegui questa funzione una volta per creare i fogli e autorizzare gli accessi.
function setup() {
  tab(CONTACT_TAB, CONTACT_HEADER);
  tab(BETA_TAB, BETA_HEADER);
  MailApp.getRemainingDailyQuota();

  var ss = spreadsheet();
  var names = ss.getSheets().map(function (sheet) { return sheet.getName(); }).join(', ');
  return 'OK: fogli pronti in "' + ss.getName() + '" (' + names + ')';
}

function spreadsheet() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Nessun foglio collegato. Apri lo script da Estensioni > Apps Script dentro il Google Sheet, oppure imposta SPREADSHEET_ID in cima a Code.gs.');
  }
  return ss;
}

function tab(name, header) {
  var ss = spreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

function clean(value) {
  return String(value == null ? '' : value).slice(0, 5000).trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : String(value || '');
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
