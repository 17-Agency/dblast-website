// Moduli del sito (iscrizione e contatti): controlla i campi obbligatori con i
// messaggi scritti negli attributi data-missing / data-invalid, invia senza
// lasciare la pagina e poi va a data-redirect oppure mostra il blocco data-success.
// Senza JavaScript i moduli funzionano lo stesso con la validazione del browser e un POST normale.
(function () {
  if (!window.fetch || !window.URLSearchParams) return;
  var generic = 'Non siamo riusciti a inviare il modulo. Riprova tra poco oppure scrivici a info@dblast.it.';

  Array.prototype.forEach.call(document.querySelectorAll('form.js-form'), function (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type=submit]');
    var label = button.firstElementChild.textContent;
    var success = form.dataset.success && document.getElementById(form.dataset.success);

    // Un campo per nome: per i gruppi di radio basta il primo.
    var fields = [];
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (input) {
      if (!fields.some(function (f) { return f.name === input.name; })) fields.push(input);
    });

    form.noValidate = true;

    function group(input) {
      return input.type === 'radio' ? form.querySelectorAll('input[name="' + input.name + '"]') : [input];
    }

    function check(input) {
      var msg = '';
      if (!input.validity.valid) {
        msg = (input.validity.typeMismatch && input.dataset.invalid) || input.dataset.missing || 'Compila questo campo.';
      }
      document.getElementById('err-' + input.name).textContent = msg;
      Array.prototype.forEach.call(group(input), function (el) {
        if (msg) el.setAttribute('aria-invalid', 'true');
        else el.removeAttribute('aria-invalid');
      });
      return !msg;
    }

    // Dopo il primo errore il messaggio si aggiorna mentre l'utente corregge.
    fields.forEach(function (input) {
      var text = input.type !== 'checkbox' && input.type !== 'radio';
      Array.prototype.forEach.call(group(input), function (el) {
        el.addEventListener(text ? 'input' : 'change', function () { if (input.hasAttribute('aria-invalid')) check(input); });
      });
      if (text) input.addEventListener('blur', function () { if (input.value) check(input); });
    });

    function busy(on) {
      button.disabled = on;
      button.classList.toggle('loading', on);
      button.firstElementChild.textContent = on ? 'Invio in corso' : label;
    }

    function fail(message) {
      busy(false);
      status.className = 'form-status error';
      status.textContent = message || generic;
    }

    function done() {
      if (form.dataset.redirect) { window.location.href = form.dataset.redirect; return; }
      busy(false);
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    }

    if (success) {
      var again = success.querySelector('[data-again]');
      if (again) again.addEventListener('click', function () {
        success.hidden = true;
        form.hidden = false;
        form.querySelector('input:not([type=hidden]), textarea').focus();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      status.className = 'form-status';

      var firstInvalid = null;
      fields.forEach(function (input) { if (!check(input) && !firstInvalid) firstInvalid = input; });
      if (firstInvalid) { firstInvalid.focus(); return; }

      var data = new URLSearchParams(new FormData(form));
      data.append('ajax', '1');
      busy(true);

      fetch(form.action, { method: 'POST', body: data })
        .then(function (r) { return r.json(); })
        .then(function (res) { if (res.ok) done(); else fail(res.error); })
        .catch(function () { fail(); });
    });
  });

  // contatti#supporto, #collaborazioni, #generale: preseleziona l'argomento.
  var topics = { supporto: 'supporto', collaborazioni: 'collaborazione', generale: 'altro' };
  function preselect() {
    var topic = topics[location.hash.slice(1)];
    var radio = topic && document.querySelector('input[name=tipo][value="' + topic + '"]');
    if (radio && !radio.disabled) radio.checked = true;
  }
  preselect();
  window.addEventListener('hashchange', preselect);
})();
