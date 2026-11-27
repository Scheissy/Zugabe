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
- **Zoom nur für das Spielfeld:** Zwei Finger auseinander, die Tasten − / ＋ oder die Stufen-Buttons 100 %, 200 %, 300 % und 400 % (Maximum) über der Karte.
  Der Button „100 %“ bringt das ganze Spielfeld zurück; links daneben steht der aktuelle Wert, die aktive Stufe ist hervorgehoben.
  Größere Felder zeigen mehr Text und eine größere Schrift. Beim Öffnen eines Spiels steht der Zoom wieder auf 100 %.
  Der Rahmen um das Spielfeld behält beim Zoomen genau seine Größe (quadratisch wie bei 100 %): nur sein Inhalt wird größer und lässt sich darin verschieben,
  alles außerhalb (Titel, Lupe, Datum und Info, Buttons) bleibt an derselben Stelle.
- **Symbole optional:** Settings → „Symbole (Emojis) auf den Feldern“. Aus = Emojis werden von den Feldtexten entfernt, es passt mehr Text.

### Datum und Info zu einem Feld

Zu jedem Feld lässt sich ein Datum (wann geschafft) und ein Info-Text (z. B. wo, mit wem, bei welcher Band) speichern. Beides ist optional.

- **Datum automatisch:** Beim Markieren eines Felds (bei Kombi-Feldern: beim Erreichen der Schwelle) trägt die App das heutige Datum ein, wenn noch keins gesetzt ist.
  Settings → „Datum automatisch eintragen“ schaltet das ab. Ein eigenes Datum wird nie überschrieben.
- **Bearbeiten:** Feld lang drücken oder in der Lupe „Datum & Info ergänzen/bearbeiten“. Im Dialog: Datumsfeld, „Heute“, „Entfernen“ und ein Info-Text (bis 200 Zeichen). Alles wird sofort gespeichert.
- **Anzeige:** Die Lupe zeigt Datum und Info zum angetippten Feld; ein kleiner goldener Punkt auf dem Feld zeigt, dass eine Info vorhanden ist.
- Beim langen Drücken startet Android zusätzlich seine eigene Textauswahl. Dagegen ist im Dialog die Textauswahl abgeschaltet (Eingabefelder ausgenommen),
  und eine angefangene Auswahl wird beim Öffnen und Loslassen weggeräumt.
- Entmarkieren löscht Datum und Info nicht. „Markierungen löschen“ und „Neue Karte“ setzen sie zurück (mit Rückfrage, auch wenn nur eine Info vorhanden ist).
- Das Freifeld hat keine Details.

### Felder im Spiel umbauen (Textfeld → Kombi-Feld)

Ändert man im Spiel ein Textfeld in ein Kombi-Feld mit gleichem Text (Beispiel: „Gesang in 6 Sprachen“ mit `ab: 6` und eigenen Einträgen), ziehen bereits gespeicherte
und importierte Karten automatisch mit: Die Zelle wird zum Kombi-Feld ohne Häkchen, die frühere einfache Markierung und ein Zähler dieses Felds entfallen
(das Feld ist erst mit genug Häkchen fertig), Datum und Info bleiben, alle anderen Felder bleiben unverändert. Beim Import zeigt der Dialog dazu einen Hinweis;
Sicherungen aus der Zeit vor dem Umbau lassen sich so weiter einlesen.

### Zähler (Felder mehrfach werten)

Ein Textfeld kann mehrfach „geschafft“ werden. Das Antippen des Felds zählt als **1**; hochgezählt wird im Dialog „Datum & Info“ (Feld lang drücken oder in der Lupe)
mit − und ＋ in der Zeile „Anzahl“ (1 bis 99).

