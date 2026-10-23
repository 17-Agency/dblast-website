(function () {
  'use strict';

  // ---------------------------------------------------------------
  // CONFIGURAZIONE: incolla qui l'URL della Web App di Google Apps Script
  // ('https://script.google.com/macros/s/<ID>/exec'), lo stesso di form.js.
  // Se resta vuoto, il modulo apre il programma di posta (mailto:).
  var BETA_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwS0B20FiIkdWYL01oX1Tr_jAuLS-k7iu0GUJnpgV5KSf7mXVUaDBymT_A5KoxLty-V/exec';
  // ---------------------------------------------------------------

  var NOTIFY_EMAIL = 'info@dblast.it';

  var form = document.getElementById('beta-form');
  if (!form) return;

  var button = form.querySelector('button[type="submit"]');
  var okBox = document.getElementById('beta-ok');
  var errBox = document.getElementById('beta-err');
  var dbGroup = document.getElementById('b-database');
  var fields = {
    nome: form.elements.nome,
    email: form.elements.email,
    consenso: form.elements.consenso,
    note: form.elements.note,
    sito: form.elements.sito
  };

  function setError(element, boxId, message) {
    if (element) element.setAttribute('aria-invalid', 'true');
    var box = document.getElementById(boxId);
    box.textContent = message;
    box.hidden = false;
  }

  function clearErrors() {
    [fields.nome, fields.email, fields.consenso, dbGroup].forEach(function (element) {
      element.removeAttribute('aria-invalid');
    });
    ['b-nome-err', 'b-email-err', 'b-database-err', 'b-consenso-err'].forEach(function (id) {
      var box = document.getElementById(id);
      box.textContent = '';
      box.hidden = true;
    });
    okBox.hidden = true;
    errBox.hidden = true;
  }

  function selectedDatabases() {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="database"]:checked'))
      .map(function (input) { return input.value; });
  }

  function validate() {
    clearErrors();
    var firstInvalid = null;

    if (!fields.nome.value.trim()) {
      setError(fields.nome, 'b-nome-err', 'Inserisci il tuo nome.');
      firstInvalid = fields.nome;
    }
    if (!fields.email.value.trim()) {
      setError(fields.email, 'b-email-err', 'Inserisci il tuo indirizzo email.');
      firstInvalid = firstInvalid || fields.email;
    } else if (!fields.email.validity.valid) {
      setError(fields.email, 'b-email-err', 'Inserisci un indirizzo email valido.');
      firstInvalid = firstInvalid || fields.email;
    }
    if (!selectedDatabases().length) {
      setError(dbGroup, 'b-database-err', 'Seleziona almeno un database.');
      firstInvalid = firstInvalid || dbGroup;
    }
    if (!fields.consenso.checked) {
      setError(fields.consenso, 'b-consenso-err', 'Serve il consenso per poterti contattare.');
      firstInvalid = firstInvalid || fields.consenso;
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function payload() {
    return {
      tipo: 'beta',
      nome: fields.nome.value.trim(),
      email: fields.email.value.trim(),
      database: selectedDatabases(),
      consenso: fields.consenso.checked,
      note: fields.note.value.trim(),
      sito: fields.sito.value
    };
  }

  function openMailto() {
    var data = payload();
    var body = 'Nome: ' + data.nome + '\n' +
      'Email: ' + data.email + '\n' +
      'Database: ' + data.database.join(', ') + '\n\n' +
      data.note;
    okBox.textContent = 'Si apre il tuo programma di posta con la richiesta già pronta: controllala e premi Invia.';
    okBox.hidden = false;
    window.location.href = 'mailto:' + NOTIFY_EMAIL +
      '?subject=' + encodeURIComponent('[DBlast] Richiesta accesso beta') +
      '&body=' + encodeURIComponent(body);
  }

  function showSendError() {
    var link = document.createElement('a');
    link.href = 'mailto:' + NOTIFY_EMAIL;
    link.textContent = NOTIFY_EMAIL;
    errBox.textContent = 'Non siamo riusciti a inviare la richiesta. Riprova più tardi oppure scrivi a ';
    errBox.appendChild(link);
    errBox.appendChild(document.createTextNode('.'));
    errBox.hidden = false;
  }

  function sendToEndpoint() {
    button.disabled = true;
    return fetch(BETA_ENDPOINT, {
      method: 'POST',
      // text/plain: evita la preflight CORS che Google Apps Script non gestisce.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload())
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (result) {
        if (!response.ok || result.ok === false) throw new Error('richiesta respinta');
        return result;
      });
    }).then(function () {
      form.reset();
      okBox.textContent = 'Richiesta inviata. Ti scriveremo quando la beta sarà disponibile.';
      okBox.hidden = false;
    }).catch(function () {
      showSendError();
    }).then(function () {
      button.disabled = false;
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    // Honeypot: un bot compila il campo nascosto, si ignora senza segnalare nulla.
    if (fields.sito.value) return;
    if (!validate()) return;
    if (BETA_ENDPOINT) {
      sendToEndpoint();
    } else {
      openMailto();
    }
  });
})();
