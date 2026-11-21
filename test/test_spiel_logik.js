const { loadApp, createChecker } = require('./test-helpers');

// Spiellogik (js/03-spiel.js): Karten erzeugen, Freifeld, Linien, Gewinn, Markieren.
(async () => {
  const t = createChecker();
  const { window: w } = await loadApp();
  const g = id => w.eval('allGames').find(x => x.id === id);
  const bahn = g('festival'), walk = g('klubnacht'), vollbild = g('marathon');

  // Karte erzeugen
  const c1 = w.createCard(bahn, 42), c2 = w.createCard(bahn, 42), c3 = w.createCard(bahn, 43);
  t.check('Gleicher Seed ergibt dieselbe Karte, anderer Seed eine andere.', JSON.stringify(c1.cells) === JSON.stringify(c2.cells) && JSON.stringify(c1.cells) !== JSON.stringify(c3.cells));
  t.check('5×5 mit Freifeld: 25 Zellen, Mitte (Position 12) ist null, sonst Text.', c1.cells.length === 25 && c1.cells[12] === null && c1.cells.filter(c => c === null).length === 1);
  const cellTxt = c => typeof c === 'string' ? c : c.t;
  const felderTxt = fl => fl.map(f => typeof f === 'string' ? f : f.text);
  t.check('Kein Feld kommt auf einer Karte doppelt vor; alle stammen aus der Feldliste.',
    new Set(c1.cells.filter(Boolean).map(cellTxt)).size === 24 && c1.cells.filter(Boolean).every(c => felderTxt(bahn.felder).includes(cellTxt(c))));
  const v = w.createCard(vollbild, 7);
  t.check('4×4 ohne Freifeld: 16 Felder, alle Felder des Spiels kommen genau einmal vor.', v.cells.length === 16 && !v.cells.includes(null) && v.cells.map(cellTxt).sort().join('|') === felderTxt(vollbild.felder).sort().join('|'));
  t.check('3×3: Freifeld in der Mitte (Position 4).', w.createCard(walk, 1).cells[4] === null);
  t.check('Neue Karte startet ohne Markierungen.', c1.marks.length === 0);
  let differs = false; for (let s = 1; s < 20; s++) if (w.createCard(vollbild, s).cells.join() !== v.cells.join()) differs = true;
  t.check('Bei gleichen Feldern ändert sich über den Seed die Anordnung.', differs);

  // Linien
  const l3 = w.linesFor(3), l5 = w.linesFor(5);
  t.check('linesFor: 3×3 hat 8, 5×5 hat 12 Linien, jede mit n Positionen.', l3.length === 8 && l5.length === 12 && l5.every(l => l.length === 5));
  t.check('Diagonalen sind richtig (3×3: 0-4-8 und 2-4-6).', JSON.stringify(l3[6]) === '[0,4,8]' && JSON.stringify(l3[7]) === '[2,4,6]');
  t.check('Reihe und Spalte sind richtig (3×3: 3-4-5 und 1-4-7).', JSON.stringify(l3[1]) === '[3,4,5]' && JSON.stringify(l3[4]) === '[1,4,7]');

  // Gewinn Linie (3×3, Freifeld in der Mitte zählt immer als markiert)
  const card = w.createCard(walk, 5);
  t.check('Ohne Markierung kein Gewinn, Freifeld zählt als markiert.', !w.isWon(walk, card) && w.isMarked(card, 4) && !w.isMarked(card, 0));
  card.marks = [0, 8];
  t.check('Diagonale 0-4-8 mit Freifeld: Gewinn mit nur zwei Markierungen.', w.isWon(walk, card) && w.winningLines(card, 3).length === 1);
  card.marks = [0, 1];
  t.check('Zwei Felder in einer Reihe ohne dritte: kein Gewinn.', !w.isWon(walk, card));
  card.marks = [0, 2, 6, 8];
  t.check('Mehrere Linien gleichzeitig werden gezählt (alle vier Diagonalen/Mitte: 2 Diagonalen).', w.winningLines(card, 3).length === 2);

  // Vollbild
  const vc = w.createCard(vollbild, 3);
  vc.marks = Array.from({ length: 15 }, (_, i) => i);
  t.check('Vollbild: 15 von 16 Feldern reichen nicht, auch wenn eine Reihe voll ist.', !w.isWon(vollbild, vc) && w.winningLines(vc, 4).length > 0);
  vc.marks.push(15);
  t.check('Vollbild: alle 16 markiert -> Gewinn.', w.isWon(vollbild, vc));

  // Zustand: Spiel starten, markieren
  w.localStorage.clear();
  t.check('startGame legt Karte an und setzt das aktive Spiel.', w.startGame('klubnacht') && !!w.eval('appState.cards.klubnacht') && w.eval('appState.activeGame') === 'klubnacht');
  t.check('startGame mit unbekannter id tut nichts.', w.startGame('gibts-nicht') === false && w.eval('appState.activeGame') === 'klubnacht');
  const first = JSON.stringify(w.eval('appState.cards.klubnacht'));
  w.startGame('klubnacht');
  t.check('Erneutes Öffnen behält die laufende Karte.', JSON.stringify(w.eval('appState.cards.klubnacht')) === first);
  let r = w.toggleMark('klubnacht', 0);
  t.check('toggleMark markiert ein Feld (changed, noch kein Gewinn).', r.changed && !r.won && !r.justWon && w.eval('appState.cards.klubnacht.marks').includes(0));
  w.toggleMark('klubnacht', 8); // 0-4-8 voll
  r = w.toggleMark('klubnacht', 2);
  const r2 = w.toggleMark('klubnacht', 2);
  t.check('toggleMark erneut hebt die Markierung wieder auf.', r2.changed && !w.eval('appState.cards.klubnacht.marks').includes(2));
  w.toggleMark('klubnacht', 8);
  r = w.toggleMark('klubnacht', 8);
  t.check('justWon ist nur beim Übergang zum Gewinn wahr (nicht bei weiteren Markierungen).', r.justWon === true && w.toggleMark('klubnacht', 1).justWon === false);
  t.check('Freifeld lässt sich nicht umschalten.', w.toggleMark('klubnacht', 4).changed === false);
  t.check('Ungültige Positionen und unbekannte Spiele werden ignoriert.', !w.toggleMark('klubnacht', 99).changed && !w.toggleMark('klubnacht', -1).changed && !w.toggleMark('klubnacht', 1.5).changed && !w.toggleMark('nix', 0).changed);
  t.check('Marks bleiben sortiert und ohne Doppelte.', (m => JSON.stringify(m) === JSON.stringify([...new Set(m)].sort((a, b) => a - b)))(w.eval('appState.cards.klubnacht.marks')));
  const oldSeed = w.eval('appState.cards.klubnacht.seed');
  w.newCardFor('klubnacht');
  t.check('newCardFor: neue Karte mit anderem Seed, Markierungen leer.', w.eval('appState.cards.klubnacht.seed') !== oldSeed && w.eval('appState.cards.klubnacht.marks.length') === 0);
  w.toggleMark('klubnacht', 0); w.resetMarks('klubnacht');
  t.check('resetMarks löscht nur die Markierungen, die Karte bleibt.', w.eval('appState.cards.klubnacht.marks.length') === 0 && w.eval('appState.cards.klubnacht.cells.length') === 9);
  w.resetAllCards();
  t.check('resetAllCards entfernt alle Karten und das aktive Spiel.', Object.keys(w.eval('appState.cards')).length === 0 && w.eval('appState.activeGame') === '');
  t.check('Zähler: markedCount/fieldCount ohne Freifeld.', (c => w.markedCount(c) === 0 && w.fieldCount(c) === 8)(w.createCard(walk, 1)));
  t.finish();
})();