- Ab 2 zeigt das Feld unten rechts „×N“, die Lupe nennt „markiert · N×“. Auf einem unmarkierten Feld markiert ＋ das Feld (= 1, mit automatischem Datum).
- Das Antippen eines Felds mit Zähler über 1 fragt vor dem Entmarkieren nach, weil die Zählung dabei verloren geht. Bei Zählerstand 1 geht es wie bisher direkt.
- Ein Feld zählt für Linie und Vollbild und für den Zähler „x von y Feldern“ unabhängig vom Zählerstand einfach als markiert.
- Weitere Zählungen haben vorerst kein eigenes Datum und keine eigene Info. Kombi-Felder (Multi-Select) haben vorerst keinen Zähler.
- Der Zähler steckt in der Sicherung (Export/Import) und wird dort wie alles andere geprüft und bereinigt.
- **Abschaltbar:** Settings → „Zähler (Felder mehrfach zählen)“ (Standard: an). Aus = keine Zeile „Anzahl“ im Dialog, kein „×N“ auf den Feldern, keine Zahl in der Lupe
  und keine Rückfrage beim Entmarkieren. Bereits gespeicherte Zählerstände bleiben erhalten und erscheinen wieder, wenn der Zähler wieder an ist; sie lassen sich bei
  ausgeschaltetem Zähler nicht ändern. Entmarkiert man ein Feld, geht seine Zählung wie immer verloren.

### Sicherung (Export und Import)

Settings → „Sicherung“: Alle Spielstände lassen sich in einer Datei sichern (`zugabe-sicherung-<Datum>.json`) und wieder einlesen,
etwa für ein neues Handy. Die Datei enthält je Spiel die Karte mit Markierungen, Häkchen, eigenen Einträgen, Datum und Info sowie die Einstellungen.

Beim Import wird **jede Karte einzeln gegen das aktuelle Spiel geprüft**, bevor etwas übernommen wird:

- das Spiel muss in der App vorhanden sein (gleiche `id`), die Kartengröße und das Freifeld müssen passen
- **jedes Feld der Karte muss im Spiel vorhanden sein**; Kombi-Felder müssen unverändert sein (Punkte, Schwelle, eigene Einträge), sonst passen die Häkchen nicht mehr
- kein Feld darf doppelt vorkommen; ungültige Markierungen, Häkchen, Datumsangaben usw. werden aussortiert
- Dateien mit falschem Format, unbekannter oder neuerer Versionsnummer, ungültigem JSON oder über 5 MB werden abgelehnt

Der Dialog zeigt je Spiel „✓ importierbar“ (mit Hinweis, ob eine vorhandene Karte ersetzt wird) oder „✕“ mit dem Grund. Übernommen werden nur die geprüften
Karten; Karten anderer Spiele und abgelehnte Karten bleiben unverändert. Die Einstellungen werden nur mit gesetztem Haken übernommen (und ebenfalls geprüft).

### Feste Karten

Mit `fest: true` folgt die Karte der Reihenfolge der Felder im Spiel statt zufällig gemischt zu werden (ein Freifeld in der Mitte bleibt frei;
gibt es mehr Felder als Plätze, werden die ersten genommen). So lässt sich eine bestehende, feste Karte nachbauen. „Neue Karte“ liefert dann
dieselbe Anordnung, nur ohne Markierungen. Ohne `fest` wird bei jeder neuen Karte gemischt.

Mitgeliefert: „Konzerte Bingo Season 10“ (7×7, feste Karte aus einem Screenshot; die ersten 49 Felder bilden die Karte, 3 weitere Felder aus einer zweiten Karte
stehen für den Import bereit), „Festival-Woche“ (7×7, echte Kurztexte) und „Testkarte 9×9 (Dummydaten)“.

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
- Im Dialog stehen die eigenen Einträge als Zeilen in derselben Liste wie die festen Punkte: Häkchen links (nur Anzeige, gesetzt, sobald der Eintrag zählt) und der Text
  als Eingabefeld ohne Rahmen. Doppelte Einträge werden abgeblendet und durchgestrichen (Häkchen aus).
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
