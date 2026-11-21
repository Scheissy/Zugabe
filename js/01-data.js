// ── js/01-data.js ── Konstanten, Zufall, Spiel-Prüfung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('01-data');

const LS_KEY = 'zugabe-v1';
const GROESSEN = [3, 4, 5];
const ZIELE = ['linie', 'vollbild'];
const MAX_FELD_LEN = 80;

// Maskiert Text für innerHTML. Alles, was aus Daten oder Speicherstand kommt, läuft hier durch.
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Kleiner, deterministischer Zufallsgenerator (gleicher Seed = gleiche Folge).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, seed) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Freifelder eines Spiels (Positionen auf der Karte, zeilenweise von 0 an).
// Nur das mittlere Feld, und nur bei ungerader Größe.
function freePositions(game) {
  return (game.freiMitte && game.groesse % 2 === 1) ? [(game.groesse * game.groesse - 1) / 2] : [];
}
// Wie viele Felder aus der Liste auf eine Karte kommen.
function felderBenoetigt(game) {
  return game.groesse * game.groesse - freePositions(game).length;
}

// Prüft alle Spiele. Rückgabe: Liste von { id, level: 'fehler' | 'hinweis', text }.
// Spiele mit mindestens einem 'fehler' sind nicht spielbar (siehe playableGames).
function validateGames(list) {
  const issues = [];
  const seen = new Set();
  const add = (id, level, text) => issues.push({ id: id, level: level, text: text });
  (list || []).forEach((g, i) => {
    const id = g && typeof g.id === 'string' ? g.id : '#' + (i + 1);
    if (!g || typeof g !== 'object') { add(id, 'fehler', 'Eintrag ist kein Objekt'); return; }
    if (typeof g.id !== 'string' || !/^[a-z0-9-]+$/.test(g.id)) add(id, 'fehler', 'id fehlt oder enthält andere Zeichen als a-z, 0-9, "-"');
    else if (seen.has(g.id)) add(id, 'fehler', 'id kommt mehrfach vor');
    else seen.add(g.id);
    if (typeof g.titel !== 'string' || !g.titel.trim()) add(id, 'fehler', 'titel fehlt');
    if (!GROESSEN.includes(g.groesse)) add(id, 'fehler', 'groesse muss 3, 4 oder 5 sein');
    if (!ZIELE.includes(g.ziel)) add(id, 'fehler', "ziel muss 'linie' oder 'vollbild' sein");
    if (!Array.isArray(g.felder) || g.felder.some(f => typeof f !== 'string' || !f.trim())) {
      add(id, 'fehler', 'felder muss eine Liste nicht-leerer Texte sein');
      return;
    }
    const norm = g.felder.map(f => f.trim().toLowerCase());
    const dups = norm.filter((f, k) => norm.indexOf(f) !== k);
    if (dups.length) add(id, 'fehler', 'doppelte Felder: ' + [...new Set(dups)].join(', '));
    if (g.felder.some(f => f.length > MAX_FELD_LEN)) add(id, 'hinweis', 'Feldtext länger als ' + MAX_FELD_LEN + ' Zeichen (wird gekürzt gespeichert)');
    if (GROESSEN.includes(g.groesse)) {
      const need = felderBenoetigt(g);
      if (g.felder.length < need) add(id, 'fehler', 'zu wenige Felder: ' + g.felder.length + ' vorhanden, ' + need + ' nötig');
      if (g.freiMitte && g.groesse % 2 === 0) add(id, 'hinweis', 'freiMitte wirkt nur bei ungerader Größe');
    }
  });
  return issues;
}

const allGames = typeof BINGO_GAMES !== 'undefined' ? BINGO_GAMES : [];
let lastValidationIssues = [];
function playableGames() {
  lastValidationIssues = validateGames(allGames);
  const broken = new Set(lastValidationIssues.filter(i => i.level === 'fehler').map(i => i.id));
  return allGames.filter((g, i) => g && !broken.has(typeof g.id === 'string' ? g.id : '#' + (i + 1)));
}
function gameById(id) {
  return playableGames().find(g => g.id === id) || null;
}
