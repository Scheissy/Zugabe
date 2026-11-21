const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Kombi-Felder: ein Feld mit Einzelpunkten (Checkliste), das ab einer Mindestzahl Häkchen als markiert zählt.
// Geprüft werden Datenprüfung, Spiellogik, Speicher und Oberfläche (Karte + Checklisten-Dialog).
const GAME = `const BINGO_DATA_VERSION = 1; const BINGO_GAMES = [{ id: 'k', titel: 'K', groesse: 3, freiMitte: false, ziel: 'linie',
  felder: ['a','b','c','d','e','f','g','h', { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }] },
  { id: 'v', titel: 'V', groesse: 3, freiMitte: false, ziel: 'vollbild',
  felder: ['a','b','c','d','e','f','g','h', { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }] }];`;

(async () => {
  const t = createChecker();
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true, dataScript: GAME });
  const H = createHelpers(w, d);
  const combo = { text: 'Sprachen', ab: 2, punkte: ['Eins', 'Zwei', 'Drei'] };
  const felder = n => Array.from({ length: n }, (_, i) => 'Feld ' + (i + 1));
  const okGame = (over = {}) => ({ id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: [...felder(8), combo], ...over });
  const probs = (g, text) => w.validateGames([g]).filter(i => i.text.includes(text));

  // ───────── 1) Datenprüfung ─────────
  t.check('Gültiges Kombi-Feld: keine Befunde, und es zählt als ein Feld für die Mindestanzahl (8 Texte + 1 Kombi = 9).', w.validateGames([okGame()]).length === 0);
  t.check('Zu wenige Felder, auch wenn ein Kombi-Feld dabei ist (7 Texte + 1 Kombi = 8 von 9).', probs(okGame({ felder: [...felder(7), combo] }), 'zu wenige').length === 1);
  const withCombo = c => okGame({ felder: [...felder(8), c] });
  t.check('ab = 0 -> Fehler.', probs(withCombo({ ...combo, ab: 0 }), 'ab muss').length === 1);
  t.check('ab größer als die Zahl der Punkte -> Fehler.', probs(withCombo({ ...combo, ab: 4 }), 'ab muss').length === 1);
  t.check('ab = Zahl der Punkte (alle nötig) -> in Ordnung.', probs(withCombo({ ...combo, ab: 3 }), 'ab muss').length === 0);
  t.check('ab fehlt oder ist keine ganze Zahl -> Fehler.', probs(withCombo({ text: 'S', punkte: ['a', 'b'] }), 'ab muss').length === 1 && probs(withCombo({ ...combo, ab: 1.5 }), 'ab muss').length === 1 && probs(withCombo({ ...combo, ab: '2' }), 'ab muss').length === 1);
  t.check('Weniger als 2 Punkte -> Fehler.', probs(withCombo({ ...combo, punkte: ['nur einer'], ab: 1 }), 'punkte braucht').length === 1);
  t.check('Mehr als 12 Punkte -> Fehler; genau 12 -> in Ordnung.', probs(withCombo({ ...combo, punkte: felder(13), ab: 2 }), 'punkte braucht').length === 1 && probs(withCombo({ ...combo, punkte: felder(12), ab: 2 }), 'punkte braucht').length === 0);
  t.check('Leerer Punkt oder Punkt, der kein Text ist -> Fehler.', probs(withCombo({ ...combo, punkte: ['a', ' '] }), 'punkte braucht').length === 1 && probs(withCombo({ ...combo, punkte: ['a', 5] }), 'punkte braucht').length === 1);
  t.check('Doppelte Punkte (auch Groß/Klein) -> Fehler.', probs(withCombo({ ...combo, punkte: ['Eins', ' eins', 'Zwei'] }), 'doppelte punkte').length === 1);
  t.check('Kombi-Feld ohne text -> Fehler.', probs(withCombo({ ...combo, text: ' ' }), 'ohne text').length === 1);
  t.check('Kombi-Feld mit gleichem Text wie ein Textfeld -> Fehler "doppelte Felder".', probs(okGame({ felder: [...felder(8), { ...combo, text: 'feld 1' }] }), 'doppelte Felder').length === 1);
  t.check('Ein Array oder eine Zahl als Feld -> Fehler (nur Text oder Kombi-Feld erlaubt).', probs(okGame({ felder: [...felder(8), ['x']] }), 'felder').length === 1 && probs(okGame({ felder: [...felder(8), 7] }), 'felder').length === 1);
  t.check('Zu langer Punkt-Text -> nur Hinweis.', (r => r.length === 1 && r[0].level === 'hinweis')(probs(withCombo({ ...combo, punkte: ['x'.repeat(81), 'b'] , ab: 1 }), 'länger')));
  t.check('Spiel mit fehlerhaftem Kombi-Feld ist nicht spielbar und fehlt in der Liste.', (async () => true) && !(await (async () => { const x = await loadApp({ dataScript: `const BINGO_GAMES=[{id:'z',titel:'Z',groesse:3,freiMitte:false,ziel:'linie',felder:${JSON.stringify([...felder(8), { ...combo, ab: 9 }])}}];const BINGO_DATA_VERSION=1;` }); return !!x.document.querySelector('.game-card'); })()));

  // ───────── 2) Karte und Spiellogik ─────────
  const game = w.eval('allGames').find(g => g.id === 'k');
  const card = w.createCard(game, 11);
  const pc = card.cells.findIndex(c => c && typeof c === 'object');
  t.check('Die Karte enthält das Kombi-Feld als Zelle { t, p, ab } samt Kopie der Punkte; checks startet leer.',
    pc >= 0 && card.cells[pc].t === 'Sprachen' && card.cells[pc].ab === 2 && JSON.stringify(card.cells[pc].p) === '["Eins","Zwei","Drei"]' && JSON.stringify(card.checks) === '{}');
  card.cells[pc].p.push('Vier');
  t.check('Änderungen an der Karte verändern die Spieledaten nicht (Punkte sind kopiert).', game.felder.find(f => typeof f === 'object').punkte.length === 3);
  card.cells[pc].p.pop();
  t.check('Ohne Häkchen ist das Kombi-Feld nicht markiert.', !w.isMarked(card, pc) && w.comboCount(card, pc) === 0);
  card.checks[pc] = [0];
  t.check('Ein Häkchen von zwei nötigen: noch nicht markiert.', !w.isMarked(card, pc));
  card.checks[pc] = [0, 2];
  t.check('Genau die geforderte Anzahl Häkchen (2): markiert.', w.isMarked(card, pc));
  card.checks[pc] = [0, 1, 2];
  t.check('Mehr Häkchen als nötig: bleibt markiert.', w.isMarked(card, pc));
  t.check('Zähler: ein erledigtes Kombi-Feld zählt als ein Feld; Karte hat 9 Felder.', w.markedCount(card) === 1 && w.fieldCount(card) === 9);
  card.checks = {}; card.marks = [];

  // Zustand in der App
  w.localStorage.clear();
  w.startGame('k');
  const ac = w.eval('appState.cards.k');
  const cp = ac.cells.findIndex(c => c && typeof c === 'object');
  let r = w.toggleCheck('k', cp, 0);
  t.check('toggleCheck hakt einen Punkt ab (changed, Feld noch nicht markiert, kein Gewinn).', r.changed && !w.isMarked(ac, cp) && !r.won && !r.justWon && JSON.stringify(ac.checks[cp]) === '[0]');
  r = w.toggleCheck('k', cp, 0, true);
  t.check('toggleCheck mit value=true auf einen schon abgehakten Punkt ändert nichts.', !r.changed && JSON.stringify(ac.checks[cp]) === '[0]');
  r = w.toggleCheck('k', cp, 2, true);
  t.check('Zweiter Punkt erreicht die Schwelle: Feld ist markiert, Häkchen bleiben sortiert.', r.changed && w.isMarked(ac, cp) && JSON.stringify(ac.checks[cp]) === '[0,2]');
  r = w.toggleCheck('k', cp, 0, false);
  t.check('Häkchen entfernen (value=false) unterschreitet die Schwelle: Feld ist wieder nicht markiert.', r.changed && !w.isMarked(ac, cp));
  r = w.toggleCheck('k', cp, 2);
  t.check('Letztes Häkchen entfernt: der Eintrag in checks verschwindet.', !(cp in ac.checks));
  t.check('Ungültige Aufrufe werden ignoriert (Index außerhalb, kein Kombi-Feld, unbekanntes Spiel).',
    !w.toggleCheck('k', cp, 3).changed && !w.toggleCheck('k', cp, -1).changed && !w.toggleCheck('k', cp, 1.5).changed
    && !w.toggleCheck('k', (cp + 1) % 9, 0).changed && !w.toggleCheck('nix', cp, 0).changed && !w.toggleCheck('k', 99, 0).changed);
  t.check('toggleMark auf ein Kombi-Feld tut nichts (dafür gibt es die Checkliste).', !w.toggleMark('k', cp).changed && !ac.marks.includes(cp));

  // Gewinn über ein Kombi-Feld
  const line = w.linesFor(3).find(l => l.includes(cp));
  line.filter(p => p !== cp).forEach(p => w.toggleMark('k', p));
  t.check('Reihe mit offenem Kombi-Feld: noch kein Gewinn.', !w.isWon(game, ac));
  w.toggleCheck('k', cp, 0, true);
  r = w.toggleCheck('k', cp, 1, true);
  t.check('Das Häkchen, das die Schwelle erreicht und die Reihe schließt, meldet justWon.', r.justWon && r.won && w.isWon(game, ac));
  r = w.toggleCheck('k', cp, 2, true);
  t.check('Weitere Häkchen danach melden kein neues justWon.', r.changed && r.won && !r.justWon);
  r = w.toggleCheck('k', cp, 2, false);
  r = w.toggleCheck('k', cp, 1, false);
  t.check('Fällt das Feld unter die Schwelle, ist der Gewinn weg.', !r.won && !w.isWon(game, ac));

  // Vollbild: Kombi-Feld muss auch fertig sein
  w.startGame('v');
  const vg = w.eval('allGames').find(g => g.id === 'v'), vc = w.eval('appState.cards.v');
  const vp = vc.cells.findIndex(c => c && typeof c === 'object');
  vc.cells.forEach((c, p) => { if (p !== vp) w.toggleMark('v', p); });
  t.check('Vollbild: alle Textfelder markiert, Kombi-Feld offen -> noch kein Gewinn.', !w.isWon(vg, vc));
  w.toggleCheck('v', vp, 0, true);
  r = w.toggleCheck('v', vp, 1, true);
  t.check('Vollbild: Kombi-Feld fertig -> Gewinn.', r.justWon && w.isWon(vg, vc));

  // Zurücksetzen
  w.toggleCheck('k', cp, 0, true);
  w.resetMarks('k');
  t.check('Markierungen löschen entfernt auch die Häkchen, die Felder bleiben.', JSON.stringify(ac.checks) === '{}' && ac.marks.length === 0 && ac.cells.length === 9);
  w.toggleCheck('k', cp, 0, true);
  w.newCardFor('k');
  t.check('Neue Karte startet ohne Häkchen.', JSON.stringify(w.eval('appState.cards.k.checks')) === '{}');

  // ───────── 3) Speicher ─────────
  const base = { seed: 1, cells: ['a', 'b', { t: 'Sprachen', p: ['Eins', 'Zwei', 'Drei'], ab: 2 }, 'd', 'e', 'f', 'g', 'h', 'i'], marks: [0] };
  const load = async (card) => (await loadApp({ dataScript: GAME, storage: JSON.stringify({ cards: { k: card }, activeGame: 'k' }) })).window.eval('appState.cards.k');
  const good = await load({ ...base, checks: { 2: [0, 2] } });
  t.check('Gespeicherte Karte mit Häkchen wird unverändert geladen.', good && JSON.stringify(good.checks) === '{"2":[0,2]}' && good.cells[2].ab === 2 && good.marks.join() === '0');
  const old = await load(base);
  t.check('Alte Karte ohne checks-Eintrag lädt mit leeren Häkchen.', old && JSON.stringify(old.checks) === '{}');
  const messy = await load({ ...base, checks: { 2: [2, 0, 0, 7, -1, 1.5, 'x'], 0: [0], 5: [1], '02': [0], abc: [0], '-1': [0], 99: [0] }, marks: [0, 2, 3] });
  t.check('Häkchen werden bereinigt: nur gültige, eindeutige, sortierte Punkte, und nur an Kombi-Feldern.', JSON.stringify(messy.checks) === '{"2":[0,2]}', messy.checks);
  t.check('Markierungen an einem Kombi-Feld werden verworfen (es zählt nur über Häkchen).', messy.marks.join() === '0,3', messy.marks);
  const notArr = await load({ ...base, checks: [1, 2] });
  t.check('checks als Liste statt Objekt wird ignoriert, die Karte bleibt gültig.', notArr && JSON.stringify(notArr.checks) === '{}');
  const badCells = {
    'ab größer als Zahl der Punkte': { ...base, cells: base.cells.map((c, i) => i === 2 ? { ...c, ab: 4 } : c) },
    'ab fehlt': { ...base, cells: base.cells.map((c, i) => i === 2 ? { t: c.t, p: c.p } : c) },
    'nur ein Punkt': { ...base, cells: base.cells.map((c, i) => i === 2 ? { ...c, p: ['x'], ab: 1 } : c) },
    'Punkt ist kein Text': { ...base, cells: base.cells.map((c, i) => i === 2 ? { ...c, p: ['x', 3] } : c) },
    'Titel fehlt': { ...base, cells: base.cells.map((c, i) => i === 2 ? { ...c, t: '' } : c) },
    'Liste statt Objekt': { ...base, cells: base.cells.map((c, i) => i === 2 ? ['x', 'y'] : c) }
  };
  for (const [name, c] of Object.entries(badCells)) t.check(`Ungültiges Kombi-Feld (${name}) -> Karte wird verworfen.`, (await load(c)) === undefined);
  const longC = await load({ ...base, cells: base.cells.map((c, i) => i === 2 ? { t: 'T'.repeat(200), p: ['P'.repeat(200), 'b'], ab: 1 } : c) });
  t.check('Überlange Texte im Kombi-Feld werden auf 80 Zeichen gekürzt.', longC.cells[2].t.length === 80 && longC.cells[2].p[0].length === 80);

  // ───────── 4) Oberfläche ─────────
  const a = await loadApp({ trackErrors: true, dataScript: GAME });
  const A = createHelpers(a.window, a.document);
  A.openGameById('k');
  const cell = A.cells().find(c => c.classList.contains('combo'));
  const pos = +cell.dataset.p;
  t.check('Das Kombi-Feld ist ein Button mit Text und Fortschritt "☑ 0/2" und beschreibendem aria-label.',
    cell.tagName === 'BUTTON' && cell.querySelector('.cell-text').textContent === 'Sprachen' && cell.querySelector('.cell-progress').textContent === '☑ 0/2'
    && /Sprachen, 0 von 2 Häkchen/.test(cell.getAttribute('aria-label')) && !cell.classList.contains('marked'));
  t.check('Normale Felder bleiben reiner Text ohne Fortschrittsanzeige.', A.cells().filter(c => !c.classList.contains('combo')).every(c => !c.querySelector('.cell-progress')));
  A.click(cell);
  const modal = a.document.getElementById('comboModal');
  t.check('Tipp auf das Kombi-Feld öffnet die Checkliste (kein direktes Markieren): Titel, ein Eintrag je Punkt, Fortschrittstext.',
    A.modalOpen('comboModal') && a.document.getElementById('comboTitle').textContent === 'Sprachen' && a.document.querySelectorAll('#comboList .combo-row').length === 3
    && /0 von 3 abgehakt – ab 2 zählt das Feld/.test(a.document.getElementById('comboProgress').textContent) && a.window.eval('appState.cards.k.marks.length') === 0);
  const boxes = () => [...a.document.querySelectorAll('#comboList input')];
  const check = (i, v) => { boxes()[i].checked = v; boxes()[i].dispatchEvent(new a.window.Event('change', { bubbles: true })); };
  const line2 = a.window.linesFor(3).find(l => l.includes(pos));
  // Reihe vorbereiten: alle Textfelder der Reihe markieren (Dialog überdeckt nur optisch)
  line2.filter(p => p !== pos).forEach(p => A.click(A.cell(p)));
  check(0, true);
  t.check('Erstes Häkchen: Karte zeigt "☑ 1/2", Feld noch nicht markiert, Dialogtext aktualisiert, Checkboxen bleiben bestehen.',
    A.cell(pos).querySelector('.cell-progress').textContent === '☑ 1/2' && !A.cell(pos).classList.contains('marked') && /1 von 3 abgehakt/.test(a.document.getElementById('comboProgress').textContent) && boxes().length === 3 && boxes()[0].checked);
  t.check('Ohne Gewinn bleibt das Banner versteckt.', !A.visible(a.document.getElementById('boardBanner')));
  check(2, true);
  t.check('Zweites Häkchen erreicht die Schwelle: Feld ist markiert, Dialog meldet "Geschafft", Bingo-Banner und Toast erscheinen.',
    A.cell(pos).classList.contains('marked') && A.cell(pos).querySelector('.cell-progress').textContent === '☑ 2/2'
    && a.document.getElementById('comboProgress').classList.contains('done') && /Geschafft/.test(a.document.getElementById('comboProgress').textContent)
    && A.visible(a.document.getElementById('boardBanner')) && a.document.getElementById('toast').classList.contains('show') && line2.every(p => A.cell(p).classList.contains('win')));
  check(2, false);
  t.check('Häkchen wieder entfernen: Feld nicht mehr markiert, Gewinn weg, Dialogtext zurück.',
    !A.cell(pos).classList.contains('marked') && !A.visible(a.document.getElementById('boardBanner')) && !a.document.getElementById('comboProgress').classList.contains('done'));
  check(2, true);
  A.click(a.document.querySelector('#comboModal .form-btn-save'));
  t.check('"Fertig" schließt den Dialog; Häkchen bleiben gespeichert.', !A.modalOpen('comboModal') && JSON.stringify(a.window.eval('appState.cards.k.checks')) === `{"${pos}":[0,2]}`);
  A.click(A.cell(pos));
  t.check('Erneutes Öffnen zeigt die gespeicherten Häkchen.', boxes().map(b => b.checked).join() === 'true,false,true');
  A.click(a.document.getElementById('comboModal'));
  t.check('Tipp auf den Hintergrund schließt die Checkliste.', !A.modalOpen('comboModal'));

  // Neustart
  const b = await reloadWithState(a.window, { dataScript: GAME });
  const B = createHelpers(b.window, b.document);
  t.check('Nach Neustart zeigt die Karte den Stand des Kombi-Feldes ("☑ 2/2", markiert).', B.cell(pos).querySelector('.cell-progress').textContent === '☑ 2/2' && B.cell(pos).classList.contains('marked'));

  // Zurücksetzen über die Oberfläche
  b.window.toggleSetting('confirmNewCard', false);
  B.click(b.document.getElementById('btnResetMarks'));
  t.check('"Markierungen löschen" setzt auch das Kombi-Feld zurück.', B.cell(pos).querySelector('.cell-progress').textContent === '☑ 0/2' && !B.cell(pos).classList.contains('marked'));
  t.check('Die Rückfrage vor dem Löschen erscheint auch, wenn nur Häkchen gesetzt sind.', await (async () => {
    const c = await loadApp({ dataScript: GAME }); const C = createHelpers(c.window, c.document);
    C.openGameById('k'); const p = +C.cells().find(x => x.classList.contains('combo')).dataset.p;
    c.window.openCombo(p); c.window.onComboCheck(0, true); c.window.closeModal('comboModal');
    C.click(c.document.getElementById('btnNewCard')); return C.modalOpen('confirmModal');
  })());

  // Escaping
  const EVIL = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{id:'e',titel:'E',groesse:3,freiMitte:false,ziel:'linie',felder:['a','b','c','d','e','f','g','h',
    { text: '<img src=x onerror="window.__pwned=1">Sprachen & "Co"', ab: 1, punkte: ['<b>fett</b>', 'a"b', "c'd"] }]}];`;
  const e = await loadApp({ trackErrors: true, dataScript: EVIL });
  const E = createHelpers(e.window, e.document);
  E.openGameById('e');
  const ec = E.cells().find(c => c.classList.contains('combo'));
  E.click(ec);
  t.check('Sonderzeichen in Kombi-Feld (Titel, Punkte) werden als Text angezeigt und nicht ausgeführt.',
    !e.window.__pwned && !e.document.querySelector('#board img, #comboList b, #comboTitle img') && ec.querySelector('.cell-text').textContent.includes('<img')
    && [...e.document.querySelectorAll('#comboList .combo-row span')].map(s => s.textContent).join('|') === '<b>fett</b>|a"b|c\'d');
  e.document.querySelectorAll('#comboList input')[1].click();
  t.check('Punkt mit Anführungszeichen lässt sich abhaken (kein kaputtes Attribut), Feld wird markiert (ab 1).', E.cell(+ec.dataset.p).classList.contains('marked') && e.errors.length === 0, e.errors);

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0 && a.errors.length === 0 && b.errors.length === 0, [...errors, ...a.errors, ...b.errors]);
  t.finish();
})();
