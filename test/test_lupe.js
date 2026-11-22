const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Große Karten (7×7, 9×9), Kurztexte und Lupe: Daten, Normalisierung, Einstellungen, Oberfläche.
const gameData = (felder, extra = '') => `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'g', titel:'G', groesse:3, freiMitte:false, ziel:'linie', ${extra} felder:${felder} }];`;
const NINE = `['a','b','c','d','e','f','g','h','i']`;
const PAIRS = `[['Langer Text eins','Eins'],['Langer Text zwei','Zwei'],'drei','vier','fünf','sechs','sieben','acht','neun']`;

(async () => {
  const t = createChecker();
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const games = w.eval('allGames');
  const g = id => games.find(x => x.id === id);
  const felder = n => Array.from({ length: n }, (_, i) => 'Feld ' + (i + 1));
  const ok = over => ({ id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: felder(9), ...over });

  // ───────── 1) Größen 7 und 9 ─────────
  t.check('Kartengrößen 7 und 9 sind gültig; 6, 8 und 10 nicht.', [7, 9].every(n => !w.validateGames([ok({ groesse: n, felder: felder(81) })]).some(i => i.text.includes('groesse'))) && [6, 8, 10].every(n => w.validateGames([ok({ groesse: n, felder: felder(100) })]).some(i => i.text.includes('groesse'))));
  t.check('Freifeld: 7×7 in der Mitte (Position 24, 48 Felder nötig), 9×9 (Position 40, 80 Felder nötig).', JSON.stringify(w.freePositions({ groesse: 7, freiMitte: true })) === '[24]' && w.felderBenoetigt({ groesse: 7, freiMitte: true }) === 48 && JSON.stringify(w.freePositions({ groesse: 9, freiMitte: true })) === '[40]' && w.felderBenoetigt({ groesse: 9, freiMitte: true }) === 80);
  t.check('Linien: 7×7 hat 16, 9×9 hat 20 (Reihen, Spalten, 2 Diagonalen).', w.linesFor(7).length === 16 && w.linesFor(9).length === 20 && w.linesFor(9).every(l => l.length === 9));
  const c7 = w.createCard(g('festivalwoche'), 5), c9 = w.createCard(g('testkarte9'), 5);
  t.check('Karten: 7×7 mit 49 Zellen (Mitte frei, 48 verschiedene Felder), 9×9 mit 81 Zellen (Mitte frei, 80 verschiedene).',
    c7.cells.length === 49 && c7.cells[24] === null && new Set(c7.cells.filter(Boolean).map(c => typeof c === 'string' ? c : c.t)).size === 48
    && c9.cells.length === 81 && c9.cells[40] === null && new Set(c9.cells.filter(Boolean)).size === 80);

  // ───────── 2) Kurztexte in den Daten ─────────
  const n1 = w.normalizeGames(JSON.parse(JSON.stringify([ok({ felder: [['Langer Text', 'Kurz'], 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] })])))[0];
  t.check('Ein Paar [Text, Kurztext] wird zum normalen Feld; der Kurztext liegt in game.kurz[Text].', n1.felder[0] === 'Langer Text' && n1.kurz['Langer Text'] === 'Kurz' && w.kurzOf(n1, 'Langer Text') === 'Kurz' && w.kurzOf(n1, 'b') === '');
  const n2 = w.normalizeGames(w.normalizeGames([ok({ felder: [['A', 'a'], ...felder(8)] })]))[0];
  t.check('Normalisieren ist wiederholbar (Kurztexte bleiben erhalten).', n2.kurz.A === 'a' && n2.felder[0] === 'A');
  const combo = { text: 'Sprachen', kurz: 'Spr.', ab: 1, punkte: ['x', 'y'] };
  t.check('Kombi-Feld mit kurz: der Kurztext wird erfasst; ein kurz, das kein Text ist, wird ignoriert.', w.kurzOf(w.normalizeGames([ok({ felder: [combo, ...felder(8)] })])[0], 'Sprachen') === 'Spr.' && w.kurzOf(w.normalizeGames([ok({ felder: [{ ...combo, kurz: 5 }, ...felder(8)] })])[0], 'Sprachen') === '');
  t.check('Gültige Paare und Kombi-Felder mit kurz: keine Befunde; ein Paar zählt als ein Feld.', w.validateGames([ok({ felder: [['A', 'a'], ['B', 'b'], ...felder(7)] })]).length === 0);
  t.check('Ungültige Paare (3 Einträge, leerer Text, kein Text) -> Fehler.', [['a', 'b', 'c'], ['a', ' '], ['', 'b'], ['a', 5]].every(p => w.validateGames([ok({ felder: [p, ...felder(8)] })]).some(i => i.level === 'fehler' && i.text.includes('felder'))));
  t.check('Doppelter Text zwischen Paar und Textfeld -> Fehler "doppelte Felder".', w.validateGames([ok({ felder: [['Feld 1', 'x'], ...felder(8)] })]).some(i => i.text.includes('doppelte Felder')));
  t.check('Kurztext über 20 Zeichen -> nur Hinweis, Spiel bleibt spielbar.', (r => r.length === 1 && r[0].level === 'hinweis' && r[0].text.includes('Kurztext'))(w.validateGames([ok({ felder: [['A', 'k'.repeat(21)], ...felder(8)] })])));
  const sizes = w.eval('allGames').map(x => x.groesse);
  t.check('Mitgelieferte Spiele enthalten 7×7 und 9×9, mit Kurztexten, ohne Befunde.', sizes.includes(7) && sizes.includes(9) && w.validateGames(games).length === 0 && Object.keys(g('festivalwoche').kurz).length >= 48 && Object.keys(g('testkarte9').kurz).length === 81);
  t.check('Alle mitgelieferten Kurztexte sind höchstens 20 Zeichen lang.', games.every(x => Object.values(x.kurz).every(k => k.length <= 20)));

  // ───────── 3) Einstellungen ─────────
  t.check('Standard: Kurztexte an, Lupe automatisch.', w.eval('appState.settings.useKurz') === true && w.eval('appState.settings.lupe') === 'auto');
  w.setLupeMode('quatsch'); w.toggleSetting('lupe', true);
  t.check('Ungültiger Lupen-Modus wird ignoriert; toggleSetting wirkt nicht auf den Lupen-Modus.', w.eval('appState.settings.lupe') === 'auto');
  const bad = await loadApp({ storage: JSON.stringify({ settings: { useKurz: 'nein', lupe: 'vielleicht' } }) });
  t.check('Gespeicherte ungültige Werte fallen auf die Standardwerte zurück.', bad.window.eval('appState.settings.useKurz') === true && bad.window.eval('appState.settings.lupe') === 'auto');

  // ───────── 4) Oberfläche ─────────
  const open = id => { w.switchTab('spiele'); H.openGameById(id); };
  const lupe = () => d.getElementById('lupe');
  const shown = () => lupe().style.display !== 'none';
  open('festivalwoche');
  const card = w.eval('appState.cards.festivalwoche'), game = g('festivalwoche');
  const fullOf = c => card.cells[+c.dataset.p];
  // ein Feld, bei dem der Kurztext wirklich vom ganzen Text abweicht (bei manchen ist beides gleich, dann wird nichts verkürzt)
  const plain = H.cells().find(c => typeof fullOf(c) === 'string' && game.kurz[fullOf(c)] && game.kurz[fullOf(c)] !== fullOf(c));
  t.check('7×7: sieben Spalten, Kurztexte auf den Feldern (Klasse kurz), ganzer Text im aria-label und im Tooltip.',
    d.getElementById('board').style.getPropertyValue('--n') === '7' && H.cells().length === 49 && plain.classList.contains('kurz') && plain.textContent === game.kurz[fullOf(plain)] && plain.getAttribute('aria-label') === fullOf(plain) && plain.title === fullOf(plain));
  t.check('Lupe ist sichtbar (automatisch bei Kurztexten/7×7) und zeigt zu Beginn den Hinweis.', shown() && /Tippe ein Feld an/.test(lupe().textContent));
  const pp = +plain.dataset.p, cur = () => H.cell(pp);
  H.click(plain);
  t.check('Antippen markiert das Feld und zeigt in der Lupe den ganzen Text mit "markiert".', cur().classList.contains('marked') && lupe().querySelector('.lupe-text').textContent === fullOf(plain) && /^markiert/.test(lupe().querySelector('small').textContent));
  H.click(cur());
  t.check('Erneutes Antippen: Markierung weg, Lupe zeigt "nicht markiert".', !cur().classList.contains('marked') && /nicht markiert/.test(lupe().querySelector('small').textContent));
  const other = H.cells().find(c => c !== plain && !c.classList.contains('free') && !c.classList.contains('combo'));
  H.click(other);
  t.check('Ein anderes Feld ersetzt den Text in der Lupe.', lupe().querySelector('.lupe-text').textContent === fullOf(other));
  H.click(H.cell(24));
  t.check('Das Freifeld ändert die Lupe nicht.', lupe().querySelector('.lupe-text').textContent === fullOf(other));
  const cc = H.cells().find(c => c.classList.contains('combo'));
  H.click(cc);
  t.check('Kombi-Feld: der Dialog öffnet sich, die Lupe zeigt den Titel und den Fortschritt; auf dem Feld steht der Kurztext.', H.modalOpen('comboModal') && /^☑ 0\//.test(lupe().querySelector('small').textContent) && lupe().querySelector('.lupe-text').textContent === fullOf(cc).t && cc.querySelector('.cell-text').textContent === game.kurz[fullOf(cc).t]);
  w.closeModal('comboModal');

  w.toggleSetting('useKurz', false);
  const afterOff = H.cells().find(c => +c.dataset.p === +plain.dataset.p);
  t.check('Kurztexte aus: Felder zeigen den ganzen Text ohne Klasse kurz.', afterOff.textContent === fullOf(afterOff) && !afterOff.classList.contains('kurz') && !afterOff.hasAttribute('aria-label') && shown());
  w.toggleSetting('useKurz', true);

  w.setLupeMode('aus');
  t.check('Lupe "aus": nicht sichtbar, auch bei 7×7.', !shown());
  w.setLupeMode('auto');
  open('klubnacht');
  t.check('Lupe "automatisch" bei 3×3 ohne Kurztexte: nicht sichtbar.', !shown());
  w.setLupeMode('immer');
  t.check('Lupe "immer": auch bei 3×3 sichtbar.', shown());
  w.setLupeMode('auto');

  open('festivalwoche');
  t.check('Beim erneuten Öffnen eines Spiels steht in der Lupe wieder der Hinweis.', /Tippe ein Feld an/.test(lupe().textContent));
  H.click(H.cells().find(c => !c.classList.contains('free') && !c.classList.contains('combo')));
  d.getElementById('btnNewCard').click();
  if (H.modalOpen('confirmModal')) d.getElementById('confirmYes').click();
  t.check('Neue Karte setzt die Lupe zurück.', /Tippe ein Feld an/.test(lupe().textContent));

  // 5×5 mit Kurztexten: Lupe automatisch sichtbar
  const k5 = await loadApp({ dataScript: `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'g', titel:'G', groesse:5, freiMitte:true, ziel:'linie', felder:${JSON.stringify([['Lang 1', 'k1'], ...Array.from({ length: 23 }, (_, i) => 'F' + i)])} }];` });
  createHelpers(k5.window, k5.document).openGameById('g');
  t.check('Bei 5×5 mit mindestens einem Kurztext ist die Lupe automatisch sichtbar.', k5.document.getElementById('lupe').style.display !== 'none');

  // 7×7 ohne Kurztexte: Lupe automatisch sichtbar (große Karte)
  const k7 = await loadApp({ dataScript: `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'g', titel:'G', groesse:7, freiMitte:true, ziel:'linie', felder:${JSON.stringify(Array.from({ length: 48 }, (_, i) => 'Feld ' + i))} }];` });
  createHelpers(k7.window, k7.document).openGameById('g');
  t.check('Bei 7×7 ohne Kurztexte ist die Lupe automatisch sichtbar; die Felder zeigen den ganzen Text.', k7.document.getElementById('lupe').style.display !== 'none' && k7.document.querySelectorAll('#board .cell.kurz').length === 0);

  // 9×9
  open('testkarte9');
  t.check('9×9: 81 Zellen, Mitte frei, Kurztexte mit Symbol, Lupe zeigt nach dem Antippen den ganzen Text.', (() => {
    const c9 = w.eval('appState.cards.testkarte9'), cell = H.cells().find(c => !c.classList.contains('free'));
    H.click(cell);
    return H.cells().length === 81 && H.cell(40).classList.contains('free') && /^\p{Extended_Pictographic}/u.test(cell.textContent) && lupe().querySelector('.lupe-text').textContent === c9.cells[+cell.dataset.p];
  })());

  // Sonderzeichen
  const EVIL = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'e', titel:'E', groesse:3, freiMitte:false, ziel:'linie', felder:[['Text "mit" <img src=x onerror=window.__pwned=1> & \\'Quote\\'', 'Kurz "<b>"'],'b','c','d','e','f','g','h','i'] }];`;
  const e = await loadApp({ trackErrors: true, dataScript: EVIL }); const E = createHelpers(e.window, e.document);
  E.openGameById('e');
  const ec = E.cells().find(c => c.classList.contains('kurz'));
  E.click(ec);
  t.check('Sonderzeichen in Text und Kurztext (Feld, aria-label, Tooltip, Lupe) bleiben Text und werden nicht ausgeführt.',
    !e.window.__pwned && !e.document.querySelector('#board img, #lupe img, #board b') && ec.textContent === 'Kurz "<b>"' && ec.getAttribute('aria-label').includes('<img') && e.document.querySelector('#lupe .lupe-text').textContent.includes('<img') && e.errors.length === 0, e.errors);

  // Neustart: Einstellung bleibt, Lupe-Text nicht
  w.setLupeMode('immer'); w.toggleSetting('useKurz', false);
  const r = await reloadWithState(w);
  t.check('Nach Neustart bleiben Lupen-Modus und Kurztext-Einstellung; die Einstellungen stehen in der Oberfläche.', r.window.eval('appState.settings.lupe') === 'immer' && r.window.eval('appState.settings.useKurz') === false && r.document.getElementById('settingLupe').value === 'immer' && r.document.getElementById('settingUseKurz').checked === false);
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0 && e.errors.length === 0 && r.errors.length === 0, [...errors, ...e.errors, ...r.errors]);
  t.finish();
})();
