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
  lupePos = -1;
  resetZoom();
  switchTab('spiel');
}

// ── KARTE ────────────────────────────────────────────────────────────────────
function renderBoard() {
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  document.getElementById('boardEmpty').style.display = card ? 'none' : '';
  document.getElementById('boardContent').style.display = card ? '' : 'none';
  if (!card) { renderLupe(); return; }
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
  board.classList.toggle('big', n >= 7);
  board.innerHTML = card.cells.map((c, p) => {
    const w = win.has(p) ? ' win' : '';
    if (c === null) return `<div class="cell n${n} free marked${w}" data-p="${p}">Frei</div>`;
    if (isComboEntry(c)) {
      const k = comboCount(card, p);
      const lab = displayText(appState.settings.useKurz && kurzOf(game, c.t) || c.t);
      return `<button type="button" class="cell n${n} combo${lab !== displayText(c.t) ? ' kurz' : ''}${isMarked(card, p) ? ' marked' : ''}${w}${hasInfo(card, p) ? ' info' : ''}" data-p="${p}" aria-haspopup="dialog" aria-label="${esc(c.t)}, ${k} von ${c.ab} Häkchen" title="${esc(c.t)}" onclick="openCombo(${p})"><span class="cell-text">${esc(lab)}</span><span class="cell-progress">☑ ${k}/${c.ab}</span></button>`;
    }
    const m = card.marks.includes(p);
    const lab = displayText(appState.settings.useKurz && kurzOf(game, c) || c);
    const cnt = zaehlerAn() ? countOf(card, p) : 0;
    const ariaText = esc(c) + (cnt > 1 ? ', ' + cnt + ' mal' : '');
    const full = lab !== displayText(c) ? ` aria-label="${ariaText}" title="${esc(c)}"` : (cnt > 1 ? ` aria-label="${ariaText}"` : '');
    return `<button type="button" class="cell n${n}${lab !== displayText(c) ? ' kurz' : ''}${m ? ' marked' : ''}${w}${hasInfo(card, p) ? ' info' : ''}" data-p="${p}"${cnt > 1 ? ` data-n="${cnt}"` : ''}${full} aria-pressed="${m}" onclick="onCell(${p})">${esc(lab)}</button>`;
  }).join('');
  renderLupe();
  fitBoard();
}
function onCell(p) {
  const card = appState.cards[appState.activeGame];
  const n = card && zaehlerAn() ? countOf(card, p) : 0;
  if (n > 1) {   // Entmarkieren würde die Zählung löschen: vorher nachfragen
    lupePos = p;
    askConfirm('Markierung entfernen?', `Dieses Feld wurde ${n}× gezählt. Beim Entfernen der Markierung geht die Zählung verloren.`, 'Entfernen', () => toggleCell(p));
    renderLupe();
    return;
  }
  toggleCell(p);
}
function toggleCell(p) {
  lupePos = p;
  const r = toggleMark(appState.activeGame, p);
  if (!r.changed) { renderLupe(); return; }
  renderBoard();
  if (r.justWon) showToast('Bingo!');
}

// ── LUPE: ganzer Text des zuletzt angetippten Felds unter der Karte ───────────
let lupePos = -1;
function lupeActive(game) {
  const mode = appState.settings.lupe;
  if (mode === 'immer') return true;
  if (mode === 'aus') return false;
  return game.groesse >= 7 || Object.keys(game.kurz || {}).length > 0;
}
function renderLupe() {
  const el = document.getElementById('lupe');
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  const on = !!card && lupeActive(game);
  el.style.display = on ? '' : 'none';
  if (!on) return;
  const c = lupePos >= 0 ? card.cells[lupePos] : null;
  if (c === null || c === undefined) { el.innerHTML = '<small>Tippe ein Feld an, um den ganzen Text hier zu lesen. Lang drücken: Datum &amp; Info.</small>'; return; }
  const full = isComboEntry(c) ? c.t : c;
  const meta = isComboEntry(c) ? `☑ ${comboCount(card, lupePos)}/${c.ab}` : (card.marks.includes(lupePos) ? 'markiert' + (zaehlerAn() && countOf(card, lupePos) > 1 ? ' · ' + countOf(card, lupePos) + '×' : '') : 'nicht markiert');
  const det = detailsOf(card, lupePos);
  el.innerHTML = `<span class="lupe-text">${esc(full)}</span><small>${esc(meta)}</small>`
    + (det && det.d ? `<span class="lupe-detail">Datum: ${esc(formatDate(det.d))}</span>` : '')
    + (det && det.i ? `<span class="lupe-info">${esc(det.i)}</span>` : '')
    + `<button type="button" class="lupe-edit" onclick="openDetails(${lupePos})">${det ? 'Datum &amp; Info bearbeiten' : 'Datum &amp; Info ergänzen'}</button>`;
}

