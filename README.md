# Zugabe – Bingo für Konzerte

Bingo-Spiele rund um Konzerte und Festivals mit unterschiedlichen Karten und Feldern als installierbare Web-App (PWA, offline nutzbar).
Aufgebaut wie das Projekt rbf2027: `index.html` + `css/app.css` + `js/01…99`, Daten getrennt in `bingo-data.js`,
Service Worker `sw.js`, Tests mit JSDOM.

## Neues Spiel hinzufügen

In `bingo-data.js` einen Eintrag an `BINGO_GAMES` anhängen (Felder und Bedeutung stehen im Kopfkommentar der Datei).
Die App prüft die Daten beim Start (Settings → Datenqualität); Spiele mit Fehlern werden nicht angeboten.
Danach `BINGO_DATA_VERSION` erhöhen und – damit Handys die neue Version sicher holen – `CACHE` in `sw.js` hochzählen
(`zugabe-v1` → `zugabe-v2`).

## Große Karten, Kurztexte und Lupe

Kartengrößen: 3×3, 4×4, 5×5, 7×7 und 9×9 (`groesse`). Auf großen Karten passt der ganze Text oft nicht mehr auf ein Feld.
Dafür gibt es zwei Hilfen:

- **Kurztexte:** Ein Feld darf als Paar `[text, kurztext]` stehen, ein Kombi-Feld mit `kurz: '…'`. Auf dem Feld steht dann der
  Kurztext (empfohlen bis 20 Zeichen, mit größerer Schrift), der ganze Text steht im `aria-label` und im Tooltip.
- **Lupe:** Unter der Karte steht der ganze Text des zuletzt angetippten Felds (bei Kombi-Feldern mit Fortschritt).
  Antippen markiert das Feld wie bisher. Settings → „Lupe unter der Karte“: Automatisch (bei Karten mit Kurztexten und ab 7×7),
  Immer oder Aus. Settings → „Kurztexte auf den Feldern“ schaltet die Kurztexte ab, dann zeigt jedes Feld den ganzen Text.

```js
felder: [ ['Gitarrist verpasst den Einsatz', 'Einsatz'], 'Regen im Konzert', { text: 'Wetter erlebt', kurz: 'Wetter', ab: 3, punkte: [ … ] } ]
```

### Felder, Textanpassung und Zoom

- **Alle Felder sind gleich groß** (quadratisch, unabhängig vom Text). Der Text wird in die Felder eingepasst, nicht umgekehrt.
- **So viel Text wie möglich, aber lesbar** (`js/06-passung.js`): Die App nimmt den ganzen Text, wenn er ohne Wortbruch mit mindestens
  10 px aufs Feld passt, sonst den Kurztext des Spiels, dann den ganzen Text bis hinunter zu 8 px, dann mit Silbentrennung und zuletzt gekürzt mit „…“.
- **Zoom nur für das Spielfeld:** Zwei Finger auseinander oder die Tasten − / ＋ über der Karte (100 bis 400 %); die Prozentanzeige setzt auf 100 % zurück.
  Größere Felder zeigen mehr Text und eine größere Schrift. Beim Öffnen eines Spiels steht der Zoom wieder auf 100 %.
- **Symbole optional:** Settings → „Symbole (Emojis) auf den Feldern“. Aus = Emojis werden von den Feldtexten entfernt, es passt mehr Text.

Mitgeliefert: „Festival-Woche“ (7×7, echte Kurztexte) und „Testkarte 9×9 (Dummydaten)“.

## Kombi-Felder

Ein Eintrag in `felder` kann statt eines Textes ein Kombi-Feld sein: ein Feld mit Einzelpunkten als Checkliste,
das als erledigt zählt, sobald genug Punkte abgehakt sind.

```js
{ text: 'Sprachen, in denen gesungen wird', ab: 3, punkte: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch', 'Italienisch'] }
```

- `punkte`: 2 bis 12 verschiedene Texte, `ab`: ganze Zahl von 1 bis zur Zahl der Punkte
- Auf der Karte zeigt das Feld seinen Fortschritt (`☑ 1/3`); ein Tipp öffnet die Checkliste
- Das Feld zählt für Linie und Vollbild wie ein markiertes Feld, solange mindestens `ab` Punkte abgehakt sind;
  nimmt man Häkchen wieder weg, fällt es zurück
- „Markierungen löschen“ und „Neue Karte“ setzen auch die Häkchen zurück
- Ein Kombi-Feld zählt bei der Mindestzahl der Felder (siehe `groesse`) wie ein normales Feld

### Eigene Einträge (Freitext)

Mit `eigene: true` kann man zusätzlich zu den festen Punkten eigene Einträge eintragen, zum Beispiel weitere Sprachen:

```js
{ text: 'Sprachen, in denen gesungen wird', ab: 3, punkte: ['Deutsch', 'Englisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' }
```

- Im Dialog stehen unter den festen Punkten Eingabefelder. Nach jedem ausgefüllten Feld erscheint ein neues leeres (höchstens 10 Einträge à 40 Zeichen)
- Jeder Eintrag zählt wie ein abgehakter Punkt. Doppelte Einträge und Einträge, die einem festen Punkt gleichen, zählen nur einmal (gestrichelter Rand)
- `eigeneHinweis` ist der Platzhaltertext im Eingabefeld (optional)
- Mit `eigene: true` darf `punkte` auch weniger als 2 Einträge haben (oder leer sein) und `ab` darf bis `punkte + 10` gehen

## Neue Datei hinzufügen

1. Datei `js/NN-name.js` mit den zwei Kopfzeilen und der Anmeldung (`BINGO_PARTS.push(...)`) wie in den anderen Dateien
2. Skript-Tag in `index.html`, Name in `BINGO_EXPECTED_PARTS` (`js/99-main.js`), Eintrag in `ASSETS` (`sw.js`)
3. `./test/run-tests.sh split_files` zeigt, wenn eine der drei Stellen fehlt

## Tests

Alle Test-Dateien liegen in `test/`. `npm install`, dann `./test/run-tests.sh`. Übersicht in `test/TESTS.md`.

## Dateien beim Einchecken über die GitHub-Weboberfläche

Hauptordner: `index.html`, `bingo-data.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `README.md`,
`package.json`, `gitignore`.
Ordner `css`: `app.css`. Ordner `js`: alle sechs js-Dateien.
Ordner `test`: `run-tests.sh`, `test-helpers.js`, `mutation-check.js`, `mutations_spiel.json`, `TESTS.md` und alle `test_*.js`.
