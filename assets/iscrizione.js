// Invia il modulo di iscrizione senza lasciare la pagina e, se va a buon fine,
// porta a /grazie. Senza JavaScript il modulo funziona lo stesso con un POST normale.
(function () {
  var form = document.getElementById('iscrizione');
  if (!form || !window.fetch || !window.URLSearchParams) return;

  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type=submit]');
  var generic = 'Non siamo riusciti a inviare l\'iscrizione. Riprova tra poco oppure scrivici a info@dblast.it.';

  function fail(message) {
    button.disabled = false;
    status.className = 'form-status error';
    status.textContent = message || generic;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new URLSearchParams(new FormData(form));
    data.append('ajax', '1');

    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Invio in corso...';

    fetch(form.action, { method: 'POST', body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) window.location.href = 'grazie';
        else fail(res.error);
      })
      .catch(function () { fail(); });
  });
})();
