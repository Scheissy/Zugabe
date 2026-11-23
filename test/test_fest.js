const { ROOT, loadApp, createChecker, createHelpers } = require('./test-helpers');

// Feste Karten (fest: true) und das mitgelieferte Spiel "Konzerte Bingo Season 10" (7×7, aus einem Screenshot übernommen).
(async () => {
  const t = createChecker();
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const games = w.eval('allGames');
  const g10 = games.find(g => g.id === 'konzerte-bingo-season-10');
  const felder = n => Array.from({ length: n }, (_, i) => 'Feld ' + (i + 1));
  const mk = over => ({ id: 'x', titel: 'X', groesse: 3, freiMitte: false, ziel: 'linie', felder: felder(9), ...over });

  // ───────── 1) Option fest ─────────
  t.check('fest: true/false und weggelassen sind gültig; ein anderer Typ ist ein Fehler.', [true, false, undefined].every(v => w.validateGames([mk({ fest: v })]).length === 0) && ['ja', 1, null, {}].every(v => w.validateGames([mk({ fest: v })]).some(i => i.level === 'fehler' && i.text.includes('fest'))));
  const fixed = mk({ fest: true });
  t.check('Feste Karte: die Felder stehen in der Reihenfolge der Liste, unabhängig vom Seed.', [1, 2, 99, 12345].every(s => JSON.stringify(w.createCard(fixed, s).cells) === JSON.stringify(felder(9))));
  const mixed = [1, 2, 3, 4, 5].map(s => JSON.stringify(w.createCard(mk({}), s).cells));
  t.check('Ohne fest wird weiterhin je nach Seed anders gemischt.', new Set(mixed).size > 1, mixed.length);
  t.check('Fest mit Freifeld: das Freifeld bleibt in der Mitte, die Felder laufen in Reihenfolge darum herum.', JSON.stringify(w.createCard(mk({ fest: true, freiMitte: true, felder: felder(8) }), 5).cells) === JSON.stringify([...felder(8).slice(0, 4), null, ...felder(8).slice(4)]));
  t.check('Fest mit mehr Feldern als Plätzen: die ersten Felder der Liste werden genommen.', JSON.stringify(w.createCard(mk({ fest: true, freiMitte: true, felder: felder(12) }), 5).cells) === JSON.stringify([...felder(12).slice(0, 4), null, ...felder(12).slice(4, 8)]));
  const withCombo = mk({ fest: true, felder: [...felder(4), { text: 'Wetter', ab: 1, punkte: ['a', 'b'] }, ...felder(8).slice(4)] });
  const cc = w.createCard(withCombo, 3);
  t.check('Ein Kombi-Feld bleibt an seiner Stelle in der festen Karte (Position 4).', typeof cc.cells[4] === 'object' && cc.cells[4].t === 'Wetter' && cc.cells[3] === 'Feld 4' && cc.cells[5] === 'Feld 5');

  // ───────── 2) Das mitgelieferte Spiel ─────────
  t.check('Spiel "Konzerte Bingo Season 10" ist vorhanden: id, Titel, 7×7, ohne Freifeld, feste Karte.', !!g10 && g10.titel === 'Konzerte Bingo Season 10' && g10.groesse === 7 && g10.freiMitte === false && g10.fest === true);
  t.check('Die im Screenshot angeschnittenen Felder stehen mit vollem Wortlaut da (9 Korrekturen), nichts ist mehr als unsicher markiert.', ['vor Ort erkennen, dass die Band schon kannte', 'Bands zweimal im Jahr sehen', 'Flinta Moshpit zum Ausruhen', 'Musiker aus anderen Bands im Publikum', 'vorher nicht reingehört, dann Vinyl gekauft', '2 unterschiedliche Locations an einem Tag', '3 Monate vorher Ticket kaufen', 'Kein Le HH B Hal HB Konzert'].every(f => g10.felder.includes(f)) && g10.felder.every(f => f.length <= 80) && !/\/\* \? \*\//.test(require('fs').readFileSync(require('path').join(ROOT, 'bingo-data.js'), 'utf-8')));
  t.check('Es hat genau 49 Felder (7 × 7, kein Freifeld), alle verschieden und nicht leer; die Prüfung meldet nichts.', g10.felder.length === 49 && g10.felder.every(f => typeof f === 'string' && f.trim()) && new Set(g10.felder.map(f => f.trim().toLowerCase())).size === 49 && w.validateGames([g10]).length === 0, w.validateGames([g10]));
  t.check('Stichproben aus dem Screenshot: erstes Feld oben links, Mittelfeld (Position 24), letztes Feld unten rechts.', g10.felder[0] === 'Gesang in 6 Sprachen' && g10.felder[24] === 'Beyoncé auch vom Band' && g10.felder[48] === 'Künstler verteilen Alkohol' && g10.felder[6] === 'Weniger als eine Stunde Hauptact' && g10.felder[42] === 'Vinyl für Discogs erstellen');
  const card = w.createCard(g10, 1);
  t.check('Die Karte enthält alle 49 Felder in genau dieser Reihenfolge, nichts fehlt, kein Freifeld.', JSON.stringify(card.cells) === JSON.stringify(g10.felder) && !card.cells.includes(null));
  w.switchTab('spiele'); H.openGameById('konzerte-bingo-season-10');
  const cells = H.cells();
  t.check('In der App: 7 Spalten, 49 Felder in der Reihenfolge des Originals, Lupe automatisch sichtbar (7×7).', d.getElementById('board').style.getPropertyValue('--n') === '7' && cells.length === 49 && cells.every((c, p) => c.textContent === g10.felder[p]) && d.getElementById('lupe').style.display !== 'none');
  const first = w.eval('JSON.stringify(appState.cards["konzerte-bingo-season-10"].cells)');
  d.getElementById('btnNewCard').click();
  if (H.modalOpen('confirmModal')) d.getElementById('confirmYes').click();
  t.check('"Neue Karte" ergibt bei einer festen Karte dieselbe Anordnung, nur ohne Markierungen.', w.eval('JSON.stringify(appState.cards["konzerte-bingo-season-10"].cells)') === first && w.eval('appState.cards["konzerte-bingo-season-10"].marks.length') === 0);
  H.click(H.cell(0)); H.click(H.cell(24));
  t.check('Markieren funktioniert; das Mittelfeld ist ein normales, antippbares Feld.', H.cell(24).classList.contains('marked') && !H.cell(24).classList.contains('free') && w.eval('appState.cards["konzerte-bingo-season-10"].marks').join() === '0,24');
  // Eine ganze Reihe ergibt Bingo (Linie)
  for (let p = 1; p < 7; p++) H.click(H.cell(p));
  t.check('Eine volle Reihe (7 Felder) gewinnt (Ziel: Linie).', d.getElementById('boardBanner').style.display !== 'none' && /Bingo! 1 Reihe/.test(d.getElementById('boardBanner').textContent));
  t.check('Die Liste zeigt das Spiel mit Größe und Beschreibung.', (c => !!c && /7×7/.test(c.textContent) && /feste Karte/.test(c.textContent))((w.switchTab('spiele'), d.querySelector('.game-card[data-id="konzerte-bingo-season-10"]'))));
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0, errors);
  t.finish();
})();
