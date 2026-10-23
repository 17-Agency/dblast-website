(function () {
  'use strict';

  // ---------------------------------------------------------------
  // CONFIGURAZIONE: incolla qui l'endpoint del servizio di invio moduli
  // (formato Formspree: 'https://formspree.io/f/<ID>'). Il destinatario
  // (support@dblast.it) si imposta nella dashboard del servizio, non qui.
  // Se resta vuoto, il modulo apre il programma di posta (mailto:).
  var FORM_ENDPOINT = '';
  // ---------------------------------------------------------------

  var SUPPORT_EMAIL = 'support@dblast.it';
  var SUBJECTS = {
    supporto: 'Supporto DBlast',
    bug: 'Segnalazione bug',
    collaborazione: 'Collaborazione',
    altro: 'Altro'
  };

  var form = document.getElementById('contact-form');
  if (!form) return;

  var button = form.querySelector('button[type="submit"]');
  var okBox = document.getElementById('form-ok');
  var errBox = document.getElementById('form-err');
  var fields = {
    nome: form.elements.nome,
    email: form.elements.email,
    oggetto: form.elements.oggetto,
    messaggio: form.elements.messaggio,
    sito: form.elements.sito
  };

  // Preseleziona l'oggetto da ?oggetto=...
  var wanted = new URLSearchParams(window.location.search).get('oggetto');
  if (wanted && Object.prototype.hasOwnProperty.call(SUBJECTS, wanted)) {
    fields.oggetto.value = wanted;
  }

  function showError(field, message) {
    var box = document.getElementById(field.id + '-err');
    field.setAttribute('aria-invalid', 'true');
    box.textContent = message;
    box.hidden = false;
  }

  function clearErrors() {
    ['email', 'messaggio'].forEach(function (name) {
      var field = fields[name];
      field.removeAttribute('aria-invalid');
      var box = document.getElementById(field.id + '-err');
      box.textContent = '';
      box.hidden = true;
    });
    okBox.hidden = true;
    errBox.hidden = true;
  }

  function validate() {
    clearErrors();
    var firstInvalid = null;
    if (!fields.email.value.trim()) {
      showError(fields.email, 'Inserisci il tuo indirizzo email.');
      firstInvalid = fields.email;
    } else if (!fields.email.validity.valid) {
      showError(fields.email, 'Inserisci un indirizzo email valido.');
      firstInvalid = fields.email;
    }
    if (!fields.messaggio.value.trim()) {
      showError(fields.messaggio, 'Scrivi un messaggio.');
      firstInvalid = firstInvalid || fields.messaggio;
    }
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function subjectText() {
    return SUBJECTS[fields.oggetto.value] || SUBJECTS.altro;
  }

  function openMailto() {
    var subject = '[DBlast] ' + subjectText();
    var body = 'Nome: ' + fields.nome.value.trim() + '\n' +
      'Email: ' + fields.email.value.trim() + '\n\n' +
      fields.messaggio.value.trim();
    okBox.textContent = 'Si apre il tuo programma di posta con il messaggio già pronto: controllalo e premi Invia.';
    okBox.hidden = false;
    window.location.href = 'mailto:' + SUPPORT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function showSendError() {
    var link = document.createElement('a');
    link.href = 'mailto:' + SUPPORT_EMAIL;
    link.textContent = SUPPORT_EMAIL;
    errBox.textContent = 'Non siamo riusciti a inviare il messaggio. Riprova più tardi oppure scrivi direttamente a ';
    errBox.appendChild(link);
    errBox.appendChild(document.createTextNode('.'));
    errBox.hidden = false;
  }

  function sendToEndpoint() {
    button.disabled = true;
    var payload = {
      nome: fields.nome.value.trim(),
      email: fields.email.value.trim(),
      oggetto: subjectText(),
      messaggio: fields.messaggio.value.trim(),
      _subject: '[DBlast] ' + subjectText()
    };
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      form.reset();
      okBox.textContent = 'Messaggio inviato. Grazie, ti risponderemo via email.';
      okBox.hidden = false;
    }).catch(function () {
      showSendError();
    }).then(function () {
      button.disabled = false;
    });
  }

  form.setAttribute('novalidate', '');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    // Honeypot: un bot compila il campo nascosto, si ignora senza segnalare nulla.
    if (fields.sito.value) return;
    if (!validate()) return;
    if (FORM_ENDPOINT) {
      sendToEndpoint();
    } else {
      openMailto();
    }
  });
})();
