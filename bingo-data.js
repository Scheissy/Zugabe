// ── bingo-data.js ── Spiele für Zugabe (Konzert-Bingo) (nur Daten, keine Logik) ──
// Jedes Spiel ist ein Eintrag in BINGO_GAMES. Neue Spiele einfach anhängen.
//   id           eindeutig, nur a-z, 0-9 und "-" (wird im Speicherstand als Schlüssel benutzt)
//   titel        Anzeigename
//   beschreibung ein kurzer Satz für die Spieleliste (optional)
//   groesse      3, 4, 5, 7 oder 9 (Karte ist groesse × groesse)
//   freiMitte    true = mittleres Feld ist ein Freifeld (nur bei ungerader Größe sinnvoll)
//   fest         optional, true = feste Karte: die Felder stehen in der Reihenfolge der Liste (Freifeld in der Mitte
//                bleibt frei); ohne fest wird bei jeder neuen Karte zufällig gemischt und ausgewählt
//   ziel         'linie' (eine volle Reihe/Spalte/Diagonale gewinnt) oder 'vollbild' (alle Felder)
//   felder       Liste aller möglichen Felder; es dürfen MEHR sein als auf die Karte passen,
//                dann wird bei jeder neuen Karte zufällig ausgewählt. Ein Eintrag ist entweder ein Text
//                oder ein Kombi-Feld:
//                  { text: 'Sprachen, in denen gesungen wird', ab: 3, punkte: ['Deutsch', 'Englisch', …] }
//                Beim Tippen öffnet sich eine Checkliste mit den punkte (2 bis 12); das Feld zählt als
//                markiert, sobald mindestens ab Punkte abgehakt sind.
//                Optional: eigene: true erlaubt zusätzlich bis zu 10 selbst eingetragene Einträge (Freitext,
//                nach jedem ausgefüllten Feld erscheint ein neues); sie zählen wie abgehakte Punkte.
//                eigeneHinweis ist der Platzhaltertext im Eingabefeld. Mit eigene: true darf punkte auch
//                weniger als 2 Einträge haben, und ab darf bis punkte + 10 gehen.
//                Kurztexte für große Karten: Ein Feld darf als Paar [text, kurztext] stehen (bei Kombi-Feldern
//                kurz: '…'). Auf dem Feld steht dann der Kurztext (empfohlen bis 20 Zeichen), der ganze Text
//                erscheint beim Antippen in der Lupe unter der Karte.
// Die Prüfung (Eindeutigkeit, genug Felder, …) macht validateGames() in js/01-data.js.
// Die Spiele unten sind ein Startpunkt und können beliebig geändert oder ergänzt werden.
const BINGO_DATA_VERSION = 9;

