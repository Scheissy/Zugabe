const { loadApp, createChecker } = require('./test-helpers');

// validateGames(): je ein Negativ- und Positivfall pro Regel; Spiele mit Fehlern sind nicht spielbar.
(async () => {
  const t = createChecker();
  const { window: w } = await loadApp();
  const felder = n => Array.from({ length: n }, (_, i) => 'Feld ' + (i + 1));
  const ok = (over = {}) => ({ id: 'x', titel: 'X', groesse: 3, freiMitte: true, ziel: 'linie', felder: felder(8), ...over });
  const lvl = (g, text) => w.validateGames([g]).filter(i => i.text.includes(text));

  t.check('Gültiges Spiel: keine Befunde.', w.validateGames([ok()]).length === 0);
  t.check('id mit Großbuchstaben/Leerzeichen -> Fehler.', lvl(ok({ id: 'Mein Spiel' }), 'id').length === 1 && lvl(ok({ id: 'Mein Spiel' }), 'id')[0].level === 'fehler');
  t.check('id fehlt -> Fehler.', lvl(ok({ id: undefined }), 'id').length === 1);
  t.check('Doppelte id -> Fehler beim zweiten Spiel.', w.validateGames([ok(), ok()]).some(i => i.text.includes('mehrfach')));
  t.check('titel leer -> Fehler.', lvl(ok({ titel: '  ' }), 'titel').length === 1);
  t.check('groesse 6 -> Fehler; 3/4/5 -> in Ordnung.', lvl(ok({ groesse: 6 }), 'groesse').length === 1 && [3, 4, 5].every(n => lvl(ok({ groesse: n, felder: felder(30) }), 'groesse').length === 0));
  t.check("ziel 'diagonale' -> Fehler.", lvl(ok({ ziel: 'diagonale' }), 'ziel').length === 1);
  t.check('felder keine Liste -> Fehler.', lvl(ok({ felder: 'abc' }), 'felder').length === 1);
  t.check('Leeres Feld in der Liste -> Fehler.', lvl(ok({ felder: [...felder(8), ' '] }), 'felder').length === 1);
  t.check('Doppelte Felder (auch Groß/Klein, Leerzeichen) -> Fehler mit dem Text.', lvl(ok({ felder: [...felder(8), ' FELD 1 '] }), 'doppelte').length === 1);
  t.check('3×3 mit Freifeld: 8 Felder reichen, 7 nicht.', lvl(ok({ felder: felder(8) }), 'zu wenige').length === 0 && lvl(ok({ felder: felder(7) }), 'zu wenige').length === 1);
  t.check('3×3 ohne Freifeld: 9 Felder nötig.', lvl(ok({ freiMitte: false, felder: felder(8) }), 'zu wenige').length === 1 && lvl(ok({ freiMitte: false, felder: felder(9) }), 'zu wenige').length === 0);
  t.check('4×4 mit freiMitte: Freifeld wirkt nicht (16 nötig) -> Hinweis, kein Fehler.',
    lvl(ok({ groesse: 4, felder: felder(16) }), 'freiMitte').length === 1 && lvl(ok({ groesse: 4, felder: felder(16) }), 'freiMitte')[0].level === 'hinweis' && lvl(ok({ groesse: 4, felder: felder(15) }), 'zu wenige').length === 1);
  t.check('Zu langer Feldtext -> nur Hinweis.', lvl(ok({ felder: [...felder(8), 'x'.repeat(81)] }), 'länger')[0].level === 'hinweis');
  t.check('Eintrag, der kein Objekt ist, wirft nicht, sondern wird gemeldet.', w.validateGames([null, 42]).length === 2);

  // Spielbarkeit: Spiele mit Fehlern fehlen in der Liste, Hinweise nicht
  const bad = await loadApp({ dataScript: `const BINGO_GAMES = [
    { id: 'gut', titel: 'Gut', groesse: 3, freiMitte: true, ziel: 'linie', felder: ${JSON.stringify(felder(8))} },
    { id: 'kaputt', titel: 'Kaputt', groesse: 5, freiMitte: true, ziel: 'linie', felder: ['a','b'] },
    { id: 'hinweis', titel: 'Hinweis', groesse: 4, freiMitte: true, ziel: 'linie', felder: ${JSON.stringify(felder(16))} }
  ]; const BINGO_DATA_VERSION = 1;` });
  const ids = [...bad.document.querySelectorAll('.game-card')].map(c => c.dataset.id);
  t.check('Spieleliste zeigt nur spielbare Spiele (Fehler ausgeschlossen, Hinweis erlaubt).', JSON.stringify(ids) === JSON.stringify(['gut', 'hinweis']), ids);
  const panel = bad.document.getElementById('validationPanel');
  t.check('Datenqualität-Panel in den Settings nennt Fehler und Hinweis mit Spiel-id.', !!panel.querySelector('.val-fehler') && !!panel.querySelector('.val-hinweis') && panel.textContent.includes('kaputt'), panel.textContent);
  const good = await loadApp();
  t.check('Ohne Befunde zeigt das Panel eine Entwarnung.', !!good.document.querySelector('#validationPanel .val-ok'));
  const none = await loadApp({ dataScript: 'const BINGO_GAMES = []; const BINGO_DATA_VERSION = 1;' });
  t.check('Ohne spielbare Spiele erscheint ein Hinweis statt einer leeren Liste.', /Keine spielbaren Spiele/.test(none.document.getElementById('gameList').textContent));
  t.finish();
})();
