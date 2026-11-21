const { loadApp, reloadWithState, createChecker } = require('./test-helpers');

// Speicher (js/02-storage.js): Rundlauf über Neustart, kaputte/fremde Stände, Einstellungen, Karten-Bereinigung.
(async () => {
  const t = createChecker();
  const a = await loadApp();
  const w = a.window;
  w.startGame('klubnacht'); w.toggleMark('klubnacht', 0); w.toggleMark('klubnacht', 8);
  w.startGame('marathon'); w.toggleMark('marathon', 3);
  w.toggleSetting('showCounter', false);
  const before = JSON.parse(w.localStorage.getItem('zugabe-v1'));
  t.check('Speicherstand enthält Karten, Einstellungen, aktives Spiel und Datenversion.', before.cards.klubnacht && before.cards.marathon && before.settings.showCounter === false && before.activeGame === 'marathon' && before.dataVersion === w.eval('BINGO_DATA_VERSION'), before);

  const b = await reloadWithState(w);
  t.check('Neustart: Karten (Felder + Markierungen) sind identisch.', JSON.stringify(b.window.eval('appState.cards')) === JSON.stringify(w.eval('appState.cards')));
  t.check('Neustart: Einstellung und aktives Spiel bleiben, die App öffnet direkt die Karte.', b.window.eval('appState.settings.showCounter') === false && b.window.eval('appState.activeGame') === 'marathon' && !b.document.getElementById('view-spiel').classList.contains('hidden'));
  t.check('Neustart: Checkbox spiegelt die gespeicherte Einstellung.', b.document.getElementById('settingShowCounter').checked === false);

  // Kaputte Stände
  for (const [name, raw] of [['kein JSON', '{{{'], ['null', 'null'], ['Zahl', '42'], ['leeres Objekt', '{}']]) {
    const c = await loadApp({ storage: raw, trackErrors: true });
    t.check(`Speicherstand "${name}": App startet, Spieleliste ist da, Standardeinstellungen.`,
      c.document.querySelectorAll('.game-card').length === 4 && c.window.eval('appState.settings.confirmNewCard') === true && c.window.eval('appState.activeGame') === '' && c.errors.length === 0, c.errors);
  }
  const bad = await loadApp({ storage: JSON.stringify({ settings: { confirmNewCard: 'ja', showCounter: 0 }, activeGame: 5, cards: 'x' }) });
  t.check('Falsche Typen bei Einstellungen/activeGame/cards fallen auf Standardwerte zurück.', bad.window.eval('appState.settings.confirmNewCard') === true && bad.window.eval('appState.settings.showCounter') === true && bad.window.eval('appState.activeGame') === '' && Object.keys(bad.window.eval('appState.cards')).length === 0);

  // Karten-Bereinigung
  const good = { seed: 1, cells: ['a', 'b', 'c', 'd', null, 'e', 'f', 'g', 'h'], marks: [0, 1] };
  const san = (card) => JSON.stringify({ cards: { klubnacht: card }, activeGame: 'klubnacht' });
  const ok = await loadApp({ storage: san(good) });
  t.check('Gültige Karte wird übernommen (auch mit anderen Feldtexten als in den Daten).', ok.window.eval('appState.cards.klubnacht.cells[0]') === 'a' && ok.window.eval('appState.cards.klubnacht.marks.length') === 2);
  const variants = {
    'falsche Zellenzahl': { ...good, cells: good.cells.slice(0, 8) },
    'Freifeld an falscher Stelle': { ...good, cells: ['a', 'b', 'c', 'd', 'x', 'e', 'f', 'g', null] },
    'Text statt Freifeld fehlt (keine null)': { ...good, cells: good.cells.map(c => c === null ? 'z' : c) },
    'Zahl als Feld': { ...good, cells: ['a', 1, 'c', 'd', null, 'e', 'f', 'g', 'h'] },
    'leerer Feldtext': { ...good, cells: ['', 'b', 'c', 'd', null, 'e', 'f', 'g', 'h'] }
  };
  for (const [name, card] of Object.entries(variants)) {
    const c = await loadApp({ storage: san(card) });
    t.check(`Ungültige Karte (${name}) wird verworfen, App legt beim Öffnen eine neue an.`, !c.window.eval('appState.cards.klubnacht') && c.window.startGame('klubnacht') && c.window.eval('appState.cards.klubnacht.cells.length') === 9);
  }
  const marks = await loadApp({ storage: san({ ...good, marks: [0, 0, 2, 4, 99, -1, 1.5, 'x', 8] }) });
  t.check('Marks werden bereinigt: nur gültige, eindeutige Positionen ohne Freifeld, sortiert.', JSON.stringify(marks.window.eval('appState.cards.klubnacht.marks')) === '[0,2,8]', marks.window.eval('appState.cards.klubnacht.marks'));
  const long = await loadApp({ storage: san({ ...good, cells: ['x'.repeat(200), 'b', 'c', 'd', null, 'e', 'f', 'g', 'h'] }) });
  t.check('Überlange Feldtexte werden auf 80 Zeichen gekürzt.', long.window.eval('appState.cards.klubnacht.cells[0].length') === 80);
  const orphan = await loadApp({ storage: JSON.stringify({ cards: { altes: { seed: 3, cells: ['q'], marks: [] } } }) });
  orphan.window.startGame('klubnacht');
  t.check('Karte zu einem Spiel, das es gerade nicht gibt, bleibt beim Speichern erhalten.', !!JSON.parse(orphan.window.localStorage.getItem('zugabe-v1')).cards.altes);

  // Karte zum Spiel, dessen Konfiguration sich geändert hat (Freifeld entfernt)
  const changed = await loadApp({
    storage: JSON.stringify({ cards: { klubnacht: good } }),
    dataScript: `const BINGO_GAMES = [{ id:'klubnacht', titel:'S', groesse:3, freiMitte:false, ziel:'linie', felder:['a','b','c','d','e','f','g','h','i','j'] }]; const BINGO_DATA_VERSION = 2;`
  });
  t.check('Wurde das Freifeld im Spiel entfernt, passt die alte Karte nicht mehr und wird verworfen.', !changed.window.eval('appState.cards.klubnacht'));
  t.finish();
})();
