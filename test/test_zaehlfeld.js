const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Zählfelder: ein Feld, das man hochzählt (0 bis 999) und das ab einem Schwellwert (je Feld verschieden) als geschafft gilt.
// Beispiele aus „Konzerte Bingo Season 10“: „5 Tage am Stück Konzerte“, „5 Tage ohne Konzert“, „2 unterschiedliche Locations an einem Tag“.
// Daten: { text, zaehlfeld: true, ab, einheit }, Zelle auf der Karte: { t, ab, z: true, u }, Zählerstand in card.stand[Position].
const GAME = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'z', titel:'Z', groesse:3, freiMitte:false, ziel:'linie', fest:true,
  felder:['a','b','c','d','e','f', { text: 'Tage am Stück', zaehlfeld: true, ab: 5, einheit: 'Tage' }, { text: 'Locations', zaehlfeld: true, ab: 2 }, { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }] }];`;
const TODAY = '2026-11-28';
const TAGE = 6, LOC = 7, KOMBI = 8;   // Positionen auf der festen Karte

(async () => {
  const t = createChecker();
  const A = await loadApp({ trackErrors: true, dataScript: GAME });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  w.todayStr = () => TODAY;
  const card = () => w.eval('appState.cards.z');
  const game = () => w.gameById('z');
  const none = r => !r.changed && !r.won && !r.justWon;
  w.localStorage.clear(); w.startGame('z');

  // ───────── 1) Datenprüfung ─────────
  const fill = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const problems = f => w.validateGames([{ id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: fill.concat([f]) }]);
  const bad = (f, re) => problems(f).some(i => i.level === 'fehler' && re.test(i.text));
  t.check('Die Testdaten (zwei Zählfelder, ein Kombi-Feld) sind fehlerfrei und spielbar.', w.validateGames(w.eval('allGames')).length === 0 && !!game());
  t.check('Gültige Zählfelder: mit und ohne Einheit, Schwelle 1 und 999.', [{ text: 'T', zaehlfeld: true, ab: 1 }, { text: 'T', zaehlfeld: true, ab: 999, einheit: 'Tage' }].every(f => problems(f).length === 0));
  t.check('ab fehlt, 0, 1000, Kommazahl oder Text ist ein Fehler.', [undefined, 0, 1000, 2.5, '5', NaN].every(ab => bad({ text: 'T', zaehlfeld: true, ab: ab }, /ab muss eine ganze Zahl/)));
  t.check('einheit: leer, Zahl oder über 20 Zeichen ist ein Fehler.', ['', '  ', 5, 'x'.repeat(21)].every(e => bad({ text: 'T', zaehlfeld: true, ab: 2, einheit: e }, /einheit muss/)));
  t.check('Zählfeld ohne Text ist ein Fehler.', bad({ zaehlfeld: true, ab: 2 }, /ohne text/) && bad({ text: '  ', zaehlfeld: true, ab: 2 }, /ohne text/));
  t.check('punkte oder eigene an einem Zählfeld sind ein Fehler (Verwechslung mit dem Kombi-Feld).', bad({ text: 'T', zaehlfeld: true, ab: 2, punkte: ['x', 'y'] }, /nur bei Kombi-Feldern/) && bad({ text: 'T', zaehlfeld: true, ab: 2, eigene: true }, /nur bei Kombi-Feldern/));
  t.check('zaehlfeld: \'ja\' (kein true) wird nicht stillschweigend als Kombi-Feld gespielt, sondern gemeldet.', bad({ text: 'T', zaehlfeld: 'ja', ab: 2 }, /zaehlfeld muss true sein/));
  t.check('Doppelte Texte zwischen Zählfeld und Textfeld werden gemeldet.', bad({ text: 'A', zaehlfeld: true, ab: 2 }, /doppelte Felder/));
  t.check('Ein Spiel mit fehlerhaftem Zählfeld ist nicht spielbar.', (() => { const g = { id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: fill.concat([{ text: 'T', zaehlfeld: true, ab: 0 }]) }; return w.validateGames([g]).some(i => i.level === 'fehler'); })());
  t.check('Kurztext (kurz) an einem Zählfeld wird wie bei anderen Feldern übernommen.', w.normalizeGames([{ id: 'x', felder: [{ text: 'Tage am Stück', zaehlfeld: true, ab: 5, kurz: 'Tage' }] }])[0].kurz['Tage am Stück'] === 'Tage');

  // ───────── 2) Karte und Logik ─────────
  const c0 = card();
  t.check('Karte: das Zählfeld wird zur Zelle { t, ab, z, u }, ohne Einheit fehlt u; Zählerstand 0, nichts markiert.',
    JSON.stringify(c0.cells[TAGE]) === JSON.stringify({ t: 'Tage am Stück', ab: 5, z: true, u: 'Tage' }) && JSON.stringify(c0.cells[LOC]) === JSON.stringify({ t: 'Locations', ab: 2, z: true })
    && JSON.stringify(c0.stand) === '{}' && w.zahlOf(c0, TAGE) === 0 && !w.isMarked(c0, TAGE) && w.markedCount(c0) === 0);
  t.check('Konstanten: höchster Zählerstand 999, Einheit höchstens 20 Zeichen.', w.eval('MAX_ZAHL') === 999 && w.eval('MAX_EINHEIT') === 20);
  let r = w.setZahl('z', TAGE, 3);
  t.check('Zählerstand 3 (Schwelle 5): gespeichert, Feld noch nicht geschafft, nicht gezählt, kein Datum, kein Gewinn.',
    r.changed && !r.won && !r.justWon && card().stand[TAGE] === 3 && !w.isMarked(card(), TAGE) && w.markedCount(card()) === 0 && !card().details[TAGE]);
  t.check('Dieselbe Zahl noch einmal setzen ändert nichts.', none(w.setZahl('z', TAGE, 3)));
  w.setZahl('z', TAGE, 4);
  t.check('4 von 5: noch nicht geschafft.', !w.isMarked(card(), TAGE));
  w.setZahl('z', TAGE, 5);
  t.check('Genau der Schwellwert (5): Feld geschafft, zählt für die Anzahl, Datum automatisch eingetragen.', w.isMarked(card(), TAGE) && w.markedCount(card()) === 1 && card().details[TAGE].d === TODAY);
  w.setZahl('z', TAGE, 15);
  t.check('Weiter hochzählen (15): bleibt geschafft, der Stand ist 15.', w.isMarked(card(), TAGE) && card().stand[TAGE] === 15 && w.markedCount(card()) === 1);
  w.setZahl('z', TAGE, 4);
  t.check('Zurück unter den Schwellwert: Feld fällt zurück; das Datum bleibt erhalten.', !w.isMarked(card(), TAGE) && w.markedCount(card()) === 0 && card().details[TAGE].d === TODAY);
  w.setZahl('z', TAGE, 0);
  t.check('Auf 0 setzen entfernt den Eintrag aus dem Zählerstand.', !(TAGE in card().stand) && w.zahlOf(card(), TAGE) === 0);
  w.setZahl('z', TAGE, 999);
  t.check('Obergrenze 999 ist erlaubt.', w.zahlOf(card(), TAGE) === 999 && w.isMarked(card(), TAGE));
  t.check('Ungültige Werte werden ignoriert: negativ, 1000, Kommazahl, Text, NaN, unendlich, null, undefined.', [-1, 1000, 1.5, '3', NaN, Infinity, null, undefined].every(v => none(w.setZahl('z', TAGE, v))) && w.zahlOf(card(), TAGE) === 999);
  t.check('Ungültige Felder werden ignoriert: Textfeld, Kombi-Feld, Position außerhalb, negativ, Kommazahl, unbekanntes Spiel.', [[0, 2], [KOMBI, 2], [99, 2], [-1, 2], [1.5, 2]].every(([p, n]) => none(w.setZahl('z', p, n))) && none(w.setZahl('nix', TAGE, 2)));
  t.check('Jedes Zählfeld hat seinen eigenen Schwellwert: „Locations“ ist ab 2 geschafft, nicht schon bei 1.', (() => { w.setZahl('z', LOC, 1); const a = w.isMarked(card(), LOC); w.setZahl('z', LOC, 2); return !a && w.isMarked(card(), LOC); })());
  t.check('Antippen-Logik: toggleMark ändert ein Zählfeld nicht.', none(w.toggleMark('z', TAGE)) && !card().marks.includes(TAGE) && w.zahlOf(card(), TAGE) === 999);
  t.check('Die Einstellung „Zähler (Felder mehrfach zählen)“ betrifft Zählfelder nicht: auch bei aus lässt sich zählen.', (() => { w.eval('appState.settings.zaehler = false'); const x = w.setZahl('z', TAGE, 7).changed; w.eval('appState.settings.zaehler = true'); return x && w.zahlOf(card(), TAGE) === 7; })());

  // Gewinn über eine Reihe mit Zählfeldern: letzte Reihe = Positionen 6, 7, 8
  w.setZahl('z', TAGE, 5); w.setZahl('z', LOC, 2);
  t.check('Zwei Zählfelder geschafft, das Kombi-Feld noch nicht: noch kein Bingo.', !w.isWon(game(), card()));
  w.toggleCheck('z', KOMBI, 0, true);
  r = w.toggleCheck('z', KOMBI, 1, true);
  t.check('Mit dem Kombi-Feld ist die Reihe voll: Bingo (justWon beim Übergang).', r.justWon && w.isWon(game(), card()) && w.winningLines(card(), 3).length === 1);
  r = w.setZahl('z', TAGE, 9);
  t.check('Weiterzählen über den Schwellwert beendet das Bingo nicht und meldet kein zweites justWon.', !r.justWon && r.won && w.isWon(game(), card()));
  r = w.setZahl('z', TAGE, 2);
  t.check('Unter den Schwellwert fällt das Bingo wieder weg; erneutes Erreichen meldet justWon.', !w.isWon(game(), card()) && w.setZahl('z', TAGE, 5).justWon);

  // ───────── 3) Zurücksetzen ─────────
  w.setZahl('z', TAGE, 12);
  t.check('hasMarks() zählt auch einen Zählerstand unter dem Schwellwert (damit „Neue Karte“ nachfragt).', (() => { w.resetMarks('z'); w.setZahl('z', TAGE, 3); return w.hasMarks(); })());
  w.resetMarks('z');
  t.check('„Markierungen löschen“ setzt die Zählerstände zurück.', JSON.stringify(card().stand) === '{}' && !w.isMarked(card(), TAGE));
  w.setZahl('z', LOC, 4);
  const seedBefore = card().seed;
  w.newCardFor('z');
  t.check('„Neue Karte“ beginnt ohne Zählerstände.', JSON.stringify(card().stand) === '{}' && card().seed !== seedBefore && w.zahlOf(card(), LOC) === 0);

  // ───────── 4) Speicher ─────────
  const rawCells = card().cells;
  const san = (stand, cells) => w.sanitizeCard(game(), { seed: 1, cells: cells || rawCells, marks: [], checks: {}, eigene: {}, details: {}, counts: {}, stand: stand });
  t.check('Bereinigung: gültige Stände bleiben (1 bis 999).', (st => st[TAGE] === 3 && st[LOC] === 999)(san({ [TAGE]: 3, [LOC]: 999 }).stand));
  t.check('Bereinigung: Stände für Textfelder, Kombi-Felder, Freifelder und Positionen außerhalb fallen weg.', JSON.stringify(san({ 0: 2, [KOMBI]: 2, 9: 2, [-1]: 2 }).stand) === '{}');
  t.check('Bereinigung: 0, negativ, 1000, Kommazahl, Text und verschachtelte Werte fallen weg.', [0, -3, 1000, 2.5, '4', null, [4], { a: 1 }].every(v => JSON.stringify(san({ [TAGE]: v }).stand) === '{}'));
  t.check('Bereinigung: Schlüssel wie „06“, „6.0“ oder „__proto__“ werden nicht als Position gelesen.', JSON.stringify(san({ '06': 3, '6.0': 3, '__proto__': 3, constructor: 3 }).stand) === '{}');
  t.check('Karte ohne stand (alte Speicherstände) wird gelesen, stand ist dann leer.', JSON.stringify(san(undefined).stand) === '{}' && !!san(undefined));
  t.check('Bereinigung: eine Zählfeld-Zelle mit ungültiger Schwelle macht die Karte ungültig (ab 0, 1000, fehlt), ohne Text auch.', [0, 1000, undefined, 2.5].every(ab => { const cs = rawCells.slice(); cs[TAGE] = { t: 'Tage am Stück', ab: ab, z: true }; return san({}, cs) === null; }) && (() => { const cs = rawCells.slice(); cs[TAGE] = { t: '', ab: 5, z: true }; return san({}, cs) === null; })());
  t.check('Bereinigung: Einheit wird getrimmt und auf 20 Zeichen gekürzt, leere Einheit fällt weg, Fremdschlüssel fallen weg.', (() => {
    const cs = rawCells.slice();
    cs[TAGE] = { t: 'Tage am Stück', ab: 5, z: true, u: '  ' + 'x'.repeat(30) + '  ', evil: 1 };
    cs[LOC] = { t: 'Locations', ab: 2, z: true, u: '   ' };
    const c = san({}, cs);
    return c.cells[TAGE].u === 'x'.repeat(20) && !('evil' in c.cells[TAGE]) && !('u' in c.cells[LOC]);
  })());

  // Neustart: Zählerstand bleibt, Feld bleibt geschafft
  w.setZahl('z', TAGE, 11); w.setZahl('z', LOC, 1);
  const A2 = await reloadWithState(w, { trackErrors: true, dataScript: GAME });
  const c2 = A2.window.eval('appState.cards.z');
  t.check('Neustart: Zählerstände bleiben erhalten; „11 von 5“ ist geschafft, „1 von 2“ nicht.', c2.stand[TAGE] === 11 && c2.stand[LOC] === 1 && A2.window.isMarked(c2, TAGE) && !A2.window.isMarked(c2, LOC));

  // ───────── 5) Umstellung: Textfeld wird Zählfeld ─────────
  const OLD_GAME = GAME.replace("{ text: 'Tage am Stück', zaehlfeld: true, ab: 5, einheit: 'Tage' }, { text: 'Locations', zaehlfeld: true, ab: 2 }, { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }", "'Tage am Stück', 'Locations', { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }");
  const AO = await loadApp({ trackErrors: true, dataScript: OLD_GAME });
  AO.window.localStorage.clear(); AO.window.startGame('z');
  AO.window.toggleMark('z', TAGE); AO.window.setCount('z', TAGE, 7); AO.window.setDetail('z', TAGE, { i: 'Info bleibt' });
  const A3 = await reloadWithState(AO.window, { trackErrors: true, dataScript: GAME });
  const c3 = A3.window.eval('appState.cards.z');
  t.check('Alte Karte (Textfeld, 7× gezählt, mit Info) wird beim Start zum Zählfeld: Stand 7 (nicht kleiner als der Schwellwert), Markierung und alter Zähler weg, Info bleibt.',
    c3.cells[TAGE].z === true && c3.cells[TAGE].ab === 5 && c3.stand[TAGE] === 7 && !c3.marks.includes(TAGE) && !(TAGE in c3.counts) && c3.details[TAGE].i === 'Info bleibt' && A3.window.isMarked(c3, TAGE));
  {
    AO.window.resetMarks('z'); AO.window.toggleMark('z', TAGE);
    const X = await reloadWithState(AO.window, { dataScript: GAME });
    const cx = X.window.eval('appState.cards.z');
    t.check('Ein bisher nur einfach markiertes Textfeld (1×) wird zum Zählfeld mit Stand = Schwellwert (5) und bleibt geschafft.', cx.stand[TAGE] === 5 && X.window.isMarked(cx, TAGE));
  }
  t.check('Ein nicht markiertes Textfeld wird zum Zählfeld ohne Stand.', c3.cells[LOC].z === true && !(LOC in c3.stand) && !A3.window.isMarked(c3, LOC));
  t.check('Stabil: nach noch einem Neustart bleibt alles gleich.', await (async () => { const A4 = await reloadWithState(A3.window, { dataScript: GAME }); return JSON.stringify(A4.window.eval('appState.cards.z')) === JSON.stringify(A3.window.eval('appState.cards.z')); })());

  // ───────── 6) Sicherung ─────────
  w.localStorage.clear(); w.eval('appState.cards = {}'); w.startGame('z'); w.setZahl('z', TAGE, 8); w.setZahl('z', LOC, 1);
  const backup = w.buildBackup();
  t.check('Export: der Zählerstand steckt in der gesicherten Karte.', backup.spiele.z.karte.stand[TAGE] === 8 && backup.spiele.z.karte.stand[LOC] === 1);
  const roundtrip = w.checkImportedCard(game(), JSON.parse(JSON.stringify(backup.spiele.z)));
  t.check('Import der eigenen Sicherung: akzeptiert, Zählerstände unverändert.', !!roundtrip.card && roundtrip.problems.length === 0 && roundtrip.card.stand[TAGE] === 8 && roundtrip.card.stand[LOC] === 1);
  const tampered = JSON.parse(JSON.stringify(backup.spiele.z)); tampered.karte.stand[TAGE] = 5000; tampered.karte.stand[0] = 3; tampered.karte.stand[LOC] = 'viel';
  const rt2 = w.checkImportedCard(game(), tampered);
  t.check('Import: ungültige Zählerstände werden aussortiert, der Rest bleibt.', !!rt2.card && JSON.stringify(rt2.card.stand) === '{}');
  const changedCell = JSON.parse(JSON.stringify(backup.spiele.z)); changedCell.karte.cells[TAGE].ab = 3;
  t.check('Import: ein Zählfeld mit anderem Schwellwert im Spiel wird abgelehnt (der Stand würde sonst etwas anderes bedeuten).', (rr => !rr.card && rr.problems.some(p => /Zählfeld hat sich im Spiel geändert/.test(p)))(w.checkImportedCard(game(), changedCell)));
  const changedUnit = JSON.parse(JSON.stringify(backup.spiele.z)); changedUnit.karte.cells[TAGE].u = 'Wochen';
  t.check('Import: eine andere Einheit gilt ebenfalls als Änderung.', !w.checkImportedCard(game(), changedUnit).card);
  const missing = JSON.parse(JSON.stringify(backup.spiele.z)); missing.karte.cells[TAGE].t = 'Gibt es nicht';
  t.check('Import: ein Zählfeld, das es im Spiel nicht gibt, wird abgelehnt.', (rr => !rr.card && rr.problems.some(p => /nicht vorhanden/.test(p)))(w.checkImportedCard(game(), missing)));
  const dup = JSON.parse(JSON.stringify(backup.spiele.z)); dup.karte.cells[LOC] = Object.assign({}, dup.karte.cells[TAGE]);
  t.check('Import: dasselbe Zählfeld zweimal auf der Karte wird abgelehnt.', (rr => !rr.card && rr.problems.some(p => /mehrfach/.test(p)))(w.checkImportedCard(game(), dup)));
  const oldFormat = { groesse: 3, karte: { seed: 1, cells: ['a', 'b', 'c', 'd', 'e', 'f', 'Tage am Stück', 'Locations', 'Sprachen'], marks: [TAGE], checks: {}, eigene: {}, details: {}, counts: { [TAGE]: 3 } } };
  const ro = w.checkImportedCard(game(), oldFormat);
  t.check('Import einer alten Sicherung (Textfeld statt Zählfeld): wird übernommen, mit Hinweis; die frühere Markierung gilt als Schwellwert (5).',
    !!ro.card && ro.card.stand[TAGE] === 5 && ro.card.cells[TAGE].z === true && ro.notes.some(n => /„Tage am Stück“ ist jetzt ein Zählfeld; die frühere Markierung gilt als 5 gezählt/.test(n)) && ro.notes.length >= 1);

  // ───────── 7) Oberfläche ─────────
  w.localStorage.clear(); w.eval('appState.cards = {}'); w.switchTab('spiele'); H.openGameById('z');
  const prog = p => H.cell(p).querySelector('.cell-progress').textContent;
  t.check('Karte: Zählfelder sind eigene Feld-Art (counter), Text und Fortschritt „0/5“ bzw. „0/2“; ihr Text ist der volle Text.',
    H.cell(TAGE).classList.contains('counter') && !H.cell(TAGE).classList.contains('marked') && H.cell(TAGE).querySelector('.cell-text').textContent === 'Tage am Stück' && prog(TAGE) === '0/5' && prog(LOC) === '0/2');
  t.check('Barrierefreiheit: aria-label nennt Text, Stand (mit Einheit) und Schwellwert; das Feld öffnet einen Dialog.', H.cell(TAGE).getAttribute('aria-label') === 'Tage am Stück, 0 Tage von 5' && H.cell(LOC).getAttribute('aria-label') === 'Locations, 0 von 2' && H.cell(TAGE).getAttribute('aria-haspopup') === 'dialog');
  H.click(H.cell(TAGE));
  const input = () => d.getElementById('zahlInput'), plus = () => d.getElementById('zahlPlus'), minus = () => d.getElementById('zahlMinus'), reset = () => d.getElementById('zahlReset');
  const progress = () => d.getElementById('zahlProgress');
  const type = v => { input().value = v; input().dispatchEvent(new w.Event('input', { bubbles: true })); };
  t.check('Antippen öffnet den Zähl-Dialog (nicht markiert): Titel, Stand 0, Einheit, Hinweistext; − und Zurücksetzen sind aus.',
    H.modalOpen('zahlModal') && d.getElementById('zahlTitle').textContent === 'Tage am Stück' && input().value === '0' && d.getElementById('zahlUnit').textContent === 'Tage'
    && progress().textContent === '0 Tage – ab 5 zählt das Feld.' && minus().disabled && reset().disabled && !plus().disabled && !card().marks.length);
  for (let i = 0; i < 4; i++) H.click(plus());
  t.check('4× ＋: Stand 4, Feld noch nicht geschafft, Karte zeigt „4/5“.', input().value === '4' && prog(TAGE) === '4/5' && !H.cell(TAGE).classList.contains('marked') && !progress().classList.contains('done'));
  H.click(plus());
  t.check('5× ＋: geschafft – Dialog meldet „Geschafft“, Feld ist markiert und zeigt „✓ 5“, Datum automatisch gesetzt.',
    input().value === '5' && progress().textContent === 'Geschafft: 5 Tage (nötig: 5).' && progress().classList.contains('done') && H.cell(TAGE).classList.contains('marked') && prog(TAGE) === '✓ 5' && card().details[TAGE].d === TODAY);
  H.click(plus());
  t.check('Weiterzählen auf 6: bleibt geschafft, Karte zeigt „✓ 6“, aria-label nennt 6 Tage.', input().value === '6' && prog(TAGE) === '✓ 6' && H.cell(TAGE).classList.contains('marked') && H.cell(TAGE).getAttribute('aria-label') === 'Tage am Stück, 6 Tage von 5');
  type('15');
  t.check('Zahl direkt eintippen (15): sofort gespeichert, Eingabefeld bleibt unverändert stehen, Karte „✓ 15“.', card().stand[TAGE] === 15 && input().value === '15' && prog(TAGE) === '✓ 15' && /Geschafft: 15 Tage/.test(progress().textContent));
  type('1');
  type('10');
  t.check('Mehrstellig tippen (erst „1“, dann „10“): am Ende steht 10.', card().stand[TAGE] === 10 && input().value === '10');
  type('');
  t.check('Leeres Eingabefeld (beim Löschen): ändert nichts; beim Verlassen zeigt das Feld wieder den gespeicherten Stand.', card().stand[TAGE] === 10 && (() => { input().dispatchEvent(new w.Event('change', { bubbles: true })); return input().value === '10'; })());
  type('abc'); type('-3'); type('1.5');
  t.check('Ungültige Eingaben (Text, negativ, Kommazahl) ändern nichts.', card().stand[TAGE] === 10);
  type('2000');
  t.check('Zu große Zahl wird auf 999 begrenzt; ＋ ist dann aus.', card().stand[TAGE] === 999 && input().value === '999' && plus().disabled);
  type('4');
  t.check('Unter den Schwellwert (4): Feld nicht mehr geschafft, Karte „4/5“, Dialog ohne „Geschafft“.', !H.cell(TAGE).classList.contains('marked') && prog(TAGE) === '4/5' && !progress().classList.contains('done'));
  H.click(minus());
  t.check('− zählt herunter (3).', card().stand[TAGE] === 3 && input().value === '3' && !minus().disabled);
  H.click(reset());
  t.check('„Auf 0 zurücksetzen“: Stand 0, Eintrag entfernt, Zurücksetzen und − sind wieder aus.', !(TAGE in card().stand) && input().value === '0' && reset().disabled && minus().disabled && prog(TAGE) === '0/5');
  type('5');
  t.check('Direkt „5“ eintippen: sofort geschafft (genau der Schwellwert).', H.cell(TAGE).classList.contains('marked') && prog(TAGE) === '✓ 5');
  w.closeModal('zahlModal');

  // Zweites Zählfeld hat einen anderen Schwellwert und keine Einheit
  H.click(H.cell(LOC));
  t.check('Zweites Zählfeld: Dialog ohne Einheit (Einheit ausgeblendet), Hinweis „ab 2“.', d.getElementById('zahlTitle').textContent === 'Locations' && d.getElementById('zahlUnit').textContent === '' && progress().textContent === '0 – ab 2 zählt das Feld.');
  H.click(plus());
  t.check('1 von 2: noch nicht geschafft.', !H.cell(LOC).classList.contains('marked') && prog(LOC) === '1/2');
  H.click(plus());
  t.check('2 von 2: geschafft (Schwellwert dieses Felds), Karte „✓ 2“.', H.cell(LOC).classList.contains('marked') && prog(LOC) === '✓ 2' && progress().textContent === 'Geschafft: 2 (nötig: 2).');
  w.closeModal('zahlModal');

  // Gewinn über die Oberfläche: Reihe 6, 7, 8
  const banner = () => d.getElementById('boardBanner');
  t.check('Vor dem Kombi-Feld: noch kein Bingo-Banner.', banner().style.display === 'none');
  w.toggleCheck('z', KOMBI, 0, true); w.toggleCheck('z', KOMBI, 1, true); w.renderBoard();
  t.check('Reihe mit zwei Zählfeldern und einem Kombi-Feld voll: Banner „Bingo! 1 Reihe“, Zählfelder mit Gewinn-Rahmen.', /Bingo! 1 Reihe/.test(banner().textContent) && H.cell(TAGE).classList.contains('win') && H.cell(LOC).classList.contains('win'));
  t.check('Fortschrittszähler „x von y Feldern“ zählt die geschafften Zählfelder mit.', /3 von 9 Feldern/.test(d.getElementById('boardMeta').textContent));

  // Lupe
  w.eval("appState.settings.lupe = 'immer'"); w.renderBoard();
  w.setZahl('z', TAGE, 3); w.renderBoard(); H.click(H.cell(TAGE)); w.closeModal('zahlModal');
  const lupe = () => d.getElementById('lupe').textContent;
  t.check('Lupe zeigt den ganzen Text und „3/5 Tage“, solange das Feld nicht geschafft ist.', /Tage am Stück/.test(lupe()) && /3\/5 Tage/.test(lupe()));
  w.setZahl('z', TAGE, 12); w.renderBoard();
  t.check('Lupe zeigt „geschafft · 12 Tage“, sobald der Schwellwert erreicht ist.', /geschafft · 12 Tage/.test(lupe()));

  // Langes Drücken: Datum & Info (wie bei allen Feldern)
  w.eval('LONGPRESS_MS = 25');
  const ptr = (type2, el, x = 0, y = 0) => { const e = new w.Event(type2, { bubbles: true, cancelable: true }); e.clientX = x; e.clientY = y; el.dispatchEvent(e); return e; };
  ptr('pointerdown', H.cell(TAGE), 10, 10);
  await H.sleep(70);
  t.check('Langes Drücken auf ein Zählfeld öffnet „Datum & Info“ (nicht den Zähl-Dialog); keine Zeile „Anzahl“.', H.modalOpen('detailModal') && d.getElementById('detailTitle').textContent === 'Tage am Stück' && !H.modalOpen('zahlModal') && d.getElementById('detailCountRow').style.display === 'none');
  ptr('pointerup', H.cell(TAGE), 10, 10);
  H.click(H.cell(TAGE));
  t.check('Der Klick nach dem langen Drücken öffnet den Zähl-Dialog nicht und ändert den Stand nicht.', !H.modalOpen('zahlModal') && card().stand[TAGE] === 12);
  w.closeModal('detailModal');

  // Zurücksetzen mit Rückfrage
  d.getElementById('btnNewCard').click();
  t.check('„Neue Karte“ fragt nach, wenn es Zählerstände gibt.', H.modalOpen('confirmModal'));
  d.getElementById('confirmYes').click();
  t.check('Nach „Neue Karte“ sind alle Zählerstände weg; Karte zeigt wieder „0/5“.', JSON.stringify(card().stand) === '{}' && prog(TAGE) === '0/5');
  w.setZahl('z', LOC, 1);
  t.check('Auch ein Stand unter dem Schwellwert löst die Rückfrage aus (hasMarks).', w.hasMarks());

  // Neustart der Oberfläche
  const A5 = await reloadWithState(w, { trackErrors: true, dataScript: GAME });
  const d5 = A5.document;
  t.check('Neustart: die Karte zeigt den gespeicherten Stand („1/2“).', d5.querySelector('#board .cell[data-p="' + LOC + '"] .cell-progress').textContent === '1/2');

  // Escaping
  const EVIL = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'e', titel:'E', groesse:3, freiMitte:false, ziel:'linie', fest:true,
    felder:['a','b','c','d','e','f','g','h', { text: 'A<b>x</b>"q"', zaehlfeld: true, ab: 1, einheit: '<u>T</u>"' }] }];`;
  const AE = await loadApp({ trackErrors: true, dataScript: EVIL });
  const dE = AE.document, HE = createHelpers(AE.window, dE);
  AE.window.localStorage.clear(); AE.window.switchTab('spiele'); HE.openGameById('e');
  HE.click(HE.cell(8));
  t.check('Escaping: Sonderzeichen in Text und Einheit erscheinen als Text, nicht als HTML (Karte, aria-label, Dialog).',
    !dE.querySelector('#board b') && !dE.querySelector('#board u') && HE.cell(8).querySelector('.cell-text').textContent === 'A<b>x</b>"q"' && HE.cell(8).getAttribute('aria-label') === 'A<b>x</b>"q", 0 <u>T</u>" von 1'
    && dE.getElementById('zahlTitle').textContent === 'A<b>x</b>"q"' && dE.getElementById('zahlUnit').textContent === '<u>T</u>"' && !dE.querySelector('.modal b') && !dE.querySelector('.modal u'));

  // ───────── 8) Das mitgelieferte Spiel (echte bingo-data.js) ─────────
  const AR = await loadApp({ trackErrors: true });
  const wr = AR.window, dr = AR.document, HR = createHelpers(wr, dr);
  const g10 = wr.eval('allGames').find(g => g.id === 'konzerte-bingo-season-10');
  const zf = g10.felder.filter(wr.isCounterEntry);
  const spec = { '5 Tage am Stück Konzerte': [5, 'Tage'], '5 Tage ohne Konzert': [5, 'Tage'], '2 unterschiedliche Locations an einem Tag': [2, 'Locations'], 'Band zum 5. mal sehen': [5, 'mal'] };
  t.check('„Konzerte Bingo Season 10“: genau die vier Zählfelder mit den richtigen Schwellwerten und Einheiten.',
    zf.length === 4 && zf.every(f => spec[f.text] && f.ab === spec[f.text][0] && f.einheit === spec[f.text][1] && f.zaehlfeld === true));
  t.check('Das Spiel ist fehlerfrei und hat weiter 52 Felder; kein Zählfeld steht zusätzlich als Textfeld in der Liste.',
    wr.validateGames([g10]).length === 0 && g10.felder.length === 52 && g10.felder.filter(f => typeof f === 'string' && Object.keys(spec).includes(f)).length === 0);
  wr.localStorage.clear(); wr.switchTab('spiele'); HR.openGameById('konzerte-bingo-season-10');
  const counters = HR.cells().filter(c => c.classList.contains('counter'));
  t.check('In der App: vier Zählfelder auf der 7×7-Karte mit Fortschritt „0/5“ (dreimal) und „0/2“.', counters.length === 4 && counters.map(c => c.querySelector('.cell-progress').textContent).sort().join() === '0/2,0/5,0/5,0/5');
  HR.click(counters.find(c => /Locations/.test(c.textContent)));
  const inp = dr.getElementById('zahlInput');
  inp.value = '2'; inp.dispatchEvent(new wr.Event('input', { bubbles: true }));
  const fresh = HR.cells().filter(c => c.classList.contains('counter'));   // die Karte wurde neu gezeichnet: Felder neu suchen
  t.check('„2 unterschiedliche Locations an einem Tag“ ist bei 2 geschafft, die Tage-Felder erst bei 5.', fresh.find(c => /Locations/.test(c.textContent)).classList.contains('marked') && !fresh.some(c => /Tage/.test(c.textContent) && c.classList.contains('marked')));
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', [A, A2, AE, AO, A3, A5, AR].every(x => x.errors.length === 0), [A.errors, A2.errors, AE.errors, AR.errors]);
  t.finish();
})();
