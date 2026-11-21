# Zugabe – Bingo für Konzerte

Bingo-Spiele rund um Konzerte und Festivals mit unterschiedlichen Karten und Feldern als installierbare Web-App (PWA, offline nutzbar).
Aufgebaut wie das Projekt rbf2027: `index.html` + `css/app.css` + `js/01…99`, Daten getrennt in `bingo-data.js`,
Service Worker `sw.js`, Tests mit JSDOM.

## Neues Spiel hinzufügen

In `bingo-data.js` einen Eintrag an `BINGO_GAMES` anhängen (Felder und Bedeutung stehen im Kopfkommentar der Datei).
Die App prüft die Daten beim Start (Settings → Datenqualität); Spiele mit Fehlern werden nicht angeboten.
Danach `BINGO_DATA_VERSION` erhöhen und – damit Handys die neue Version sicher holen – `CACHE` in `sw.js` hochzählen
(`zugabe-v1` → `zugabe-v2`).

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
