const { loadApp, createChecker } = require('./test-helpers');

// Datenvertrag der mitgelieferten Spiele (bingo-data.js): alles spielbar, keine Fehler, jede Spielart abgedeckt.
(async () => {
  const t = createChecker();
  const { window: w, document: d } = await loadApp({ trackErrors: true });
  const games = w.eval('allGames');
  const issues = w.validateGames(games);
  t.check('Die mitgelieferten Spiele haben weder Fehler noch Hinweise.', issues.length === 0, issues);
  t.check('Es gibt mehrere Spiele.', games.length >= 3, games.length);
  t.check('Alle ids sind eindeutig und nur a-z/0-9/-.', new Set(games.map(g => g.id)).size === games.length && games.every(g => /^[a-z0-9-]+$/.test(g.id)));
  t.check('Mehrere Kartengrößen kommen vor (3, 4 und 5).', [3, 4, 5].every(n => games.some(g => g.groesse === n)));
  t.check('Beide Spielziele kommen vor (Linie und Vollbild).', games.some(g => g.ziel === 'linie') && games.some(g => g.ziel === 'vollbild'));
  t.check('Spiele mit und ohne Freifeld kommen vor.', games.some(g => w.freePositions(g).length) && games.some(g => !w.freePositions(g).length));
  t.check('Mindestens ein Spiel hat mehr Felder als auf die Karte passen (Zufallsauswahl), mindestens eines genau so viele (alle Felder kommen vor).',
    games.some(g => g.felder.length > w.felderBenoetigt(g)) && games.some(g => g.felder.length === w.felderBenoetigt(g)));
  t.check('Die Spieleliste zeigt jedes Spiel genau einmal.', d.querySelectorAll('.game-card').length === games.length);
  t.finish();
})();