// ── KOMBI-FELDER: Checkliste im Dialog ───────────────────────────────────────
let comboPos = -1;
function currentCombo() {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[comboPos];
  return isComboEntry(c) ? { card: card, c: c } : null;
}
function openCombo(p) {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[p];
  if (!isComboEntry(c)) return;
  comboPos = p;
  lupePos = p;
  renderLupe();
  const checked = card.checks[p] || [];
  document.getElementById('comboTitle').textContent = c.t;
  document.getElementById('comboList').innerHTML = c.p.map((name, i) =>
    `<label class="combo-row"><input type="checkbox" data-i="${i}"${checked.includes(i) ? ' checked' : ''} onchange="onComboCheck(${i}, this.checked)"><span>${esc(name)}</span></label>`).join('');
  // Eigene Einträge: gespeicherte Texte, danach immer ein leeres Feld für den nächsten
  document.getElementById('comboOwn').style.display = c.e ? '' : 'none';
  document.getElementById('comboOwnList').innerHTML = '';
  if (c.e) { eigeneList(card, p).forEach(v => addOwnInput(v)); fillTrailingInput(); }
  updateComboProgress();
  openModal('comboModal');
}
function ownInputs() { return [...document.querySelectorAll('#comboOwnList .combo-own-input')]; }
function ownValues() { return ownInputs().map(i => i.value); }
function addOwnInput(value) {
  const cur = currentCombo();
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'combo-own-input';
  input.maxLength = MAX_EIGENE_LEN;
  input.placeholder = (cur && cur.c.h) || 'Weiteren Punkt eintragen';
  input.setAttribute('aria-label', input.placeholder);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('oninput', 'onOwnInput()');
  input.setAttribute('onchange', 'onOwnChange()');
  input.value = value || '';
  document.getElementById('comboOwnList').appendChild(input);
}
// Es gibt immer genau ein leeres Feld am Ende - bis MAX_EIGENE Felder erreicht sind.
function fillTrailingInput() {
  let inputs = ownInputs();
  while (inputs.length > 1 && !inputs[inputs.length - 1].value.trim() && !inputs[inputs.length - 2].value.trim()) {
    inputs[inputs.length - 1].remove();
    inputs = ownInputs();
  }
  if (!inputs.length || (inputs[inputs.length - 1].value.trim() && inputs.length < MAX_EIGENE)) addOwnInput('');
}
// Nur den Fortschrittstext aktualisieren, damit Checkboxen und Eingabefelder (und ihr Fokus) stehen bleiben.
function updateComboProgress() {
  const cur = currentCombo();
  if (!cur) return;
  const { card, c } = cur;
  const k = comboCount(card, comboPos);
  const done = k >= c.ab;
  const el = document.getElementById('comboProgress');
  if (c.e) el.textContent = done ? `Geschafft: ${k} gezählt (nötig: ${c.ab}).` : `${k} gezählt – ab ${c.ab} zählt das Feld.`;
  else el.textContent = done ? `Geschafft: ${k} von ${c.p.length} abgehakt (nötig: ${c.ab}).` : `${k} von ${c.p.length} abgehakt – ab ${c.ab} zählt das Feld.`;
  el.classList.toggle('done', done);
  if (c.e) { // doppelte Einträge zählen nicht - sichtbar machen
    const seen = new Set(c.p.map(normEintrag));
    ownInputs().forEach(inp => {
      const key = normEintrag(inp.value);
      inp.classList.toggle('dup', !!key && seen.has(key));
      if (key) seen.add(key);
    });
  }
}
function onComboCheck(i, checked) {
  const r = toggleCheck(appState.activeGame, comboPos, i, checked);
  if (!r.changed) return;
  renderBoard();
  updateComboProgress();
  if (r.justWon) showToast('Bingo!');
}
// Tippen in einem Eingabefeld: sofort speichern, neues leeres Feld ergänzen.
function onOwnInput() {
  const r = setEigene(appState.activeGame, comboPos, ownValues());
  fillTrailingInput();
  if (r.changed) {
    renderBoard();
    if (r.justWon) showToast('Bingo!');
  }
  updateComboProgress();
}
// Feld verlassen: leere Felder mitten in der Liste aufräumen (das Feld mit dem Fokus bleibt).
function onOwnChange() {
  const inputs = ownInputs();
  inputs.forEach((el, i) => { if (!el.value.trim() && i < inputs.length - 1 && el !== document.activeElement) el.remove(); });
  fillTrailingInput();
  updateComboProgress();
}

function hasMarks() {
  const card = appState.cards[appState.activeGame];
  return !!card && markedCount(card) + Object.keys(card.checks || {}).length + Object.keys(card.eigene || {}).length + Object.keys(card.details || {}).length > 0;
}
function askNewCard() {
  const id = appState.activeGame;
  const run = () => { newCardFor(id); lupePos = -1; renderBoard(); showToast('Neue Karte'); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Neue Karte?', 'Die aktuelle Karte mit ihren Markierungen wird ersetzt.', 'Neue Karte', run);
  else run();
}
function askResetMarks() {
  const id = appState.activeGame;
  const run = () => { resetMarks(id); renderBoard(); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Markierungen löschen?', 'Die Karte bleibt, alle Markierungen werden entfernt.', 'Löschen', run);
  else run();
}
