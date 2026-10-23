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
| `google-apps-script/Code.gs` | Backend dei due form (contatti + beta) e API per il report |
| `beta.js` | Logica del modulo beta in `index.html` (endpoint in cima al file) |
| `tools/daily-report/` | Script del report giornaliero (Node, eseguito da GitHub Actions) |
| `.github/workflows/daily-beta-report.yml` | Cron giornaliero del report |
| `sitemap.xml`, `robots.txt` | Indicizzazione (URL assoluti `https://dblast.it/...`) |

Stile condiviso in `style.css`. Nessuna build, nessuna dipendenza, nessun tracker.

## Indirizzi email

I link `mailto:` stanno in `contatti.html`; il modulo di contatto salva le richieste su un Google Sheet e manda una notifica email (vedi sotto).

- `info@dblast.it`: collaborazioni e contatto generale
- `support@dblast.it`: supporto per DBlast

Gli indirizzi esistono già sul dominio. Per cambiarli modifica i link in `contatti.html`.

## Backend dei form (`google-apps-script/Code.gs`)

Il sito è statico, quindi i moduli non possono salvare nulla da soli: inviano i dati a una Web App di Google Apps Script che scrive sul Google Sheet e, per il form contatti, manda subito una email. Lo stesso script espone le API usate dal report giornaliero della beta. Un solo progetto Apps Script, un solo URL.

- `google-apps-script/Code.gs` — backend: instrada i POST su `tipo` (`contatto` o `beta`) e risponde ai GET `?action=pending` / `?action=ack` con il token.
- `form.js` e `beta.js` — in cima, le costanti `FORM_ENDPOINT` e `BETA_ENDPOINT` con l'URL della Web App (lo stesso per entrambi).

Configurazione (una volta sola):

1. Crea un Google Sheet nel tuo account (il nome non conta: i fogli `Richieste` e `Beta` li crea lo script).
2. Nel foglio: *Estensioni > Apps Script*, cancella il contenuto e incolla `google-apps-script/Code.gs`.
3. In `Code.gs` imposta `API_TOKEN` con una stringa lunga e casuale (la usa il report) e, se serve, `CONTACT_NOTIFY_TO`.
4. Esegui una volta la funzione `setup` (icona ▶ accanto al nome) e autorizza lo script quando richiesto.
5. *Deploy > Nuovo deployment > Web app*: «Esegui come» → *Me*, «Chi ha accesso» → *Chiunque*. Copia l'URL che finisce in `/exec`.
6. Incolla quell'URL in `FORM_ENDPOINT` (cima di `form.js`) e in `BETA_ENDPOINT` (cima di `beta.js`).
7. Fai commit e push: GitHub Pages ripubblica il sito.

Il form contatti aggiunge una riga (`Data, Nome, Email, Oggetto, Messaggio`) e manda una email a `CONTACT_NOTIFY_TO` con il `reply-to` sull'indirizzo del visitatore. Quella email parte dall'account Google (Gmail) collegato allo script. Il form beta aggiunge una riga al foglio `Beta`, senza email immediata (vedi sotto). Se cambi `Code.gs` ricordati di *Deploy > Gestisci deployment > Modifica > Nuova versione*.

Finché `FORM_ENDPOINT` è vuoto il modulo contatti apre il programma di posta con un `mailto:support@dblast.it` precompilato. Senza JavaScript resta l'`action="mailto:"` del form. Il link `contatti.html?oggetto=collaborazione#form` preseleziona l'oggetto (valori: `supporto`, `bug`, `collaborazione`, `altro`).

## Modulo beta (`index.html` + `beta.js`)

Nella home c'è la sezione `#beta`: Nome, Email, database usati (scelta multipla), Note e consenso al contatto. I dati finiscono sul foglio `Beta`, con data/ora e una colonna `Notificato` vuota.

Ogni giorno alle 10:00 un workflow di GitHub Actions esegue `tools/daily-report/report.mjs`: chiede alla Web App le righe non notificate, se ce ne sono manda **una** email da `info@dblast.it` via SMTP Zoho con il conteggio (e l'elenco), poi le segna come notificate. Se non ce ne sono, non manda niente.

Il mittente è Zoho, quindi l'invio non può farlo Apps Script (non supporta SMTP esterni): lo fa il workflow. Configurazione:

1. In Zoho Mail abilita l'accesso SMTP per `info@dblast.it` (*Impostazioni > Posta > Invio email in uscita*) e, se hai la verifica in due passaggi, genera una **password per app**.
2. Sul repo GitHub: *Settings > Secrets and variables > Actions > New repository secret*. Aggiungi `BETA_API_URL` (l'URL `/exec`), `BETA_API_TOKEN` (lo stesso di `Code.gs`), `ZOHO_HOST`, `ZOHO_PORT`, `ZOHO_SECURE`, `ZOHO_USER`, `ZOHO_PASS`, `MAIL_FROM`, `NOTIFY_TO`.
3. Fai push su `main`: il workflow `.github/workflows/daily-beta-report.yml` entra in funzione. Per provarlo subito: *Actions > Report beta giornaliero > Run workflow*.
4. In locale, per una prova: `cd tools/daily-report && npm install`, copia `.env.example` in `.env`, compila e lancia `npm run report`.

Note: i cron di GitHub sono in **UTC**, quindi `0 8 * * *` corrisponde alle 10:00 italiane con l'ora legale e alle 09:00 in inverno (in inverno usa `0 9 * * *`). GitHub disattiva i workflow schedulati dopo 60 giorni senza attività sul repo: un commit li riattiva. Finché `BETA_ENDPOINT` è vuoto il form beta ripiega su un `mailto:info@dblast.it` precompilato. Il campo nascosto `sito` è un honeypot su entrambi i form.

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
