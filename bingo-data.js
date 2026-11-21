// ── bingo-data.js ── Spiele für Zugabe (Konzert-Bingo) (nur Daten, keine Logik) ──
// Jedes Spiel ist ein Eintrag in BINGO_GAMES. Neue Spiele einfach anhängen.
//   id           eindeutig, nur a-z, 0-9 und "-" (wird im Speicherstand als Schlüssel benutzt)
//   titel        Anzeigename
//   beschreibung ein kurzer Satz für die Spieleliste (optional)
//   groesse      3, 4 oder 5 (Karte ist groesse × groesse)
//   freiMitte    true = mittleres Feld ist ein Freifeld (nur bei ungerader Größe sinnvoll)
//   ziel         'linie' (eine volle Reihe/Spalte/Diagonale gewinnt) oder 'vollbild' (alle Felder)
//   felder       Liste aller möglichen Felder; es dürfen MEHR sein als auf die Karte passen,
//                dann wird bei jeder neuen Karte zufällig ausgewählt
// Die Prüfung (Eindeutigkeit, genug Felder, …) macht validateGames() in js/01-data.js.
// Die Spiele unten sind ein Startpunkt und können beliebig geändert oder ergänzt werden.
const BINGO_DATA_VERSION = 2;
const BINGO_GAMES = [
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
      'Tanzende Security', 'Ohrenstöpsel vergessen'
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
      'Jemand ruft nach dem Hit', 'Ausverkauftes Haus', 'Garderoben-Schlange', 'Lieblingslied gespielt'
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
