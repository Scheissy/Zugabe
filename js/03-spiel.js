// ── js/03-spiel.js ── Spiellogik: Karten erzeugen, markieren, abhaken, Bingo erkennen ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('03-spiel');

function newSeed() { return Math.floor(Math.random() * 2147483647); }

// Erzeugt eine Karte: Felder zufällig (aber mit Seed nachvollziehbar) auswählen und anordnen.
// Kombi-Felder werden als Zelle { t, p, ab } kopiert; ihre Häkchen stehen in card.checks[Position].
function createCard(game, seed) {
  const total = game.groesse * game.groesse;
  const free = freePositions(game);
  const pool = shuffleSeeded(game.felder.map((_, i) => i), seed).slice(0, felderBenoetigt(game));
  const cells = [];
  let k = 0;
  for (let p = 0; p < total; p++) {
    if (free.includes(p)) { cells.push(null); continue; }
    const f = game.felder[pool[k++]];
    cells.push(isComboEntry(f) ? { t: f.text, p: f.punkte.slice(), ab: f.ab } : f);
  }
  return { seed: seed, cells: cells, marks: [], checks: {} };
}

// Anzahl abgehakter Punkte eines Kombi-Feldes.
function comboCount(card, p) { return ((card.checks && card.checks[p]) || []).length; }
// Ein Feld zählt als markiert: Freifeld immer, Textfeld nach Tipp, Kombi-Feld ab der geforderten Zahl Häkchen.
function isMarked(card, p) {
  const c = card.cells[p];
  if (c === null) return true;
  if (isComboEntry(c)) return comboCount(card, p) >= c.ab;
  return card.marks.includes(p);
}

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
// Erledigte Felder (ohne Freifeld; ein Kombi-Feld zählt, wenn es seine Häkchen hat) und alle echten Felder der Karte.
function markedCount(card) {
  return card.marks.length + card.cells.filter((c, p) => isComboEntry(c) && isMarked(card, p)).length;
}
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

// Führt eine Änderung an der Karte aus und meldet, ob dadurch gerade ein Gewinn entstanden ist.
function applyChange(game, card, mutate) {
  const before = isWon(game, card);
  mutate();
  const after = isWon(game, card);
  saveToStorage();
  return { changed: true, won: after, justWon: after && !before };
}

// Textfeld an- oder abwählen. Rückgabe: { changed, won, justWon }.
function toggleMark(id, p) {
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || card.cells[p] === null || isComboEntry(card.cells[p])) {
    return { changed: false, won: false, justWon: false };
  }
  return applyChange(game, card, () => {
    const i = card.marks.indexOf(p);
    if (i >= 0) card.marks.splice(i, 1); else { card.marks.push(p); card.marks.sort((a, b) => a - b); }
  });
}

// Einen Punkt eines Kombi-Feldes abhaken (value true/false) oder umschalten (value weglassen).
// Das Feld selbst zählt als markiert, sobald genug Punkte abgehakt sind (siehe isMarked).
function toggleCheck(id, p, i, value) {
  const none = { changed: false, won: false, justWon: false };
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || !Number.isInteger(i) || !isComboEntry(card.cells[p]) || i < 0 || i >= card.cells[p].p.length) return none;
  const list = card.checks[p] || [];
  const has = list.includes(i);
  const want = value === undefined ? !has : !!value;
  if (want === has) return none;
  return applyChange(game, card, () => {
    const next = want ? [...list, i].sort((a, b) => a - b) : list.filter(x => x !== i);
    if (next.length) card.checks[p] = next; else delete card.checks[p];
  });
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
  card.checks = {};
  saveToStorage();
}
function resetAllCards() {
  appState.cards = {};
  appState.activeGame = '';
  saveToStorage();
}
