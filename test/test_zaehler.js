const fs = require('fs');
const path = require('path');
const { ROOT, loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Zähler: ein Textfeld kann mehrfach "geschafft" werden. Das Antippen des Felds ist die 1; hochgezählt wird im Dialog "Datum & Info".
// Kombi-Felder (Multi-Select) haben vorerst keinen Zähler; weitere Zählungen haben noch kein eigenes Datum oder Info.
const GAME = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'k', titel:'K', groesse:3, freiMitte:false, ziel:'linie',
  felder:['a','b','c','d','e','f','g','h', { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }] },
  { id:'f', titel:'F', groesse:3, freiMitte:true, ziel:'linie', felder:['a','b','c','d','e','f','g','h'] }];`;
const TODAY = '2026-11-22';

(async () => {
  const t = createChecker();
  const A = await loadApp({ trackErrors: true, dataScript: GAME });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  w.todayStr = () => TODAY;
  const card = () => w.eval('appState.cards.k');
  w.localStorage.clear(); w.startGame('k');
  const plain = card().cells.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0);
  const cp = card().cells.findIndex(c => c && typeof c === 'object');
  const [p1, p2, p3] = plain;
  const none = r => !r.changed;

  // ───────── 1) Logik ─────────
  t.check('Neue Karte: leere Zähler; ein unmarkiertes Feld hat den Zählerstand 0.', JSON.stringify(card().counts) === '{}' && w.countOf(card(), p1) === 0 && w.eval('MAX_COUNT') === 99);
  w.toggleMark('k', p1);
  t.check('Antippen (Markieren) = Zählerstand 1, ohne einen Eintrag im Zähler zu speichern.', w.countOf(card(), p1) === 1 && JSON.stringify(card().counts) === '{}');
  let r = w.setCount('k', p1, 3);
  t.check('setCount 3: Zählerstand 3, gespeichert; das Feld bleibt markiert.', r.changed && w.countOf(card(), p1) === 3 && card().counts[p1] === 3 && card().marks.includes(p1));
  t.check('Dieselbe Zahl noch einmal setzen ändert nichts.', none(w.setCount('k', p1, 3)));
  r = w.setCount('k', p1, 1);
  t.check('Zurück auf 1 entfernt den Zählereintrag (1 ist der Normalfall); das Feld bleibt markiert.', r.changed && w.countOf(card(), p1) === 1 && !(p1 in card().counts) && card().marks.includes(p1));
  w.setCount('k', p1, 99);
  t.check('Obergrenze 99 ist erlaubt.', w.countOf(card(), p1) === 99);
  t.check('Ungültige Werte werden ignoriert: 0, negativ, 100, Kommazahl, Text, NaN, unendlich.', [0, -1, 100, 1.5, '3', NaN, Infinity, null, undefined].every(v => none(w.setCount('k', p1, v))) && w.countOf(card(), p1) === 99);
  t.check('Ungültige Felder werden ignoriert: Kombi-Feld, Position außerhalb, negativ, Kommazahl, unbekanntes Spiel.', [[cp, 2], [99, 2], [-1, 2], [1.5, 2]].every(([p, n]) => none(w.setCount('k', p, n))) && none(w.setCount('nix', p1, 2)));
  t.check('Kombi-Felder haben keinen Zähler (Zählerstand 0).', w.countOf(card(), cp) === 0);
  w.setCount('k', p1, 4);
  w.toggleMark('k', p1);
  t.check('Entmarkieren löscht den Zähler (nicht mehr markiert, Zählerstand 0, kein Eintrag).', !card().marks.includes(p1) && w.countOf(card(), p1) === 0 && !(p1 in card().counts));
  w.toggleMark('k', p1);
  t.check('Erneutes Markieren beginnt wieder bei 1.', w.countOf(card(), p1) === 1);
  r = w.setCount('k', p2, 2);
  t.check('setCount auf einem unmarkierten Feld markiert es und setzt den Zähler (2); das heutige Datum wird eingetragen.', r.changed && card().marks.includes(p2) && w.countOf(card(), p2) === 2 && card().details[p2].d === TODAY);
  t.check('Der Zähler ändert die Zählung der Felder nicht: markedCount zählt Felder, nicht Zählerstände.', w.markedCount(card()) === 2);
  // Gewinn über setCount
  w.resetMarks('k');
  const line = w.linesFor(3).find(l => l.includes(plain[0]) && l.every(p => typeof card().cells[p] === 'string'));
  line.slice(0, -1).forEach(p => w.toggleMark('k', p));
  const last = line[line.length - 1];
  r = w.setCount('k', last, 5);
  t.check('Setzt man den Zähler auf einem offenen Feld, das eine Reihe schließt, meldet das justWon.', r.justWon === true && w.isWon(w.eval('allGames').find(g => g.id === 'k'), card()));
  t.check('Zählerstände ändern das Gewinnen nicht: ein Feld mit Zähler 5 zählt wie ein einmal markiertes.', w.winningLines(card(), 3).length >= 1);
  w.setCount('k', p1, 7); w.resetMarks('k');
  t.check('Markierungen löschen setzt auch die Zähler zurück.', JSON.stringify(card().counts) === '{}');
  w.setCount('k', p1, 7); w.newCardFor('k');
  t.check('Neue Karte startet ohne Zähler.', JSON.stringify(card().counts) === '{}');
  w.startGame('f');
  t.check('Das Freifeld hat keinen Zähler.', none(w.setCount('f', 4, 2)));

  // ───────── 2) Speicher ─────────
  const base = (extra = {}) => ({ seed: 1, cells: ['a', 'b', { t: 'Sprachen', p: ['Eins', 'Zwei'], ab: 1 }, 'd', 'e', 'f', 'g', 'h', 'i'], marks: [0, 1, 2 + 1], checks: {}, ...extra });
  const load = async (c, data = GAME) => (await loadApp({ dataScript: data, storage: JSON.stringify({ cards: { k: c }, activeGame: 'k' }) })).window.eval('appState.cards.k');
  const ok = await load(base({ counts: { 0: 3, 1: 99 } }));
  t.check('Gespeicherte Zähler werden geladen.', JSON.stringify(ok.counts) === '{"0":3,"1":99}');
  t.check('Alte Karte ohne counts lädt mit leeren Zählern.', JSON.stringify((await load(base())).counts) === '{}');
  const messy = await load(base({ counts: { 0: 3, 1: 1, 3: 2, 4: 5, 2: 4, 5: 100, 6: 2.5, 7: '3', 8: 0, 9: 2, abc: 2, '01': 2, '-1': 2, 99: 3 }, marks: [0, 1, 3] }));
  t.check('Bereinigung: nur markierte Textfelder mit Werten von 2 bis 99 bleiben (nicht markiert, Kombi-Feld, 1, 0, zu groß, Kommazahl, Text, falsche Schlüssel entfallen).', JSON.stringify(messy.counts) === '{"0":3,"3":2}', messy.counts);
  t.check('counts als Liste statt Objekt wird ignoriert, die Karte bleibt gültig.', (c => c && JSON.stringify(c.counts) === '{}')(await load(base({ counts: [2, 3] }))));
  w.startGame('k');   // "Neue Karte" weiter oben hat die Karte gewechselt: Positionen neu bestimmen
  const live = card().cells.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0), l1 = live[0], l3 = live[2];
  w.setCount('k', l1, 6);
  const rt2 = await reloadWithState(A.window, { dataScript: GAME });
  t.check('Nach einem Neustart sind die Zähler noch da (die ganze Karte ist gleich).', JSON.stringify(rt2.window.eval('appState.cards.k')) === JSON.stringify(card()) && rt2.window.eval('appState.cards.k.counts')[l1] === 6);

  // ───────── 3) Sicherung (Export/Import) ─────────
  const bk = JSON.parse(JSON.stringify(w.buildBackup()));
  t.check('Die Sicherung enthält die Zähler.', bk.spiele.k.karte.counts[l1] === 6);
  const imp = await loadApp({ dataScript: GAME });
  const pb = imp.window.parseBackup(JSON.stringify(bk));
  const an = imp.window.analyzeBackup(pb.backup);
  imp.window.applyBackup(an, pb.backup, {});
  t.check('Beim Import kommen die Zähler an.', an.games.find(g => g.id === 'k').status === 'ok' && imp.window.eval('appState.cards.k.counts')[l1] === 6);
  bk.spiele.k.karte.counts = { [l1]: 500, [l3]: 4, 99: 2 };
  const pb2 = imp.window.parseBackup(JSON.stringify(bk));
  const c2 = imp.window.analyzeBackup(pb2.backup).games.find(g => g.id === 'k').card;
  t.check('Manipulierte Zähler in einer Sicherung werden beim Import bereinigt (zu groß, unmarkiertes Feld, falsche Position).', JSON.stringify(c2.counts) === '{}', c2.counts);

  // ───────── 4) Oberfläche ─────────
  const B = await loadApp({ trackErrors: true, dataScript: GAME });
  const bw = B.window, bd = B.document, BH = createHelpers(bw, bd);
  bw.todayStr = () => TODAY;
  BH.openGameById('k'); bw.setLupeMode('immer');
  const bc = () => bw.eval('appState.cards.k');
  const plainB = bc().cells.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0), comboB = bc().cells.findIndex(c => c && typeof c === 'object');
  const [q1, q2] = plainB;
  const row = () => bd.getElementById('detailCountRow'), val = () => bd.getElementById('countVal').textContent;
  const minus = () => bd.getElementById('countMinus'), plus = () => bd.getElementById('countPlus');
  BH.click(BH.cell(q1));
  t.check('Antippen markiert das Feld einmal: kein Zähler-Zeichen auf dem Feld.', BH.cell(q1).classList.contains('marked') && !BH.cell(q1).hasAttribute('data-n'));
  bw.openDetails(q1);
  t.check('Dialog: die Zeile "Anzahl" ist sichtbar und zeigt 1; Minus ist gesperrt (1 ist das Minimum).', row().style.display !== 'none' && val() === '1' && minus().disabled === true && plus().disabled === false);
  BH.click(plus());
  t.check('Plus: Anzahl 2, Zähler auf dem Feld (data-n=2), Lupe zeigt "markiert · 2×", Minus ist frei.', val() === '2' && BH.cell(q1).getAttribute('data-n') === '2' && /markiert · 2×/.test(bd.getElementById('lupe').textContent) && minus().disabled === false && bc().counts[q1] === 2);
  t.check('Das Feld trägt den Zählerstand im aria-label ("…, 2 mal").', /, 2 mal$/.test(BH.cell(q1).getAttribute('aria-label')));
  BH.click(plus()); BH.click(plus());
  t.check('Mehrfach Plus: Anzahl 4.', val() === '4' && bc().counts[q1] === 4);
  BH.click(minus());
  t.check('Minus: Anzahl 3.', val() === '3' && BH.cell(q1).getAttribute('data-n') === '3');
  BH.click(minus()); BH.click(minus());
  t.check('Minus bis 1: der Zähler verschwindet vom Feld, Minus ist gesperrt, das Feld bleibt markiert.', val() === '1' && !BH.cell(q1).hasAttribute('data-n') && minus().disabled && BH.cell(q1).classList.contains('marked') && !(q1 in bc().counts) && !/·/.test(bd.getElementById('lupe').textContent));
  bw.setCount('k', q1, 99); bw.openDetails(q1);
  t.check('Bei 99 ist Plus gesperrt.', val() === '99' && plus().disabled === true && minus().disabled === false);
  bw.setCount('k', q1, 1);
  bw.closeModal('detailModal');

  // unmarkiertes Feld: Plus markiert (= 1)
  bw.openDetails(q2);
  t.check('Ein unmarkiertes Feld zeigt im Dialog Anzahl 0; Minus gesperrt.', val() === '0' && minus().disabled === true && !BH.cell(q2).classList.contains('marked'));
  BH.click(plus());
  t.check('Plus auf einem unmarkierten Feld markiert es mit 1 und trägt das Datum ein (Datumsfeld im Dialog wird aktualisiert).', val() === '1' && BH.cell(q2).classList.contains('marked') && bc().details[q2].d === TODAY && bd.getElementById('detailDate').value === TODAY);
  bw.closeModal('detailModal');

  // Gewinn über den Zähler
  const gl = bw.linesFor(3).find(l => l.includes(plainB[2]) && l.every(p => typeof bc().cells[p] === 'string'));
  if (gl) {
    gl.slice(0, -1).forEach(p => { if (!bc().marks.includes(p)) BH.click(BH.cell(p)); });
    bd.getElementById('toast').classList.remove('show');
    bw.openDetails(gl[gl.length - 1]); BH.click(plus());
    t.check('Das Hochzählen (Plus) auf dem letzten offenen Feld einer Reihe löst "Bingo!" aus.', bd.getElementById('toast').classList.contains('show') && /Bingo!/.test(bd.getElementById('boardBanner').textContent));
    bw.closeModal('detailModal');
  }

  // Entmarkieren mit Zähler: Rückfrage
  bw.setCount('k', q1, 5); bw.renderBoard();
  BH.click(BH.cell(q1));
  t.check('Antippen eines Felds mit Zähler > 1 fragt vor dem Entmarkieren nach (Zählung geht verloren); noch nichts geändert.', BH.modalOpen('confirmModal') && /5×/.test(bd.getElementById('confirmText').textContent) && bc().marks.includes(q1) && bc().counts[q1] === 5);
  BH.click(bd.querySelector('#confirmModal .form-btn-cancel'));
  t.check('Abbrechen: Markierung und Zähler bleiben.', bc().marks.includes(q1) && bc().counts[q1] === 5);
  BH.click(BH.cell(q1)); BH.click(bd.getElementById('confirmYes'));
  t.check('Bestätigen: Markierung entfernt und Zähler gelöscht.', !bc().marks.includes(q1) && !(q1 in bc().counts) && !BH.cell(q1).hasAttribute('data-n'));
  BH.click(BH.cell(q1)); BH.click(BH.cell(q1));
  t.check('Bei Zählerstand 1 geht das Entmarkieren wie bisher ohne Rückfrage.', !BH.modalOpen('confirmModal') && !bc().marks.includes(q1));

  // Kombi-Feld: kein Zähler
  bw.openDetails(comboB);
  t.check('Für Kombi-Felder (Multi-Select) ist die Zeile "Anzahl" im Dialog ausgeblendet.', row().style.display === 'none');
  bw.closeModal('detailModal');
  bw.openDetails(q1);
  t.check('Für ein Textfeld ist sie wieder da (nach einem Kombi-Feld).', row().style.display !== 'none');
  bw.closeModal('detailModal');

  // Langes Drücken öffnet den Dialog mit Zähler
  bw.eval('LONGPRESS_MS = 20');
  const ptr = (type, el) => { const e = new bw.Event(type, { bubbles: true, cancelable: true }); e.clientX = 5; e.clientY = 5; el.dispatchEvent(e); };
  const tgt = () => BH.cell(q2);
  ptr('pointerdown', tgt());
  await new Promise(r => setTimeout(r, 60));
  t.check('Langes Drücken auf ein Feld öffnet den Dialog samt Zähler (Anzahl 1 für das markierte Feld q2).', BH.modalOpen('detailModal') && val() === '1' && row().style.display !== 'none');
  ptr('pointerup', tgt()); bw.closeModal('detailModal');

  // Neustart
  bw.setCount('k', q2, 8);
  const R = await reloadWithState(bw, { dataScript: GAME });
  const RH = createHelpers(R.window, R.document);
  t.check('Nach Neustart zeigt das Feld den Zähler (data-n=8) und der Dialog "Anzahl 8".', RH.cell(q2).getAttribute('data-n') === '8' && (R.window.openDetails(q2), R.document.getElementById('countVal').textContent === '8'));

  // CSS
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf-8');
  t.check('CSS: der Zählerhinweis "×N" auf dem Feld kommt aus data-n (::before) und liegt unten rechts.', /\.cell\[data-n\]::before\s*\{[^}]*content:\s*'×'\s*attr\(data-n\)[^}]*bottom:[^}]*right:/.test(css));
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0 && B.errors.length === 0 && R.errors.length === 0, [...A.errors, ...B.errors]);
  t.finish();
})();
