// ── js/03-spiel.js ── Spiellogik: Karten erzeugen, markieren, abhaken, Bingo erkennen ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('03-spiel');

function newSeed() { return Math.floor(Math.random() * 2147483647); }

// Erzeugt eine Karte: Felder zufällig (aber mit Seed nachvollziehbar) auswählen und anordnen.
// Kombi-Felder werden als Zelle { t, p, ab } kopiert; ihre Häkchen stehen in card.checks[Position].
function createCard(game, seed) {
  const total = game.groesse * game.groesse;
  const free = freePositions(game);
  const idx = game.felder.map((_, i) => i);
  // fest: true = die Karte folgt der Reihenfolge der Felder im Spiel (bei mehr Feldern als Plätzen: die ersten); sonst zufällig gemischt
  const pool = (game.fest ? idx : shuffleSeeded(idx, seed)).slice(0, felderBenoetigt(game));
  const cells = [];
  let k = 0;
  for (let p = 0; p < total; p++) {
    if (free.includes(p)) { cells.push(null); continue; }
    const f = game.felder[pool[k++]];
    cells.push(isCounterEntry(f) ? counterCell(f) : isComboEntry(f) ? comboCell(f) : f);
  }
  return { seed: seed, cells: cells, marks: [], checks: {}, eigene: {}, details: {}, counts: {}, stand: {} };
}

// Zelle aus einem Zählfeld der Daten: ab = Schwellwert, u = Einheit (optional, z. B. "Tage"). Der Zählerstand steht in card.stand[Position].
function counterCell(f) {
  const cell = { t: f.text, ab: f.ab, z: true };
  if (typeof f.einheit === 'string' && f.einheit.trim()) cell.u = f.einheit.trim().slice(0, MAX_EINHEIT);
  return cell;
}
// Aktueller Zählerstand eines Zählfelds (0 = noch nicht gezählt).
function zahlOf(card, p) { return (card.stand && card.stand[p]) || 0; }
// Zählerstand mit Einheit als Text: "7 Tage" (ohne Einheit nur "7").
function zahlText(c, k) { return k + (c && c.u ? ' ' + c.u : ''); }

// Zelle aus einem Kombi-Feld der Daten: e = eigene Einträge erlaubt, h = Platzhalter für das Eingabefeld.
function comboCell(f) {
  const cell = { t: f.text, p: f.punkte.slice(), ab: f.ab };
  if (f.eigene === true) {
    cell.e = true;
    if (typeof f.eigeneHinweis === 'string' && f.eigeneHinweis.trim()) cell.h = f.eigeneHinweis.trim().slice(0, MAX_EIGENE_LEN);
  }
  return cell;
}
const normEintrag = s => String(s).trim().toLowerCase();
function eigeneList(card, p) { return (card.eigene && card.eigene[p]) || []; }
// Eigene Einträge, die zählen: nicht leer, nicht doppelt und nicht gleich einem festen Punkt.
function eigeneCount(card, p) {
  const seen = new Set(card.cells[p].p.map(normEintrag));
  let n = 0;
  eigeneList(card, p).forEach(x => { const k = normEintrag(x); if (k && !seen.has(k)) { seen.add(k); n++; } });
  return n;
}
// Die eigenen Einträge, die zählen (in der Reihenfolge der Eingabe), als Texte - für die Anzeige im Dialog „Datum & Info“.
function eigeneZaehlende(card, p) {
  const seen = new Set(card.cells[p].p.map(normEintrag));
  const out = [];
  eigeneList(card, p).forEach(x => { const k = normEintrag(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } });
  return out;
}
// Anzahl gezählter Punkte eines Kombi-Feldes: abgehakte feste Punkte plus eigene Einträge.
function comboCount(card, p) {
  const fixed = ((card.checks && card.checks[p]) || []).length;
  const c = card.cells[p];
  return fixed + (isComboEntry(c) && c.e ? eigeneCount(card, p) : 0);
}
// Ein Feld zählt als markiert: Freifeld immer, Textfeld nach Tipp, Kombi-Feld ab der geforderten Zahl Häkchen,
// Zählfeld ab dem Schwellwert.
function isMarked(card, p) {
  const c = card.cells[p];
  if (c === null) return true;
  if (isCounterCell(c)) return zahlOf(card, p) >= c.ab;
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
  return card.marks.length + card.cells.filter((c, p) => isSpecialEntry(c) && isMarked(card, p)).length;
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

// Datum und Info eines Felds (oder null).
function detailsOf(card, p) { return (card.details && card.details[p]) || null; }
// Zählerstand eines Textfelds: 0 = nicht markiert, 1 = einmal (Antippen), mehr = Zähler. Kombi-Felder haben keinen Zähler (0).
// Ist der Zähler in den Settings eingeschaltet? (Aus = Zählerstände werden nicht angezeigt und nicht verändert.)
function zaehlerAn() { return appState.settings.zaehler !== false; }
function countOf(card, p) {
  if (typeof card.cells[p] !== 'string' || !card.marks.includes(p)) return 0;
  return (card.counts && card.counts[p]) || 1;
}
function hasInfo(card, p) { const d = detailsOf(card, p); return !!(d && d.i); }

// Führt eine Änderung an Feld p aus und meldet, ob dadurch gerade ein Gewinn entstanden ist.
// Wird das Feld dabei erstmals "geschafft", trägt die App das heutige Datum ein (Einstellung autoDatum),
// sofern noch kein Datum gesetzt ist.
function applyChange(game, card, mutate, p) {
  const before = isWon(game, card), wasMarked = isMarked(card, p);
  mutate();
  const after = isWon(game, card);
  if (!wasMarked && isMarked(card, p) && appState.settings.autoDatum) {
    const cur = detailsOf(card, p);
    if (!cur || !cur.d) {
      card.details = card.details || {};
      card.details[p] = Object.assign({ d: todayStr() }, cur && cur.i ? { i: cur.i } : {});
    }
  }
  saveToStorage();
  return { changed: true, won: after, justWon: after && !before };
}

// Textfeld an- oder abwählen. Rückgabe: { changed, won, justWon }.
function toggleMark(id, p) {
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || card.cells[p] === null || isSpecialEntry(card.cells[p])) {
    return { changed: false, won: false, justWon: false };
  }
  return applyChange(game, card, () => {
    const i = card.marks.indexOf(p);
    if (i >= 0) { card.marks.splice(i, 1); if (card.counts) delete card.counts[p]; } else { card.marks.push(p); card.marks.sort((a, b) => a - b); }
  }, p);
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
  }, p);
}

