# dblast-website

Sito vetrina statico di DBlast (HTML + CSS, nessuna build). Dominio: `dblast.it`.

## Pagine

| File | Contenuto |
| --- | --- |
| `index.html` | Home |
| `prodotti.html` | Prodotto DBlast, schermate, stato, roadmap |
| `servizi.html` | Collaborazioni e consulenza su richiesta |
| `chi-siamo.html` | Il progetto e il team |
| `contatti.html` | Modulo di contatto, collaborazioni, contatto generale |
| `form.js` | Logica del modulo di contatto (endpoint in cima al file) |
| `sitemap.xml`, `robots.txt` | Indicizzazione (URL assoluti `https://dblast.it/...`) |

Stile condiviso in `style.css`. Nessuna build, nessuna dipendenza, nessun tracker.

## Indirizzi email

I link `mailto:` stanno in `contatti.html`; il modulo di contatto invia a `support@dblast.it` (vedi sotto).

- `info@dblast.it`: collaborazioni e contatto generale
- `support@dblast.it`: supporto per DBlast

Gli indirizzi esistono già sul dominio. Per cambiarli modifica i link in `contatti.html`.

## Modulo di contatto (`FORM_ENDPOINT`)

Il sito è statico, quindi il modulo in `contatti.html` usa un servizio esterno di invio moduli (compatibile Formspree) che inoltra il messaggio a `support@dblast.it`. Configurazione:

1. Crea un account gratuito su <https://formspree.io>.
2. Crea un nuovo form e imposta come destinatario `support@dblast.it` (conferma l'indirizzo dal link ricevuto via email).
3. Copia l'endpoint del form (`https://formspree.io/f/<ID>`).
4. Incollalo nella costante `FORM_ENDPOINT` in cima a `form.js`.
5. Fai commit e push: GitHub Pages ripubblica il sito.

Finché `FORM_ENDPOINT` è vuoto il modulo funziona comunque: all'invio apre il programma di posta con un `mailto:support@dblast.it` precompilato. Senza JavaScript resta l'`action="mailto:"` del form. Il piano gratuito ha limiti (numero di invii mensili, filtro antispam): controllali nella dashboard. Il campo nascosto `sito` è un honeypot: i bot che lo compilano vengono ignorati. Il link `contatti.html?oggetto=collaborazione#form` preseleziona l'oggetto (valori: `supporto`, `bug`, `collaborazione`, `altro`).

## Anteprima locale

```sh
python -m http.server 8080
```

Poi apri <http://localhost:8080>. In alternativa apri `index.html` nel browser.

## Pubblicazione su GitHub Pages

1. Crea un repository (es. `dblast-website`), carica questi file nella radice e fai push su `main`.
2. Su GitHub: *Settings > Pages > Build and deployment*: Source `Deploy from a branch`, branch `main`, cartella `/ (root)`.
3. Il file `CNAME` contiene `dblast.it`; `.nojekyll` evita l'elaborazione Jekyll.
4. In *Settings > Pages > Custom domain* verifica `dblast.it` e attiva *Enforce HTTPS* quando disponibile.

## DNS

Dal pannello DNS del dominio:

| Tipo | Nome | Valore |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<utente>.github.io` |

Non toccare i record MX, SPF (TXT) e DKIM: servono alla posta del dominio. Aggiungi o modifica solo i record sopra. La propagazione può richiedere alcune ore.

## Screenshot

Gli screenshot in `assets/` vengono dall'app in modalità demo (dati di esempio), a 1440x900.
