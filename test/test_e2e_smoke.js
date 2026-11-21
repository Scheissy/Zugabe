const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// End-to-End-Rauchtest: kompletter Ablauf über alle Tabs und alle Spiele - kein Schritt darf einen JS-Fehler werfen.
(async () => {
  const t = createChecker();
  const a = await loadApp({ trackErrors: true });
  const { window: w, document: d } = a;
  const H = createHelpers(w, d);
  const ids = w.eval('allGames').map(g => g.id);
  for (const id of ids) {
    w.switchTab('spiele'); H.openGameById(id);
    H.cells().filter(c => c.tagName === 'BUTTON').forEach(c => H.click(c));      // alles markieren
    H.click(d.getElementById('btnResetMarks'));
    if (H.modalOpen('confirmModal')) H.click(d.getElementById('confirmYes'));
    H.click(d.getElementById('btnNewCard'));
    if (H.modalOpen('confirmModal')) H.click(d.getElementById('confirmYes'));
  }
  ['spiele', 'spiel', 'settings', 'spiele'].forEach(n => w.switchTab(n));
  w.toggleSetting('showCounter', false); w.toggleSetting('showCounter', true);
  w.openInstallModal(); w.closeModal('installModal');
  const b = await reloadWithState(w, { trackErrors: true });
  b.window.askResetAll(); b.document.getElementById('confirmYes').dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
  t.check(`Alle ${ids.length} Spiele durchgespielt, Neustart und Zurücksetzen ohne JS-Fehler.`, a.errors.length === 0 && b.errors.length === 0, [...a.errors, ...b.errors]);
  t.check('Nach "Alles löschen" ist der Speicher ohne Karten.', Object.keys(JSON.parse(b.window.localStorage.getItem('zugabe-v1')).cards).length === 0);
  t.finish();
})();
