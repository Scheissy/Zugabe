// ── js/03-spiel.js ── Spiellogik: Karten erzeugen, markieren, Bingo erkennen ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('03-spiel');

function newSeed() { return Math.floor(Math.random() * 2147483647); }

// Erzeugt eine Karte: Felder zufällig (aber mit Seed nachvollziehbar) auswählen und anordnen.
function createCard(game, seed) {
  const total = game.groesse * game.groesse;
  const free = freePositions(game);
  const pool = shuffleSeeded(game.felder.map((_, i) => i), seed).slice(0, felderBenoetigt(game));
  const cells = [];
  let k = 0;
  for (let p = 0; p < total; p++) cells.push(free.includes(p) ? null : game.felder[pool[k++]]);
  return { seed: seed, cells: cells, marks: [] };
}

function isMarked(card, p) { return card.cells[p] === null || card.marks.includes(p); }

// Alle Reihen, Spalten und die zwei Diagonalen als Listen von Positionen.
function linesFor(n) {
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
  lines.push(Array.from({ length: n }, (_, i) => i * n + i));
  lines.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
  return lines;
}
function winningLines(card, n) { return linesFor(n).filter(line => line.every(p => isMarked(card, p))); }
function isComplete(card) { return card.cells.every((_, p) => isMarked(card, p)); }
function isWon(game, card) {
  return game.ziel === 'vollbild' ? isComplete(card) : winningLines(card, game.groesse).length > 0;
}
// Markierte echte Felder (ohne Freifeld) und alle echten Felder der Karte.
function markedCount(card) { return card.marks.length; }
function fieldCount(card) { return card.cells.filter(c => c !== null).length; }

function ensureCard(id) {
  const game = gameById(id);
  if (!game) return null;
  if (!appState.cards[id]) { appState.cards[id] = createCard(game, newSeed()); saveToStorage(); }
  return appState.cards[id];
}

// Spiel öffnen: Karte anlegen, falls noch keine da ist.
function startGame(id) {
  if (!ensureCard(id)) return false;
  appState.activeGame = id;
  saveToStorage();
  return true;
}

// Feld an- oder abwählen. Rückgabe: { changed, won, justWon }.
function toggleMark(id, p) {
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || card.cells[p] === null) {
    return { changed: false, won: false, justWon: false };
  }
  const before = isWon(game, card);
  const i = card.marks.indexOf(p);
  if (i >= 0) card.marks.splice(i, 1); else { card.marks.push(p); card.marks.sort((a, b) => a - b); }
  const after = isWon(game, card);
  saveToStorage();
  return { changed: true, won: after, justWon: after && !before };
}

function newCardFor(id) {
  const game = gameById(id);
  if (!game) return null;
  const old = appState.cards[id];
  let seed = newSeed();
  if (old && seed === old.seed) seed++;
  appState.cards[id] = createCard(game, seed);
  saveToStorage();
  return appState.cards[id];
}
function resetMarks(id) {
  const card = appState.cards[id];
  if (!card) return;
  card.marks = [];
  saveToStorage();
}
function resetAllCards() {
  appState.cards = {};
  appState.activeGame = '';
  saveToStorage();
}
