# Curva Cieca

Un puzzle da browser: guarda una funzione, indovina la **forma** del grafico e disegnala. La risposta si rivela da sinistra a destra. Conta l'intuizione, non uno studio di funzione da esame. Il piano mantiene la stessa scala sui due assi anche quando cambia la dimensione dello schermo; non ci sono controlli di zoom.

## Avvio

Serve Node.js 20 o successivo. Non ci sono dipendenze da installare.

```sh
npm start
```

Apri <http://localhost:4173>. Per usare un'altra porta: `PORT=8080 npm start`.

## Come si gioca

- **Percorso:** 20 sfide generate al momento, con difficoltà crescente.
- **Allenamento:** scegli facile, media, difficile o folle e gioca sempre in quella fascia.
- **Stanza:** crea una stanza, condividi il link o il codice e avvia da 1 a 30 sfide generate per quella partita e uguali per tutti. Puoi scegliere 20, 30, 45, 60 o 90 secondi per sfida, una progressione crescente (dalle curve facili a quelle difficili, con una folle finale nelle partite da almeno cinque sfide) oppure una difficoltà costante. Ogni nuova partita genera coefficienti e curve nuovi; le formule nella stessa partita non si ripetono.
- **Timer rapido opzionale:** dopo il primo disegno confermato, il tempo rimanente diventa il minimo tra il tempo attuale e una finestra configurabile da 3 a 30 secondi. La curva viene rivelata a tutti insieme quando tutti hanno confermato o allo scadere del timer.

Ogni disegno riceve fino a 100 punti per somiglianza della curva: contano posizione, direzione, curvatura, svolte e porzione disegnata. Le curve periodiche con picchi richiedono anche i picchi nella posizione giusta: una semplice linea sulla loro base non basta. Un tratto centrale corretto può ottenere un buon punteggio anche senza raggiungere i bordi. Dopo la rivelazione, il pulsante «Come riconoscere questa curva?» spiega il pattern. Nelle stanze si aggiungono fino a 10 punti per la velocità di invio. Un disegno vuoto vale zero. Se il timer scade, il browser invia automaticamente il disegno presente. Si può disegnare con mouse, penna o dito; i tratti separati sono utili per grafici con più rami.

## Pubblicazione su un server

Esegui `npm start` su una macchina raggiungibile e imposta `PORT` secondo la piattaforma. Metti un proxy HTTPS davanti al processo se esponi il sito pubblicamente; il proxy deve lasciare aperte le connessioni `text/event-stream` usate per sincronizzare le stanze. L'app deve usare **un solo processo Node**: stanze, giocatori e punteggi sono in memoria e si azzerano al riavvio. Non servono database né account per questa versione.

In alternativa:

```sh
docker build -t curva-cieca .
docker run --rm -p 4173:4173 curva-cieca
```

Il sito statico in `dist/` funziona anche senza Node per percorso e allenamento, ma la modalità stanza richiede il server.

## Verifica

```sh
npm test
```