// Dummydaten für die Testkarte 9×9: 9 Akteure × 9 Ereignisse = 81 verschiedene Felder mit Kurztext.
const DUMMY_FELDER = (() => {
  const wer = [['Sänger', '🎤'], ['Gitarrist', '🎸'], ['Drummer', '🥁'], ['Publikum', '🙌'], ['Security', '🦺'], ['Headliner', '⭐'], ['Vorband', '🎶'], ['Technik', '🎛️'], ['Bassistin', '🎵']];
  const was = [['verpasst den Einsatz', 'Einsatz'], ['tanzt auf der Bühne', 'tanzt'], ['trinkt Wasser', 'trinkt'], ['wechselt das Instrument', 'Wechsel'], ['spricht Deutsch', 'Deutsch'], ['hat Geburtstag', 'Geburtstag'], ['trägt Sonnenbrille', 'Brille'], ['bedankt sich', 'Danke'], ['verspricht eine Zugabe', 'Zugabe']];
  const out = [];
  for (let i = 0; i < 81; i++) { const k = (i * 37) % 81, w = wer[k % 9], e = was[Math.floor(k / 9)]; out.push([w[0] + ' ' + e[0], w[1] + ' ' + e[1]]); }
  return out;
})();
const BINGO_GAMES = [
  {
    // Aus einem Screenshot übernommen (7 × 7, Reihenfolge Zeile für Zeile); die im Screenshot angeschnittenen Felder
    // wurden mit dem vollen Wortlaut ergänzt. "Le HH B Hal HB" = Leipzig, Hamburg, Braunschweig, Halle, Bremen.
    id: 'konzerte-bingo-season-10',
    titel: 'Konzerte Bingo Season 10',
    beschreibung: '7×7, feste Karte (Reihenfolge wie im Original)',
    groesse: 7, freiMitte: false, ziel: 'linie', fest: true,
    felder: [
      { text: 'Gesang in 6 Sprachen', ab: 6, punkte: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch', 'Italienisch', 'Portugiesisch', 'Türkisch', 'Russisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' },
      'Feature vom Band', 'Überraschungsgast auf der Bühne', 'nur einer von 4 Rappern gut', '30 Minuten Verspätung', 'vor Ort erkennen, dass die Band schon kannte', 'Weniger als eine Stunde Hauptact',
      'Weihnachtskonzert', 'plötzlich selbst on Stage', 'alle in die Knie gehen', 'Kein Le HH B Hal HB Konzert', 'Bands zweimal im Jahr sehen', 'Flinta Moshpit zum Ausruhen', '5 Tage am Stück Konzerte',
      'Keine Zugabe spielen', 'über 2 Stunden Hauptact', 'Neue Location', 'Special Location', 'Signierte Support Vinyl', 'Künstler zu Tränen gerührt', 'Moshpit mit Band',
      'Text oder Akkorde vergessen', 'Künstler freestyled', 'Reunion Konzert', 'Beyoncé auch vom Band', 'T-Shirt kaufen', 'Tagesfestival mit 5 Bands', 'Schallplatte an der Garderobe abgeben',
      'von der Disco raus geworfen werden', 'Musiker aus anderen Bands im Publikum', 'Secu erkennt dich.', 'Wir sind Helden Cover', 'RBF Entdeckung', 'Open Air Konzert', 'Abschiedstournee',
      'vorher nicht reingehört, dann Vinyl gekauft', '5 Tage ohne Konzert', 'Felix in Berlin besuchen', 'Hip Hop Crew aus den 90ern', 'Unsignierte Vinyl mitnehmen', 'Künstler erkennt dich', '2 unterschiedliche Locations an einem Tag',
      'Vinyl für Discogs erstellen', '3 Monate vorher Ticket kaufen', 'Ihr Süßmäuse von der Bühne', 'keine Vinyl dabei', 'Dutch Disease Leute quatschen', 'Band zum 5. mal sehen', 'Künstler verteilen Alkohol',
      // Ab hier: Felder, die auf einer zweiten Karte desselben Spiels vorkamen (andere Anordnung). Die ersten 49 Felder bilden
      // die feste Karte; diese hier sind für den Import weiterer Spielstände da.
      'Amerikanische Künstler', 'RBF Location', '4 Rapper auf der Bühne höchstens einer kann rappen'
    ]
  },
  {
    id: 'festival',
    titel: 'Festival',
    beschreibung: 'Mehrtägig, Open Air, viel Programm',
    groesse: 5, freiMitte: true, ziel: 'linie',
    felder: [
      'Open Air Location', '5 Tage Konzerte am Stück', 'Regen im Konzert', 'Schlamm bis zu den Knöcheln',
      'Dixi-Schlange', 'Bändchen am Handgelenk', 'Zeltplatz-Nachbar mit Gitarre', 'Headliner kommt zu spät',
      'Zugabe-Rufe', 'Pfandbecher-Schlange', 'Sonnenbrand', 'Gummistiefel',
      'Crowdsurfer', 'Wall of Death', 'Schlechter Ton beim ersten Lied', 'Jemand sitzt auf den Schultern',
      'Merch-Schlange', 'Kein Handyempfang', 'Powerbank leer', 'Künstler hat den Text vergessen',
      'Überraschungsgast', 'Pyro auf der Bühne', 'Zwei Bühnen überschneiden sich', 'Lieblingslied verpasst',
      'Frühstück um 14 Uhr', 'Wasserstation leer', 'Shuttle-Bus überfüllt', 'Einlass-Schlange',
      'Tanzende Security', 'Ohrenstöpsel vergessen',
      { text: 'Sprachen, in denen gesungen wird', ab: 3, punkte: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch', 'Italienisch', 'Japanisch', 'Portugiesisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' },
      { text: 'Wetter erlebt', ab: 3, punkte: ['Sonne', 'Regen', 'Wind', 'Gewitter', 'Nebel', 'Hitze', 'Kälte'] }
    ]
  },
  {
    id: 'konzertabend',
    titel: 'Konzertabend',
    beschreibung: 'Klassiker aus der Halle oder dem Theater',
    groesse: 5, freiMitte: true, ziel: 'linie',
    felder: [
      'Vorband spielt zu lang', 'Künstler hat den Text vergessen', 'Alle halten das Handy hoch', 'Zugabe',
      'Gitarre wird gewechselt', 'Publikum singt mit', 'Bier verschüttet', 'Jemand steht direkt vor dir',
      'Setlist liegt auf dem Boden', 'Schlagzeug-Solo', 'Ansage: Das nächste Lied ist neu', 'Mikrofon fällt aus',
      'Gitarrensaite reißt', 'Taschenlampen im Publikum', 'Klatschen im Takt', 'Ballade mit Lichtermeer',
      'Künstler trinkt aus dem Becher', 'Merch-Stand nach dem Konzert', 'Jemand tanzt allein', 'Verspäteter Beginn',
      'Rückkopplung', 'Hit zum Schluss', 'Fotograf im Graben', 'Pyro auf der Bühne',
      'Jemand ruft nach dem Hit', 'Ausverkauftes Haus', 'Garderoben-Schlange', 'Lieblingslied gespielt',
      { text: 'Instrumente auf der Bühne', ab: 4, punkte: ['Gitarre', 'Bass', 'Schlagzeug', 'Keyboard', 'Geige', 'Saxofon', 'Trompete', 'Akkordeon'] },
      { text: 'Sprachen, in denen gesungen wird', ab: 2, punkte: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' }
    ]
  },
  {
    id: 'klubnacht',
    titel: 'Klubnacht',
    beschreibung: 'Kleine Karte für den Abend im Klub',
    groesse: 3, freiMitte: true, ziel: 'linie',
    felder: [
      'Schlange vor der Tür', 'Stempel auf der Hand', 'Verspätete Band', 'Kleine Bühne', 'Nebelmaschine',
      'Enge Garderobe', 'Barkeeper kennt dich', 'Zu laute Vorband', 'Lieblingssong gespielt',
      'Letzte Bahn knapp erwischt', 'Tropfende Decke', 'Tanzfläche voll'
    ]
  },
  {
    id: 'festivalwoche',
    titel: 'Festival-Woche',
    beschreibung: '7×7 mit Kurztexten – der ganze Text steht in der Lupe',
    groesse: 7, freiMitte: true, ziel: 'linie',
    felder: [
      ['Open Air Location', 'Open Air'], ['5 Tage Konzerte am Stück', '5 Tage'], ['Künstler hat den Text vergessen', 'Text vergessen'],
      ['Regen im Konzert', 'Regen'], ['Schlamm bis zu den Knöcheln', 'Schlamm'], ['Dixi-Schlange', 'Dixi'], ['Bändchen am Handgelenk', 'Bändchen'],
      ['Headliner kommt zu spät', 'Verspätung'], ['Zugabe-Rufe', 'Zugabe'], ['Pfandbecher-Schlange', 'Pfand'], ['Sonnenbrand', 'Sonnenbrand'],
      ['Gummistiefel', 'Gummistiefel'], ['Crowdsurfer', 'Crowdsurfer'], ['Wall of Death', 'Wall of Death'], ['Schlechter Ton beim ersten Lied', 'Ton schlecht'],
      ['Jemand sitzt auf den Schultern', 'Schultern'], ['Merch-Schlange', 'Merch'], ['Kein Handyempfang', 'Kein Netz'], ['Powerbank leer', 'Powerbank'],
      ['Überraschungsgast', 'Gast'], ['Pyro auf der Bühne', 'Pyro'], ['Zwei Bühnen überschneiden sich', 'Überschneidung'], ['Lieblingslied verpasst', 'Lied verpasst'],
      ['Frühstück um 14 Uhr', 'Frühstück'], ['Wasserstation leer', 'Wasser leer'], ['Shuttle-Bus überfüllt', 'Shuttle voll'], ['Einlass-Schlange', 'Einlass'],
      ['Tanzende Security', 'Security'], ['Ohrenstöpsel vergessen', 'Ohrstöpsel'], ['Band bedankt sich beim Team', 'Dank ans Team'],
      ['Gitarrist wirft Plektrum ins Publikum', 'Plektrum'], ['Sänger stellt eine Mitmach-Frage', 'Mitmach-Frage'], ['Konfettikanone', 'Konfetti'],
      ['Luftballons im Publikum', 'Luftballons'], ['Jemand hat ein Banner dabei', 'Banner'], ['Stimme nach dem dritten Lied heiser', 'Heiser'],
      ['Lichtshow im Takt', 'Lichtshow'], ['Drummer wirft einen Stick', 'Drumstick'], ['Mitsing-Spiel mit dem Publikum', 'Mitsingen'],
      ['Akustik-Set auf der Bühne', 'Akustik'], ['Cover-Song als Überraschung', 'Cover'], ['Band spielt das neue Album', 'Neues Album'],
      ['Spontane Geburtstagsansage', 'Geburtstag'], ['Jemand ruft nach dem Hit', 'Hit-Ruf'], ['Handy-Taschenlampen leuchten', 'Taschenlampen'],
      ['Staub und Hitze vor der Bühne', 'Staub'], ['Wellenbrecher komplett voll', 'Wellenbrecher'], ['Foodtruck mit langer Schlange', 'Foodtruck'],
      ['Zeltplatz-Nachbar mit Gitarre', 'Zeltplatz'], ['Gewitterwarnung wird durchgesagt', 'Gewitter'], ['Programm verspätet sich um eine Stunde', 'Zeitplan'],
      { text: 'Sprachen, in denen gesungen wird', kurz: 'Sprachen', ab: 3, punkte: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch', 'Italienisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' },
      { text: 'Wetter erlebt', kurz: 'Wetter', ab: 3, punkte: ['Sonne', 'Regen', 'Wind', 'Gewitter', 'Nebel', 'Hitze', 'Kälte'] }
    ]
  },
  {
    id: 'testkarte9',
    titel: 'Testkarte 9×9 (Dummydaten)',
    beschreibung: '81 Felder zum Ausprobieren der Lesbarkeit',
    groesse: 9, freiMitte: true, ziel: 'linie',
    felder: DUMMY_FELDER
  },
  {
    id: 'marathon',
    titel: 'Festival-Marathon',
    beschreibung: 'Vollbild: alle 16 Felder müssen fallen',
    groesse: 4, freiMitte: false, ziel: 'vollbild',
    felder: [
      'Open Air Location', '5 Tage Konzerte am Stück', 'Künstler hat den Text vergessen', 'Regen im Konzert',
      'Zugabe-Rufe', 'Crowdsurfer', 'Überraschungsgast', 'Wall of Death',
      'Pyro auf der Bühne', 'Schlamm bis zu den Knöcheln', 'Pfandbecher-Schlange', 'Bändchen am Handgelenk',
      'Merch gekauft', 'Ohrenstöpsel vergessen', 'Kein Handyempfang', 'Sonnenbrand'
    ]
  }
];