// Eigene Einträge (Freitext) eines Kombi-Feldes setzen: values ist die komplette Liste der Eingabefelder.
// Leere Einträge fallen weg, Texte werden gekürzt, höchstens MAX_EIGENE bleiben.
function setEigene(id, p, values) {
  const none = { changed: false, won: false, justWon: false };
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || !isComboEntry(card.cells[p]) || !card.cells[p].e || !Array.isArray(values)) return none;
  const next = values.filter(v => typeof v === 'string').map(v => v.trim().slice(0, MAX_EIGENE_LEN).trim()).filter(Boolean).slice(0, MAX_EIGENE);
  if (JSON.stringify(next) === JSON.stringify(eigeneList(card, p))) return none;
  return applyChange(game, card, () => {
    card.eigene = card.eigene || {};
    if (next.length) card.eigene[p] = next; else delete card.eigene[p];
  }, p);
}

// Datum und/oder Info eines Felds setzen. patch = { d: 'JJJJ-MM-TT' } und/oder { i: 'Text' }; nur die
// übergebenen Schlüssel ändern sich, leere oder ungültige Werte entfernen den jeweiligen Teil.
function setDetail(id, p, patch) {
  const none = { changed: false };
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || card.cells[p] === null || !patch || typeof patch !== 'object') return none;
  const cur = detailsOf(card, p) || {};
  let d = cur.d, i = cur.i;
  if ('d' in patch) d = typeof patch.d === 'string' && isValidDate(patch.d) ? patch.d : undefined;
  if ('i' in patch) i = (typeof patch.i === 'string' ? patch.i.trim().slice(0, MAX_INFO).trim() : '') || undefined;
  if (d === cur.d && i === cur.i) return none;
  card.details = card.details || {};
  if (d || i) card.details[p] = Object.assign({}, d ? { d: d } : {}, i ? { i: i } : {}); else delete card.details[p];
  saveToStorage();
  return { changed: true };
}

// Zähler eines Textfelds setzen (1 bis MAX_COUNT): wie oft das Feld "geschafft" wurde. Das Antippen des Felds entspricht 1.
// Auf einem noch nicht markierten Feld markiert das Feld (und trägt ggf. das Datum ein). Kombi-Felder haben keinen Zähler.
function setCount(id, p, n) {
  const none = { changed: false, won: false, justWon: false };
  const game = gameById(id);
  const card = appState.cards[id];
  if (!zaehlerAn() || !game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || typeof card.cells[p] !== 'string' || !Number.isInteger(n) || n < 1 || n > MAX_COUNT) return none;
  if (countOf(card, p) === n) return none;
  return applyChange(game, card, () => {
    if (!card.marks.includes(p)) { card.marks.push(p); card.marks.sort((a, b) => a - b); }
    card.counts = card.counts || {};
    if (n > 1) card.counts[p] = n; else delete card.counts[p];
  }, p);
}

// Zählerstand eines Zählfelds setzen (0 bis MAX_ZAHL; 0 = zurück auf nicht gezählt). Das Feld gilt ab dem Schwellwert des Felds als geschafft;
// beim ersten Erreichen trägt die App das Datum ein (siehe applyChange), nimmt man den Stand wieder unter den Schwellwert, fällt das Feld zurück.
function setZahl(id, p, n) {
  const none = { changed: false, won: false, justWon: false };
  const game = gameById(id);
  const card = appState.cards[id];
  if (!game || !card || !Number.isInteger(p) || p < 0 || p >= card.cells.length || !isCounterCell(card.cells[p]) || !Number.isInteger(n) || n < 0 || n > MAX_ZAHL) return none;
  if (zahlOf(card, p) === n) return none;
  return applyChange(game, card, () => {
    card.stand = card.stand || {};
    if (n > 0) card.stand[p] = n; else delete card.stand[p];
  }, p);
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
  card.eigene = {};
  card.details = {};
  card.counts = {};
  card.stand = {};
  saveToStorage();
}
function resetAllCards() {
  appState.cards = {};
  appState.activeGame = '';
  saveToStorage();
}
