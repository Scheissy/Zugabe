// ── js/05-einstellungen.js ── Settings, Datenprüfung, App installieren ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('05-einstellungen');

// Checkboxen mit den geladenen Einstellungen abgleichen.
function applySettingsUI() {
  document.getElementById('settingConfirmNewCard').checked = appState.settings.confirmNewCard;
  document.getElementById('settingShowCounter').checked = appState.settings.showCounter;
  document.getElementById('settingUseKurz').checked = appState.settings.useKurz;
  document.getElementById('settingIcons').checked = appState.settings.icons;
  document.getElementById('settingAutoDatum').checked = appState.settings.autoDatum;
  document.getElementById('settingZaehler').checked = appState.settings.zaehler;
  document.getElementById('settingLupe').value = appState.settings.lupe;
}
function toggleSetting(key, value) {
  if (typeof DEFAULT_SETTINGS[key] !== 'boolean') return;   // nur Ein/Aus-Einstellungen
  appState.settings[key] = !!value;
  saveToStorage();
  renderSpiele();
  renderBoard();
}

function setLupeMode(value) {
  if (!LUPE_MODES.includes(value)) return;
  appState.settings.lupe = value;
  saveToStorage();
  renderBoard();
}

// ── DATENPRÜFUNG ─────────────────────────────────────────────────────────────
function renderValidationPanel() {
  playableGames(); // aktualisiert lastValidationIssues
  const el = document.getElementById('validationPanel');
  if (!lastValidationIssues.length) { el.innerHTML = '<div class="val-ok">Keine Auffälligkeiten – alle Spiele sind in Ordnung.</div>'; return; }
  el.innerHTML = lastValidationIssues.map(i =>
    `<div class="val-item val-${i.level}"><b>${esc(i.id)}</b>: ${esc(i.text)}</div>`).join('');
}

// ── ZURÜCKSETZEN ─────────────────────────────────────────────────────────────
function askResetAll() {
  askConfirm('Alles löschen?', 'Alle Karten und Markierungen aller Spiele werden gelöscht. Die Einstellungen bleiben.', 'Alles löschen', () => {
    resetAllCards();
    renderSpiele();
    renderBoard();
    showToast('Spielstand gelöscht');
  });
}

// ── APP INSTALLIEREN ─────────────────────────────────────────────────────────
// Je Browser völlig andere Schritte, deshalb Tabs: es steht immer nur eine Anleitung da.
const INSTALL_GUIDES = {
  android: { label: 'Chrome (Android)', steps: ['Menü (⋮) oben rechts antippen', '„App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen', 'Installation bestätigen'] },
  samsung: { label: 'Samsung Internet', steps: ['Menü antippen (☰, meist unten in der Leiste)', '„Seite hinzufügen zu“ wählen', '„Startbildschirm“ auswählen und bestätigen'] },
  ios: { label: 'Safari (iPhone/iPad)', steps: ['Teilen-Symbol (Quadrat mit Pfeil nach oben) unten in der Leiste antippen', 'Nach unten scrollen und „Zum Home-Bildschirm“ wählen', '„Hinzufügen“ oben rechts bestätigen'] },
  desktop: { label: 'Desktop (Chrome/Edge)', steps: ['Install-Symbol in der Adressleiste anklicken – falls nicht sichtbar: Menü (⋮) → „App installieren“', 'Installation im Dialog bestätigen'] }
};
let currentInstallTab = 'android';
function renderInstallGuide() {
  const tabsEl = document.getElementById('installTabs');
  const bodyEl = document.getElementById('installModalBody');
  if (!tabsEl || !bodyEl) return;
  tabsEl.innerHTML = Object.keys(INSTALL_GUIDES).map(key =>
    `<button type="button" class="install-tab${key === currentInstallTab ? ' active' : ''}" onclick="switchInstallTab('${key}')">${INSTALL_GUIDES[key].label}</button>`).join('');
  bodyEl.innerHTML = `<div class="install-steps">${INSTALL_GUIDES[currentInstallTab].steps.map((s, i) =>
    `<div class="install-step"><div class="install-step-num">${i + 1}</div><div class="install-step-text">${s}</div></div>`).join('')}</div>`;
}
function switchInstallTab(key) { currentInstallTab = key; renderInstallGuide(); }
function guessInstallPlatform() {
  const ua = navigator.userAgent || '';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
function openInstallModal() {
  currentInstallTab = guessInstallPlatform();
  renderInstallGuide();
  openModal('installModal');
}
