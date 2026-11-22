// ── js/99-main.js ── Start: Vollständigkeitsprüfung, Initialisierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('99-main');

// Prüft zuerst, ob alle Teile geladen wurden (z. B. nach einem unvollständigen Update oder bei
// fehlender Datei im Offline-Cache) und warnt sichtbar, statt mit kryptischen Fehlern zu starten.
const BINGO_EXPECTED_PARTS = ["01-data", "02-storage", "03-spiel", "04-ansicht", "05-einstellungen", "06-passung", "99-main"];
function checkAppParts(expected) {
  const loaded = window.BINGO_PARTS || [];
  const missing = expected.filter(p => !loaded.includes(p));
  if (missing.length) {
    const b = document.createElement('div');
    b.id = 'partsWarning';
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:3000;padding:10px 14px;background:#b00020;color:#fff;font-size:13px;text-align:center';
    b.textContent = 'App unvollständig geladen (' + missing.join(', ') + ') – bitte Seite neu laden.';
    document.body.appendChild(b);
  }
  return missing;
}
checkAppParts(BINGO_EXPECTED_PARTS);

loadFromStorage();
applySettingsUI();
renderSpiele();
renderValidationPanel();
// Mit laufendem Spiel direkt zur Karte, sonst zur Spieleliste.
switchTab(gameById(appState.activeGame) && appState.cards[appState.activeGame] ? 'spiel' : 'spiele');
