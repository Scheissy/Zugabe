// ── js/04-ansicht.js ── Tabs, Spieleliste, Karte, Modals, Toast ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('04-ansicht');

// ── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
// Tipp auf den abgedunkelten Hintergrund schließt; Tipp auf die Karte selbst nicht.
function modalBackdropClick(e) {
  const el = e.target;
  if (el && el.classList && el.classList.contains('modal-backdrop')) closeModal(el.id);
}

// Gemeinsamer Bestätigungsdialog: askConfirm(Titel, Text, Beschriftung, Aktion)
let pendingConfirm = null;
function askConfirm(title, text, yesLabel, action) {
  pendingConfirm = action;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = yesLabel;
  openModal('confirmModal');
}
function runConfirm() {
  const action = pendingConfirm;
  pendingConfirm = null;
  closeModal('confirmModal');
  if (action) action();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = ['spiele', 'spiel', 'settings'];
let currentTab = 'spiele';
function switchTab(name) {
  if (!TABS.includes(name)) return;
  currentTab = name;
  TABS.forEach(t => {
    document.getElementById('view-' + t).classList.toggle('hidden', t !== name);
    document.getElementById('nav-' + t).classList.toggle('active', t === name);
  });
  if (name === 'spiele') renderSpiele();
  if (name === 'spiel') renderBoard();
  if (name === 'settings') renderValidationPanel();
  updateTopbarSub();
}
function updateTopbarSub() {
  const game = gameById(appState.activeGame);
  document.getElementById('topbarSub').textContent =
    currentTab === 'spiel' && game ? game.titel : currentTab === 'settings' ? 'Einstellungen' : 'Bingo für Konzerte';
}

// ── SPIELELISTE ──────────────────────────────────────────────────────────────
function zielLabel(game) { return game.ziel === 'vollbild' ? 'Vollbild' : 'Linie'; }
function renderSpiele() {
  const games = playableGames();
  const el = document.getElementById('gameList');
  if (!games.length) {
    el.innerHTML = '<div class="board-empty"><p>Keine spielbaren Spiele gefunden. Unter Settings → Datenqualität steht, was in bingo-data.js nicht stimmt.</p></div>';
    return;
  }
  el.innerHTML = games.map(g => {
    const card = appState.cards[g.id];
    const won = card && isWon(g, card);
    const total = felderBenoetigt(g);
    const done = card ? markedCount(card) : 0;
    const progress = card && appState.settings.showCounter ? `${done}/${total}` : (card ? 'läuft' : 'neu');
    return `<button type="button" class="game-card${g.id === appState.activeGame ? ' active' : ''}" data-id="${esc(g.id)}" onclick="openGame('${esc(g.id)}')">
      <div class="game-card-top"><span class="game-card-title">${esc(g.titel)}</span>${won ? '<span class="game-badge">Bingo</span>' : ''}</div>
      ${g.beschreibung ? `<div class="game-card-desc">${esc(g.beschreibung)}</div>` : ''}
      <div class="game-card-meta">${g.groesse}×${g.groesse} · ${zielLabel(g)}${g.freiMitte && g.groesse % 2 ? ' · Freifeld' : ''} · ${progress}</div>
      ${card ? `<div class="game-bar"><div class="game-bar-fill" style="width:${Math.round(done / total * 100)}%"></div></div>` : ''}
    </button>`;
  }).join('');
}
function openGame(id) {
  if (!startGame(id)) return;
  switchTab('spiel');
}

// ── KARTE ────────────────────────────────────────────────────────────────────
function renderBoard() {
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  document.getElementById('boardEmpty').style.display = card ? 'none' : '';
  document.getElementById('boardContent').style.display = card ? '' : 'none';
  if (!card) return;
  const n = game.groesse;
  const win = new Set();
  if (game.ziel === 'linie') winningLines(card, n).forEach(line => line.forEach(p => win.add(p)));
  const won = isWon(game, card);
  document.getElementById('boardTitle').textContent = game.titel;
  document.getElementById('boardMeta').textContent = appState.settings.showCounter
    ? `${markedCount(card)} von ${fieldCount(card)} Feldern · ${zielLabel(game)}` : zielLabel(game);
  const banner = document.getElementById('boardBanner');
  banner.style.display = won ? '' : 'none';
  if (won) {
    const k = winningLines(card, n).length;
    banner.textContent = game.ziel === 'vollbild' ? 'Vollbild! Alle Felder sind markiert.' : `Bingo! ${k} ${k === 1 ? 'Reihe' : 'Reihen'} voll.`;
  }
  const board = document.getElementById('board');
  board.style.setProperty('--n', n);
  board.innerHTML = card.cells.map((text, p) => {
    if (text === null) return `<div class="cell n${n} free marked${win.has(p) ? ' win' : ''}" data-p="${p}">Frei</div>`;
    const m = card.marks.includes(p);
    return `<button type="button" class="cell n${n}${m ? ' marked' : ''}${win.has(p) ? ' win' : ''}" data-p="${p}" aria-pressed="${m}" onclick="onCell(${p})">${esc(text)}</button>`;
  }).join('');
}
function onCell(p) {
  const r = toggleMark(appState.activeGame, p);
  if (!r.changed) return;
  renderBoard();
  if (r.justWon) showToast('Bingo!');
}

function hasMarks() {
  const card = appState.cards[appState.activeGame];
  return !!card && card.marks.length > 0;
}
function askNewCard() {
  const id = appState.activeGame;
  const run = () => { newCardFor(id); renderBoard(); showToast('Neue Karte'); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Neue Karte?', 'Die aktuelle Karte mit ihren Markierungen wird ersetzt.', 'Neue Karte', run);
  else run();
}
function askResetMarks() {
  const id = appState.activeGame;
  const run = () => { resetMarks(id); renderBoard(); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Markierungen löschen?', 'Die Karte bleibt, alle Markierungen werden entfernt.', 'Löschen', run);
  else run();
}
