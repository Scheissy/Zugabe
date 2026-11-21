# Testübersicht (Zugabe – Bingo für Konzerte)

Alle Tests laufen gegen `index.html` (App-Logik) im JSDOM, mit der echten Datei `bingo-data.js`
oder – wo ein Test eigene Daten braucht – mit einem eingebetteten `dataScript`.
Voraussetzung einmalig: `npm install` (installiert `jsdom`).
Alle Test-Dateien liegen im Ordner `test/`. Ausführung (aus dem Projektordner): `./test/run-tests.sh` für alle, `./test/run-tests.sh spiel_logik` für einzelne.

Neue Testdateien: bitte hier eine Zeile ergänzen, sonst verliert die Liste mit der Zeit ihren Nutzen.

| Datei | Prüft |
|---|---|
| `test_split_files.js` | Aufbau: index.html ohne Inline-Skripte/-Styles, Skript-Reihenfolge = `BINGO_EXPECTED_PARTS`, jede js-Datei meldet sich unter ihrem Namen an, keine Datei über 700 Zeilen, Service Worker cacht alle Dateien (ASSETS ohne tote Einträge), Manifest + Icons, App startet ohne Ladefehler, fehlt ein Teil erscheint eine sichtbare Warnung. |
| `test_sw_assets.js` | Service Worker: syntaktisch gültig, `bingo-data.js` und App-Code Network-First, Cache-Name gesetzt, keine rbf-Reste. |
| `test_sw_network_timeout.js` | Service Worker in einer Sandbox (aus rbf2027 übernommen): hängendes Netz fällt nach dem Zeitlimit auf den Cache zurück, frisches Netz liefert frisch, Fehlerantworten landen nie im Cache, statische Assets Cache-first. |
| `test_data_contract.js` | Mitgelieferte Spiele in `bingo-data.js`: keine Befunde, Kombi-Felder mit gültiger Schwelle, eindeutige ids, alle Größen (3/4/5), beide Ziele (Linie/Vollbild), mit und ohne Freifeld, Zufallsauswahl und „alle Felder“, Spieleliste zeigt jedes Spiel einmal. |
| `test_validation.js` | `validateGames()`: je ein Negativ- und Positivfall pro Regel (id, titel, Größe, Ziel, Felder, Duplikate, genug Felder mit/ohne Freifeld, Hinweise); Spiele mit Fehlern fehlen in der Liste, Datenqualität-Panel, leere Liste. |
| `test_spiel_logik.js` | Spiellogik: Karte aus Seed (deterministisch, keine Duplikate, Freifeld, Vollbild enthält alle Felder), Linien/Diagonalen, Gewinn Linie und Vollbild, `toggleMark` inkl. `justWon` nur beim Übergang, ungültige Eingaben, neue Karte, Markierungen löschen, alles zurücksetzen. |
| `test_kombi.js` | Kombi-Felder (Einzelpunkte als Checkliste, Feld zählt ab einer Mindestzahl Häkchen): Datenprüfung (ab, Punkte 2–12, Duplikate, Texte), Karte (kopierte Punkte), Schwelle und Zähler, `toggleCheck` (setzen/umschalten/ungültig), Gewinn und `justWon` über ein Kombi-Feld, Vollbild, Zurücksetzen, Speicher (Bereinigung von Häkchen und Zellen), Oberfläche (Fortschritt auf der Karte, Checklisten-Dialog, Neustart, Escaping). |
| `test_storage.js` | Speicher: Rundlauf über Neustart, kaputte Stände (kein JSON, null, Zahl, falsche Typen), Karten-Bereinigung (Zellenzahl, Freifeld-Position, Marks, Länge), Karten unbekannter Spiele bleiben erhalten, geänderte Spielkonfiguration verwirft alte Karte. |
| `test_ansicht.js` | Oberfläche: Tabs, Leerzustand, Spieleliste, Karte (Raster, Freifeld, Zähler), Markieren, Gewinn-Banner/Toast nur beim Übergang, Vollbild, Rückfragen bei neuer Karte/Markierungen löschen (und abschaltbar), Modal-Mechanik, Settings, Installationsanleitung, „Alles löschen“, Escaping von Sonderzeichen, Neustart. |
| `test_e2e_smoke.js` | Alle Spiele komplett durchspielen, Tabs, Settings, Neustart, Zurücksetzen – kein Schritt darf einen JS-Fehler werfen. |

## Hilfsdateien

- `test-helpers.js` – gemeinsame Helfer (`ROOT` = Projektordner, eine Ebene über `test/`): `loadApp()` (Optionen `dataScript`, `dataPath`, `storage`, `transformHtml`, `trackErrors`), `reloadWithState()` (echter Neustart über den Speicherstand), `createChecker()`, `createHelpers(w, d)` (`click`, `cells`, `cell`, `markedPositions`, `visible`, `modalOpen`, `openGameById`). Neue Tests sollen diese Helfer nutzen.
- `mutation-check.js` – Mutationskontrolle (aus rbf2027 übernommen): baut absichtlich einen Fehler ein und prüft, ob die Tests ihn bemerken. Aufruf (aus dem Projektordner): `node test/mutation-check.js test/mutations_spiel.json`. Aktueller Stand: 20 von 20 Mutationen erkannt.
- `mutations_spiel.json` – Mutationen für Logik, Speicher, Modal, Escaping und Kombi-Felder.
- `run-tests.sh` – führt alle (oder gezielt einzelne) `test_*.js` aus.
