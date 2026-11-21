const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Kombi-Felder mit eigenen Einträgen (eigene: true): Freitextfelder in der Checkliste, jeder Eintrag zählt wie ein Häkchen,
// nach jedem ausgefüllten Feld erscheint ein neues. Geprüft: Datenprüfung, Logik, Speicher, Oberfläche.
const COMBO = `{ text: 'Sprachen', ab: 3, punkte: ['Deutsch', 'Englisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' }`;
const PLAIN = `{ text: 'Wetter', ab: 2, punkte: ['Sonne', 'Regen', 'Wind'] }`;
const STR = `['a','b','c','d','e','f','g','h']`;
const GAME = `const BINGO_DATA_VERSION = 1; const BINGO_GAMES = [
  { id: 'k', titel: 'K', groesse: 3, freiMitte: false, ziel: 'linie', felder: [...${STR}, ${COMBO}] },
  { id: 'p', titel: 'P', groesse: 3, freiMitte: false, ziel: 'linie', felder: [...${STR}, ${PLAIN}] }];`;

(async () => {
  const t = createChecker();
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true, dataScript: GAME });
  const felder = n => Array.from({ length: n }, (_, i) => 'Feld ' + (i + 1));
  const okGame = c => ({ id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: [...felder(8), c] });
  const probs = (c, text) => w.validateGames([okGame(c)]).filter(i => i.text.includes(text));
  const base = { text: 'S', ab: 2, punkte: ['a', 'b'], eigene: true };

  // ───────── 1) Datenprüfung ─────────
  t.check('Kombi-Feld mit eigene: true ist gültig.', w.validateGames([okGame(base)]).length === 0);
  t.check('Mit eigene: true darf punkte leer sein (reines Freitextfeld) oder nur einen Eintrag haben.', probs({ ...base, punkte: [] }, 'punkte').length === 0 && probs({ ...base, punkte: ['a'] }, 'punkte').length === 0);
  t.check('Ohne eigene bleiben mindestens 2 Punkte Pflicht (Fehler "2 bis 12"), mit eigene steht "0 bis 12".',
    probs({ ...base, eigene: undefined, punkte: ['a'], ab: 1 }, '2 bis 12').length === 1 && probs({ ...base, punkte: Array.from({ length: 13 }, (_, i) => 'p' + i) }, '0 bis 12').length === 1);
  t.check('punkte fehlt ganz -> Fehler, auch mit eigene.', probs({ text: 'S', ab: 1, eigene: true }, 'punkte braucht').length === 1);
  t.check('Mit eigene darf ab größer sein als die Zahl der Punkte, bis punkte + 10 (2 + 10 = 12 ok, 13 Fehler).', probs({ ...base, ab: 12 }, 'ab muss').length === 0 && probs({ ...base, ab: 13 }, 'ab muss').length === 1);
  t.check('Ohne eigene bleibt ab auf die Zahl der Punkte begrenzt.', probs({ ...base, eigene: undefined, ab: 3 }, 'ab muss').length === 1);
  t.check('eigene, das kein true/false ist, -> Fehler; eigene: false verhält sich wie ohne.', probs({ ...base, eigene: 'ja' }, 'eigene muss').length === 1 && probs({ ...base, eigene: false, punkte: ['a'], ab: 1 }, 'punkte braucht').length === 1);
  t.check('eigeneHinweis, der kein Text ist, -> Fehler.', probs({ ...base, eigeneHinweis: 5 }, 'eigeneHinweis').length === 1);

  // ───────── 2) Karte und Logik ─────────
  const game = w.eval('allGames').find(g => g.id === 'k'), plainGame = w.eval('allGames').find(g => g.id === 'p');
  const card = w.createCard(game, 3);
  const pc = card.cells.findIndex(c => c && typeof c === 'object');
  t.check('Karte: Zelle trägt e: true und den Platzhalter (h); card.eigene startet leer.', card.cells[pc].e === true && card.cells[pc].h === 'Weitere Sprache' && JSON.stringify(card.eigene) === '{}');
  const pcard = w.createCard(plainGame, 3), pp = pcard.cells.findIndex(c => c && typeof c === 'object');
  t.check('Kombi-Feld ohne eigene: Zelle ohne e und h.', !('e' in pcard.cells[pp]) && !('h' in pcard.cells[pp]));

  w.localStorage.clear(); w.startGame('k'); w.startGame('p');
  const ac = w.eval('appState.cards.k'), cp = ac.cells.findIndex(c => c && typeof c === 'object');
  const pcc = w.eval('appState.cards.p'), ppos = pcc.cells.findIndex(c => c && typeof c === 'object');
  let r = w.setEigene('k', cp, ['  Latein ', '', 'Japanisch', '   ']);
  t.check('setEigene speichert getrimmt, ohne leere Einträge; sie zählen wie Häkchen.', r.changed && JSON.stringify(ac.eigene[cp]) === '["Latein","Japanisch"]' && w.comboCount(ac, cp) === 2 && !w.isMarked(ac, cp));
  r = w.setEigene('k', cp, ['Latein', 'Japanisch']);
  t.check('Gleiche Liste noch einmal setzen ändert nichts.', !r.changed);
  w.toggleCheck('k', cp, 0, true);
  t.check('Ein festes Häkchen plus zwei eigene Einträge erreichen die Schwelle (3): Feld markiert.', w.comboCount(ac, cp) === 3 && w.isMarked(ac, cp));
  w.setEigene('k', cp, ['Latein']);
  t.check('Ein eigener Eintrag weniger: Feld fällt unter die Schwelle.', !w.isMarked(ac, cp));
  w.setEigene('k', cp, ['latein', ' LATEIN ', 'Deutsch', 'deutsch', 'Englisch']);
  t.check('Doppelte Einträge (Groß/Klein, Leerzeichen) und Einträge, die einem festen Punkt gleichen, zählen nicht: nur "latein" zählt (+ 1 festes Häkchen = 2).', w.comboCount(ac, cp) === 2, w.comboCount(ac, cp));
  w.setEigene('k', cp, Array.from({ length: 14 }, (_, i) => 'E' + i));
  t.check('Höchstens 10 eigene Einträge bleiben erhalten.', ac.eigene[cp].length === 10 && ac.eigene[cp][9] === 'E9');
  w.setEigene('k', cp, ['x'.repeat(100)]);
  t.check('Ein langer Eintrag wird auf 40 Zeichen gekürzt.', ac.eigene[cp][0].length === 40);
  w.setEigene('k', cp, []);
  t.check('Leere Liste entfernt den Eintrag ganz.', !(cp in ac.eigene));
  t.check('Ungültige Aufrufe werden ignoriert: Kombi-Feld ohne eigene, Textfeld, unbekanntes Spiel, keine Liste, falscher Typ.',
    !w.setEigene('p', ppos, ['x']).changed && !w.setEigene('k', (cp + 1) % 9, ['x']).changed && !w.setEigene('nix', cp, ['x']).changed && !w.setEigene('k', cp, 'x').changed && !w.setEigene('k', 99, ['x']).changed
    && JSON.stringify(w.eval('appState.cards.p.eigene')) === '{}');
  t.check('Nicht-Text-Einträge in der Liste werden übersprungen.', (w.setEigene('k', cp, [5, null, 'ok', {}]), JSON.stringify(ac.eigene[cp]) === '["ok"]'));
  w.setEigene('k', cp, []);

  // Gewinn über eigene Einträge
  const line = w.linesFor(3).find(l => l.includes(cp));
  line.filter(p => p !== cp).forEach(p => w.toggleMark('k', p));
  w.toggleCheck('k', cp, 0, true);
  r = w.setEigene('k', cp, ['Latein']);
  t.check('Reihe offen, Kombi-Feld noch unter der Schwelle (2 von 3): kein Gewinn.', !r.won && !w.isWon(game, ac));
  r = w.setEigene('k', cp, ['Latein', 'Japanisch']);
  t.check('Der Eintrag, der die Schwelle erreicht und die Reihe schließt, meldet justWon.', r.justWon && r.won);
  r = w.setEigene('k', cp, ['Latein', 'Japanisch', 'Türkisch']);
  t.check('Weitere Einträge danach melden kein neues justWon.', r.changed && r.won && !r.justWon);

  w.resetMarks('k');
  t.check('Markierungen löschen entfernt auch die eigenen Einträge.', JSON.stringify(ac.eigene) === '{}' && JSON.stringify(ac.checks) === '{}');
  w.setEigene('k', cp, ['x']); w.newCardFor('k');
  t.check('Neue Karte startet ohne eigene Einträge.', JSON.stringify(w.eval('appState.cards.k.eigene')) === '{}');

  // ───────── 3) Speicher ─────────
  const cellE = { t: 'Sprachen', p: ['Deutsch', 'Englisch'], ab: 3, e: true, h: 'Weitere Sprache' };
  const base9 = (cell = cellE) => ({ seed: 1, cells: ['a', 'b', cell, 'd', 'e', 'f', 'g', 'h', 'i'], marks: [], checks: {} });
  const load = async (card) => (await loadApp({ dataScript: GAME, storage: JSON.stringify({ cards: { k: card }, activeGame: 'k' }) })).window.eval('appState.cards.k');
  const ok = await load({ ...base9(), eigene: { 2: ['Latein', 'Japanisch'] } });
  t.check('Gespeicherte eigene Einträge werden geladen, e und Platzhalter bleiben.', ok && JSON.stringify(ok.eigene) === '{"2":["Latein","Japanisch"]}' && ok.cells[2].e === true && ok.cells[2].h === 'Weitere Sprache');
  const old = await load(base9());
  t.check('Karte ohne eigene-Eintrag lädt mit leerer Liste.', old && JSON.stringify(old.eigene) === '{}');
  const messy = await load({ ...base9(), eigene: { 2: ['  Latein  ', 5, null, '', '   ', 'x'.repeat(100), ...Array.from({ length: 12 }, (_, i) => 'E' + i)], 0: ['Text'], 5: ['Text'], abc: ['x'], '02': ['x'], '-1': ['x'], 99: ['x'] } });
  t.check('Eigene Einträge werden bereinigt: getrimmt, ohne Leere und Nicht-Texte, auf 40 Zeichen gekürzt, höchstens 10.', messy.eigene[2][0] === 'Latein' && messy.eigene[2][1].length === 40 && messy.eigene[2].length === 10 && messy.eigene[2].every(x => typeof x === 'string' && x === x.trim() && x), messy.eigene[2]);
  t.check('Einträge an Textfeldern, ungültigen oder fremden Positionen werden verworfen.', Object.keys(messy.eigene).join() === '2', Object.keys(messy.eigene));
  const onPlain = await load({ ...base9({ t: 'Wetter', p: ['Sonne', 'Regen', 'Wind'], ab: 2 }), eigene: { 2: ['Schnee'] } });
  t.check('Eigene Einträge an einem Kombi-Feld ohne e werden verworfen.', onPlain && JSON.stringify(onPlain.eigene) === '{}');
  const asArray = await load({ ...base9(), eigene: ['x'] });
  t.check('eigene als Liste statt Objekt wird ignoriert, Karte bleibt gültig.', asArray && JSON.stringify(asArray.eigene) === '{}');
  t.check('Zelle mit ab über Punkte + 10 (13) wird verworfen, mit 12 angenommen.', (await load(base9({ ...cellE, ab: 13 }))) === undefined && !!(await load(base9({ ...cellE, ab: 12 }))));
  t.check('e, das nicht true ist, schaltet die erweiterte Schwelle nicht frei (ab 3 bei 2 Punkten -> verworfen).', (await load(base9({ ...cellE, e: 'yes' }))) === undefined);
  t.check('Ohne e braucht das Kombi-Feld weiterhin 2 Punkte; mit e darf p leer sein.', (await load(base9({ ...cellE, e: undefined, p: [], ab: 1 }))) === undefined && !!(await load(base9({ ...cellE, p: [], ab: 1 }))));
  const hh = await load(base9({ ...cellE, h: '  ' + 'H'.repeat(60) + '  ' }));
  t.check('Platzhalter wird getrimmt und auf 40 Zeichen gekürzt; ein Platzhalter, der kein Text ist, entfällt.', hh.cells[2].h.length === 40 && !('h' in (await load(base9({ ...cellE, h: 7 }))).cells[2]));

  // ───────── 4) Oberfläche ─────────
  const a = await loadApp({ trackErrors: true, dataScript: GAME });
  const A = createHelpers(a.window, a.document), D = a.document;
  A.openGameById('k');
  const cell = A.cells().find(c => c.classList.contains('combo')), pos = +cell.dataset.p;
  const own = () => [...D.querySelectorAll('#comboOwnList .combo-own-input')];
  const type = (i, v) => { own()[i].value = v; own()[i].dispatchEvent(new a.window.Event('input', { bubbles: true })); };
  const leave = i => own()[i].dispatchEvent(new a.window.Event('change', { bubbles: true }));
  const checks = () => [...D.querySelectorAll('#comboList input')];
  const prog = () => D.getElementById('comboProgress');
  const stored = () => a.window.eval(`appState.cards.k.eigene[${pos}]`);
  A.click(cell);
  t.check('Dialog zeigt die festen Punkte und darunter genau ein leeres Eingabefeld mit dem Platzhalter aus eigeneHinweis.',
    checks().length === 2 && D.getElementById('comboOwn').style.display !== 'none' && own().length === 1 && own()[0].value === '' && own()[0].placeholder === 'Weitere Sprache' && own()[0].maxLength === 40);
  t.check('Zu Beginn: Fortschritt "0 gezählt – ab 3 zählt das Feld".', /0 gezählt – ab 3/.test(prog().textContent));
  type(0, 'Latein');
  t.check('Erster Eintrag: gespeichert, Fortschritt 1, Karte zeigt "☑ 1/3", und es erscheint ein neues leeres Feld.',
    JSON.stringify(stored()) === '["Latein"]' && /1 gezählt/.test(prog().textContent) && A.cell(pos).querySelector('.cell-progress').textContent === '☑ 1/3' && own().length === 2 && own()[1].value === '');
  type(1, 'Japanisch');
  t.check('Zweiter Eintrag: Fortschritt 2, wieder ein neues leeres Feld (3 Felder), das erste Feld behält seinen Text.', JSON.stringify(stored()) === '["Latein","Japanisch"]' && /2 gezählt/.test(prog().textContent) && own().length === 3 && own()[0].value === 'Latein');
  type(1, 'Japanisch ');
  t.check('Tippen ohne inhaltliche Änderung (nur Leerzeichen) lässt die Felder in Ruhe (keine zusätzlichen leeren Felder).', own().length === 3);
  t.check('Normale Felder bleiben vom Dialog unberührt: noch keine Markierung, Banner versteckt.', !A.cell(pos).classList.contains('marked') && !A.visible(D.getElementById('boardBanner')));

  // Duplikate
  type(2, 'deutsch');
  t.check('Eintrag, der einem festen Punkt gleicht, wird gestrichelt markiert und zählt nicht (Fortschritt bleibt 2).', own()[2].classList.contains('dup') && /2 gezählt/.test(prog().textContent) && !own()[0].classList.contains('dup'));
  type(2, 'latein');
  t.check('Doppelter eigener Eintrag (Groß/Klein) wird markiert und zählt nicht.', own()[2].classList.contains('dup') && /2 gezählt/.test(prog().textContent));
  type(2, '');
  t.check('Leeren des Feldes nimmt die Markierung wieder weg.', !own()[2].classList.contains('dup'));

  // Gewinn: Reihe mit dem Kombi-Feld vorbereiten, dann Schwelle über festes Häkchen + eigene Einträge
  const line2 = a.window.linesFor(3).find(l => l.includes(pos));
  line2.filter(p => p !== pos).forEach(p => A.click(A.cell(p)));
  t.check('Reihe offen, Kombi-Feld bei 2 von 3: noch kein Banner.', !A.visible(D.getElementById('boardBanner')));
  checks()[0].checked = true; checks()[0].dispatchEvent(new a.window.Event('change', { bubbles: true }));
  t.check('Festes Häkchen plus zwei eigene Einträge: Feld markiert, Dialog meldet "Geschafft", Banner und Toast erscheinen.',
    A.cell(pos).classList.contains('marked') && A.cell(pos).querySelector('.cell-progress').textContent === '☑ 3/3' && /Geschafft: 3 gezählt/.test(prog().textContent) && prog().classList.contains('done')
    && A.visible(D.getElementById('boardBanner')) && D.getElementById('toast').classList.contains('show'));

  // Aufräumen mitten in der Liste
  type(0, '');
  t.check('Ersten Eintrag leeren: Fortschritt sinkt, Feld nicht mehr markiert, nur der verbliebene Eintrag ist gespeichert.', /2 gezählt/.test(prog().textContent) && !A.cell(pos).classList.contains('marked') && JSON.stringify(stored()) === '["Japanisch"]');
  leave(0);
  t.check('Beim Verlassen des Feldes wird die Lücke aufgeräumt: nur befüllte Felder plus ein leeres am Ende.', own().map(i => i.value.trim()).join('|') === 'Japanisch|', own().map(i => i.value));

  // Schließen, Öffnen, Neustart
  A.click(D.querySelector('#comboModal .form-btn-save'));
  A.click(A.cell(pos));
  t.check('Erneutes Öffnen zeigt die gespeicherten Einträge und ein leeres Feld am Ende.', own().map(i => i.value).join('|') === 'Japanisch|' && checks()[0].checked);
  const b = await reloadWithState(a.window, { dataScript: GAME });
  b.window.openCombo(pos);
  t.check('Nach Neustart sind die Einträge noch da.', [...b.document.querySelectorAll('#comboOwnList .combo-own-input')].map(i => i.value).join('|') === 'Japanisch|');

  // Höchstzahl der Felder
  A.click(D.querySelector('#comboModal .form-btn-save'));
  a.window.resetMarks('k'); a.window.renderBoard(); A.click(A.cell(pos));
  for (let i = 0; i < 12; i++) type(Math.min(i, own().length - 1), 'Sprache ' + i);
  t.check('Mehr als 10 Eingabefelder gibt es nicht: nach 10 Einträgen kommt kein neues leeres Feld.', own().length === 10 && stored().length === 10 && own().every(i => i.value), { felder: own().length, gespeichert: stored() });

  // Zurücksetzen und Rückfrage
  A.click(D.querySelector('#comboModal .form-btn-save'));
  const c = await loadApp({ dataScript: GAME }); const C = createHelpers(c.window, c.document);
  C.openGameById('k'); const cpos = +C.cells().find(x => x.classList.contains('combo')).dataset.p;
  c.window.openCombo(cpos); c.document.querySelector('#comboOwnList .combo-own-input').value = 'Latein'; c.document.querySelector('#comboOwnList .combo-own-input').dispatchEvent(new c.window.Event('input', { bubbles: true }));
  c.window.closeModal('comboModal');
  C.click(c.document.getElementById('btnResetMarks'));
  t.check('Die Rückfrage vor dem Löschen erscheint auch, wenn nur ein eigener Eintrag vorhanden ist.', C.modalOpen('confirmModal'));
  C.click(c.document.getElementById('confirmYes'));
  t.check('Nach dem Löschen sind die eigenen Einträge weg und die Karte zeigt "☑ 0/3".', JSON.stringify(c.window.eval('appState.cards.k.eigene')) === '{}' && C.cell(cpos).querySelector('.cell-progress').textContent === '☑ 0/3');

  // Kombi-Feld ohne eigene: kein Freitext
  const p = await loadApp({ dataScript: GAME }); const P = createHelpers(p.window, p.document);
  P.openGameById('p'); P.click(P.cells().find(x => x.classList.contains('combo')));
  t.check('Kombi-Feld ohne eigene zeigt keinen Bereich für eigene Einträge.', p.document.getElementById('comboOwn').style.display === 'none' && p.document.querySelectorAll('#comboOwnList input').length === 0);

  // Escaping
  const EVIL = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{id:'e',titel:'E',groesse:3,freiMitte:false,ziel:'linie',felder:['a','b','c','d','e','f','g','h',
    { text: 'S', ab: 1, punkte: ['x','y'], eigene: true, eigeneHinweis: 'Sprache "x" <b>fett</b>' }]}];`;
  const e = await loadApp({ trackErrors: true, dataScript: EVIL }); const E = createHelpers(e.window, e.document);
  E.openGameById('e');
  const epos = +E.cells().find(x => x.classList.contains('combo')).dataset.p;
  E.click(E.cell(epos));
  const first = () => e.document.querySelector('#comboOwnList .combo-own-input');
  t.check('Platzhalter mit Anführungszeichen und HTML bleibt Text (kein Element, Attribut nicht kaputt).', first().placeholder === 'Sprache "x" <b>fett</b>' && !e.document.querySelector('#comboOwn b'));
  const evil = '"><img src=x onerror=window.__pwned=1>';
  first().value = evil; first().dispatchEvent(new e.window.Event('input', { bubbles: true }));
  e.window.closeModal('comboModal'); E.click(E.cell(epos));
  t.check('Ein Eintrag mit Anführungszeichen und HTML wird unverändert gespeichert, wieder angezeigt und nicht ausgeführt.',
    first().value === evil && !e.window.__pwned && !e.document.querySelector('#comboOwn img, #board img') && e.errors.length === 0, e.errors);

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0 && a.errors.length === 0 && b.errors.length === 0 && c.errors.length === 0 && p.errors.length === 0, [...errors, ...a.errors, ...c.errors]);
  t.finish();
})();
