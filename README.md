# Zugabe – Bingo für Konzerte

Bingo-Spiele rund um Konzerte und Festivals mit unterschiedlichen Karten und Feldern als installierbare Web-App (PWA, offline nutzbar).
Aufgebaut wie das Projekt rbf2027: `index.html` + `css/app.css` + `js/01…99`, Daten getrennt in `bingo-data.js`,
Service Worker `sw.js`, Tests mit JSDOM.

## Neues Spiel hinzufügen

In `bingo-data.js` einen Eintrag an `BINGO_GAMES` anhängen (Felder und Bedeutung stehen im Kopfkommentar der Datei).
Die App prüft die Daten beim Start (Settings → Datenqualität); Spiele mit Fehlern werden nicht angeboten.
Danach `BINGO_DATA_VERSION` erhöhen und – damit Handys die neue Version sicher holen – `CACHE` in `sw.js` hochzählen
(`zugabe-v1` → `zugabe-v2`).

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
