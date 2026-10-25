// Modulo di iscrizione: controlla i campi con messaggi in italiano, invia senza
// lasciare la pagina e, se va a buon fine, porta a /grazie.
// Senza JavaScript il modulo funziona lo stesso con la validazione del browser e un POST normale.
(function () {
  var form = document.getElementById('iscrizione');
  if (!form || !window.fetch || !window.URLSearchParams) return;

  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type=submit]');
  var generic = 'Non siamo riusciti a inviare l\'iscrizione. Riprova tra poco oppure scrivici a info@dblast.it.';

  var messages = {
    nome: { valueMissing: 'Scrivi il tuo nome.' },
    email: { valueMissing: 'Scrivi la tua email.', typeMismatch: 'Questa email non sembra valida.' },
    eta: { valueMissing: 'Per iscriverti devi avere almeno 14 anni.' },
    consenso: { valueMissing: 'Ci serve il tuo consenso per poterti scrivere.' }
  };
  var fields = Object.keys(messages).map(function (name) { return form.elements[name]; });

  form.noValidate = true;

  function check(input) {
    var msg = '';
    if (!input.validity.valid) {
      var m = messages[input.name];
      msg = (input.validity.valueMissing && m.valueMissing) || (input.validity.typeMismatch && m.typeMismatch) || m.valueMissing;
    }
    document.getElementById('err-' + input.name).textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !msg;
  }

  // Dopo il primo errore il messaggio si aggiorna mentre l'utente corregge.
  fields.forEach(function (input) {
    var evt = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(evt, function () { if (input.hasAttribute('aria-invalid')) check(input); });
    if (input.type !== 'checkbox') input.addEventListener('blur', function () { if (input.value) check(input); });
  });

  function busy(on) {
    button.disabled = on;
    button.classList.toggle('loading', on);
    button.firstElementChild.textContent = on ? 'Invio in corso' : 'Iscriviti alla beta';
  }

  function fail(message) {
    busy(false);
    status.className = 'form-status error';
    status.textContent = message || generic;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';

    var firstInvalid = null;
    fields.forEach(function (input) { if (!check(input) && !firstInvalid) firstInvalid = input; });
    if (firstInvalid) { firstInvalid.focus(); return; }

    var data = new URLSearchParams(new FormData(form));
    data.append('ajax', '1');
    busy(true);

    fetch(form.action, { method: 'POST', body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) window.location.href = 'grazie';
        else fail(res.error);
      })
      .catch(function () { fail(); });
  });
})();
