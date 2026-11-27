const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Ein Textfeld wird im Spiel zum Kombi-Feld umgebaut (Beispiel: "Gesang in 6 Sprachen", fertig bei 6). Bereits gespeicherte oder
// importierte Karten, auf denen das Feld noch ein einfaches Textfeld ist, werden mitgezogen statt abgelehnt.
const TODAY = '2026-11-26';
const NEW = `const BINGO_DATA_VERSION=2; const BINGO_GAMES=[{ id:'k', titel:'K', groesse:3, freiMitte:false, ziel:'linie', felder:['a','b','c','d','e','f','g','h',
  { text: 'Sprachen', ab: 3, punkte: ['Eins','Zwei','Drei','Vier'], eigene: true, eigeneHinweis: 'Weitere Sprache' }] }];`;
const OLD_CARD = (extra = {}) => ({ seed: 1, cells: ['a', 'b', 'Sprachen', 'd', 'e', 'f', 'g', 'h', 'c'], marks: [0, 2, 4], checks: {}, eigene: {}, details: { 2: { d: '2026-05-01', i: 'Docks' } }, counts: { 2: 3, 0: 2 }, ...extra });

(async () => {
  const t = createChecker();
  const A = await loadApp({ trackErrors: true });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  w.todayStr = () => TODAY;
  const g10 = w.eval('allGames').find(g => g.id === 'konzerte-bingo-season-10');

  // ───────── 1) Das Feld "Gesang in 6 Sprachen" im Spiel ─────────
  const f0 = g10.felder[0];
  t.check('"Gesang in 6 Sprachen" ist ein Kombi-Feld, fertig bei 6 (ab: 6), an der ersten Stelle der festen Karte; die Prüfung meldet nichts.', typeof f0 === 'object' && f0.text === 'Gesang in 6 Sprachen' && f0.ab === 6 && w.validateGames([g10]).length === 0, w.validateGames([g10]));
  t.check('Es hat mehrere Sprachen zum Abhaken und erlaubt eigene Einträge ("Weitere Sprache"); 6 sind mit den Vorgaben allein erreichbar.', f0.punkte.length >= 6 && f0.eigene === true && f0.eigeneHinweis === 'Weitere Sprache' && new Set(f0.punkte).size === f0.punkte.length);
  t.check('Das Spiel hat weiterhin 52 Felder; die Karte bleibt 7×7 mit 49 Feldern in fester Reihenfolge, Position 0 ist das Kombi-Feld.', g10.felder.length === 52 && (c => c.cells.length === 49 && typeof c.cells[0] === 'object' && c.cells[0].t === 'Gesang in 6 Sprachen' && c.cells[0].ab === 6 && c.cells[0].e === true && c.cells[1] === 'Feature vom Band')(w.createCard(g10, 3)));

  // Spielen: 6 Häkchen (feste Sprachen und eigene Einträge zusammen)
  w.localStorage.clear(); w.startGame('konzerte-bingo-season-10');
  const id = 'konzerte-bingo-season-10', card = () => w.eval(`appState.cards['${id}']`);
  [0, 1, 2].forEach(i => w.toggleCheck(id, 0, i, true));
  w.setEigene(id, 0, ['Latein', 'Japanisch']);
  t.check('5 Sprachen (3 feste + 2 eigene): das Feld ist noch nicht fertig, noch kein Datum.', !w.isMarked(card(), 0) && w.comboCount(card(), 0) === 5 && !(card().details[0]));
  w.setEigene(id, 0, ['Latein', 'Japanisch', 'Koreanisch']);
  t.check('Die 6. Sprache macht das Feld fertig (markiert); das Datum wird automatisch eingetragen.', w.isMarked(card(), 0) && card().details[0].d === TODAY);
  w.setEigene(id, 0, ['Latein', 'Japanisch', 'deutsch']);
  t.check('Eine eigene Sprache, die einem festen Punkt gleicht ("deutsch"), zählt nicht doppelt.', w.comboCount(card(), 0) === 5 && !w.isMarked(card(), 0));
  H.openGameById(id);
  H.click(H.cell(0));
  t.check('In der App öffnet das Antippen des Feldes die Checkliste (kein einfaches Markieren): Titel, Punkte und Eingabefeld "Weitere Sprache".', H.modalOpen('comboModal') && d.getElementById('comboTitle').textContent === 'Gesang in 6 Sprachen' && d.querySelectorAll('#comboList input').length === f0.punkte.length && d.querySelector('#comboOwnList .combo-own-input').placeholder === 'Weitere Sprache' && /ab 6 zählt das Feld/.test(d.getElementById('comboProgress').textContent));
  w.closeModal('comboModal');

  // ───────── 2) Mitziehen bereits gespeicherter Karten ─────────
  const migr = async (card, data = NEW) => (await loadApp({ dataScript: data, storage: JSON.stringify({ cards: { k: card }, activeGame: 'k' }), trackErrors: true }));
  const L = await migr(OLD_CARD());
  const lc = L.window.eval('appState.cards.k');
  t.check('Gespeicherte Karte mit dem Feld als Textfeld: die Zelle wird beim Start zum Kombi-Feld (ohne Häkchen).', typeof lc.cells[2] === 'object' && lc.cells[2].t === 'Sprachen' && lc.cells[2].ab === 3 && lc.cells[2].e === true && lc.cells[2].h === 'Weitere Sprache' && !lc.checks[2]);
  t.check('Die frühere einfache Markierung und der Zähler dieses Felds entfallen; Markierungen und Zähler anderer Felder bleiben.', JSON.stringify(lc.marks) === '[0,4]' && JSON.stringify(lc.counts) === '{"0":2}', [lc.marks, lc.counts]);
  t.check('Datum und Info dieses Felds bleiben erhalten.', JSON.stringify(lc.details[2]) === '{"d":"2026-05-01","i":"Docks"}');
  t.check('Alle anderen Felder sind unverändert, die Karte ist gültig (9 Zellen, Seed).', JSON.stringify(lc.cells.filter((c, p) => p !== 2)) === JSON.stringify(['a', 'b', 'd', 'e', 'f', 'g', 'h', 'c']) && lc.seed === 1);
  const LH = createHelpers(L.window, L.document);
  t.check('Die Oberfläche zeigt das Feld als Kombi-Feld mit Fortschritt "☑ 0/3"; Info-Punkt bleibt.', (cell => !!cell && cell.classList.contains('combo') && /0\/3/.test(cell.textContent) && !cell.classList.contains('marked') && cell.classList.contains('info'))(LH.cell(2)));
  const again = await reloadWithState(L.window, { dataScript: NEW });
  L.window.toggleMark('k', 0);
  const again2 = await reloadWithState(L.window, { dataScript: NEW });
  t.check('Nach dem nächsten Speichern und Neustart bleibt es stabil (keine erneute Umstellung, kein Fehler).', typeof again2.window.eval('appState.cards.k.cells[2]') === 'object' && again2.errors.length === 0 && L.errors.length === 0);
  const unmarked = await migr(OLD_CARD({ marks: [0], counts: {} }));
  t.check('War das Textfeld nicht markiert, ändert sich an den Markierungen nichts.', JSON.stringify(unmarked.window.eval('appState.cards.k.marks')) === '[0]');
  const none = await migr(OLD_CARD(), NEW.replace("{ text: 'Sprachen', ab: 3, punkte: ['Eins','Zwei','Drei','Vier'], eigene: true, eigeneHinweis: 'Weitere Sprache' }", "'Sprachen'"));
  t.check('Ohne Kombi-Feld im Spiel bleibt das Textfeld, wie es ist (nichts wird umgestellt).', none.window.eval('appState.cards.k.cells[2]') === 'Sprachen' && JSON.stringify(none.window.eval('appState.cards.k.marks')) === '[0,2,4]');
  t.check('migrateCombos ist wiederholbar: ein zweiter Aufruf stellt nichts mehr um.', (() => { const g = L.window.gameById('k'); const c = L.window.eval('appState.cards.k'); return L.window.migrateCombos(g, c).length === 0; })());

  // ───────── 3) Import einer alten Sicherung ─────────
  const old = { format: 'zugabe-sicherung', version: 1, exportiert: '2026-11-24T10:00:00.000Z', spiele: { k: { titel: 'K', groesse: 3, karte: OLD_CARD() } } };
  const I = await loadApp({ dataScript: NEW, trackErrors: true });
  I.window.todayStr = () => TODAY;
  const pb = I.window.parseBackup(JSON.stringify(old));
  const an = I.window.analyzeBackup(pb.backup);
  const g = an.games[0];
  t.check('Alte Sicherung (Feld noch als Textfeld): die Karte ist importierbar und wird nicht abgelehnt.', g.status === 'ok' && g.problems.length === 0, g.problems);
  t.check('Ein Hinweis nennt die Umstellung samt zurückgesetzter Markierung.', g.notes.length === 1 && /„Sprachen“ ist jetzt ein Kombi-Feld/.test(g.notes[0]) && /zurückgesetzt/.test(g.notes[0]), g.notes);
  I.window.applyBackup(an, pb.backup, {});
  const ic = I.window.eval('appState.cards.k');
  t.check('Nach dem Import ist die Zelle ein Kombi-Feld; Markierungen [0,4], Zähler nur am anderen Feld, Datum und Info des Felds bleiben.', typeof ic.cells[2] === 'object' && JSON.stringify(ic.marks) === '[0,4]' && JSON.stringify(ic.counts) === '{"0":2}' && ic.details[2].i === 'Docks');
  const notMarked = I.window.analyzeBackup(I.window.parseBackup(JSON.stringify({ ...old, spiele: { k: { titel: 'K', groesse: 3, karte: OLD_CARD({ marks: [0], counts: {} }) } } })).backup).games[0];
  t.check('War das Feld in der Sicherung nicht markiert, lautet der Hinweis ohne "zurückgesetzt".', notMarked.notes.length === 1 && !/zurückgesetzt/.test(notMarked.notes[0]));
  const bad = I.window.analyzeBackup(I.window.parseBackup(JSON.stringify({ ...old, spiele: { k: { titel: 'K', groesse: 3, karte: OLD_CARD({ cells: ['a', 'b', 'Sprachen', 'd', 'e', 'f', 'g', 'h', 'Erfunden'] }) } } })).backup).games[0];
  t.check('Ein wirklich fehlendes Feld wird weiterhin abgelehnt, auch wenn ein anderes umgestellt werden könnte.', bad.status === 'fehler' && bad.problems.some(p => /nicht vorhanden: „Erfunden“/.test(p)) && bad.notes.length === 0, [bad.problems, bad.notes]);
  const plainNote = I.window.analyzeBackup(I.window.parseBackup(JSON.stringify({ ...old, spiele: { k: { titel: 'K', groesse: 3, karte: { ...OLD_CARD(), cells: ['a', 'b', { t: 'Sprachen', p: ['Eins', 'Zwei', 'Drei', 'Vier'], ab: 3, e: true, h: 'Weitere Sprache' }, 'd', 'e', 'f', 'g', 'h', 'c'], marks: [0], counts: {} } } } })).backup).games[0];
  t.check('Eine Sicherung, in der das Kombi-Feld schon ein Kombi-Feld ist, braucht keine Umstellung und erzeugt keinen Hinweis.', plainNote.status === 'ok' && plainNote.notes.length === 0, plainNote.problems);
  // Dialog
  const IH = createHelpers(I.window, I.document), inp = I.document.getElementById('importFile');
  const file = new I.window.File([JSON.stringify(old)], 'alt.json');
  Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  await I.window.onImportFile(inp);
  t.check('Im Import-Dialog erscheint der Hinweis unter dem Spiel (als Text, maskiert).', IH.modalOpen('importModal') && /ist jetzt ein Kombi-Feld/.test(I.document.querySelector('#importBody .imp-ok').textContent) && I.errors.length === 0, I.errors);

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0 && L.errors.length === 0 && I.errors.length === 0, [...A.errors, ...I.errors]);
  t.finish();
})();
