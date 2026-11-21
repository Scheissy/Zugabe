const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Oberfläche (js/04-ansicht.js, 05-einstellungen.js): Tabs, Spieleliste, Karte, Gewinn-Anzeige, Bestätigungen, Escaping.
(async () => {
  const t = createChecker();
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const tabVisible = n => H.visible(d.getElementById('view-' + n));

  // Start & Tabs
  t.check('Start ohne gespeicherten Stand: Spieleliste sichtbar, Karte und Settings versteckt.', tabVisible('spiele') && !tabVisible('spiel') && !tabVisible('settings'));
  t.check('Spieleliste zeigt Titel, Beschreibung und Meta (Größe, Ziel).', (() => { const c = d.querySelector('.game-card[data-id="marathon"]'); return c.textContent.includes('Festival-Marathon') && c.textContent.includes('4×4') && c.textContent.includes('Vollbild'); })());
  H.click(d.getElementById('nav-spiel'));
  t.check('Tab "Karte" ohne Spiel zeigt den Leerzustand mit Weg zur Spieleliste.', tabVisible('spiel') && H.visible(d.getElementById('boardEmpty')) && !H.visible(d.getElementById('boardContent')));
  H.click(d.querySelector('#boardEmpty button'));
  t.check('Der Button im Leerzustand führt zu den Spielen.', tabVisible('spiele'));
  H.click(d.getElementById('nav-settings'));
  t.check('Tab "Settings" zeigt Einstellungen; Navigationsleiste markiert den aktiven Tab.', tabVisible('settings') && d.getElementById('nav-settings').classList.contains('active') && !d.getElementById('nav-spiele').classList.contains('active'));
  w.switchTab('gibts-nicht');
  t.check('Unbekannter Tab ändert nichts.', tabVisible('settings'));

  // Spiel öffnen
  H.click(d.getElementById('nav-spiele'));
  H.openGameById('klubnacht');
  t.check('Tipp auf ein Spiel öffnet die Karte mit 9 Zellen im 3er-Raster.', tabVisible('spiel') && H.cells().length === 9 && d.getElementById('board').style.getPropertyValue('--n') === '3');
  t.check('Das Freifeld steht in der Mitte, ist markiert und nicht anklickbar (kein Button).', (c => c.classList.contains('free') && c.classList.contains('marked') && c.tagName === 'DIV')(H.cell(4)));
  t.check('Titel und Zähler stehen über der Karte.', d.getElementById('boardTitle').textContent === 'Klubnacht' && /0 von 8 Feldern/.test(d.getElementById('boardMeta').textContent));
  t.check('Topbar nennt das aktive Spiel.', d.getElementById('topbarSub').textContent === 'Klubnacht');

  // Markieren & Gewinn
  H.click(H.cell(0));
  t.check('Tipp auf ein Feld markiert es (Klasse + aria-pressed) und aktualisiert den Zähler.', H.cell(0).classList.contains('marked') && H.cell(0).getAttribute('aria-pressed') === 'true' && /1 von 8/.test(d.getElementById('boardMeta').textContent));
  H.click(H.cell(0));
  t.check('Zweiter Tipp hebt die Markierung auf.', !H.cell(0).classList.contains('marked') && H.cell(0).getAttribute('aria-pressed') === 'false');
  t.check('Ohne Gewinn ist das Banner versteckt.', !H.visible(d.getElementById('boardBanner')));
  H.click(H.cell(0)); H.click(H.cell(8));
  t.check('Diagonale 0-4-8 komplett: Banner "Bingo! 1 Reihe voll.", Gewinnfelder hervorgehoben, Toast.',
    H.visible(d.getElementById('boardBanner')) && /Bingo! 1 Reihe voll/.test(d.getElementById('boardBanner').textContent)
    && [0, 4, 8].every(p => H.cell(p).classList.contains('win')) && !H.cell(1).classList.contains('win') && d.getElementById('toast').classList.contains('show'));
  d.getElementById('toast').classList.remove('show');
  H.click(H.cell(1));
  t.check('Weitere Markierung nach dem Gewinn löst keinen neuen Toast aus.', !d.getElementById('toast').classList.contains('show'));
  H.click(H.cell(2));
  t.check('Zwei Reihen: Banner sagt "2 Reihen".', /2 Reihen/.test(d.getElementById('boardBanner').textContent) || /Reihen/.test(d.getElementById('boardBanner').textContent));
  H.click(d.getElementById('nav-spiele'));
  t.check('Spieleliste zeigt "Bingo"-Abzeichen und Fortschrittsbalken beim gewonnenen Spiel.', !!d.querySelector('.game-card[data-id="klubnacht"] .game-badge') && !!d.querySelector('.game-card[data-id="klubnacht"] .game-bar-fill'));

  // Vollbild
  H.openGameById('marathon');
  for (let p = 0; p < 15; p++) H.click(H.cell(p));
  t.check('Vollbild: bei 15 von 16 noch kein Banner.', !H.visible(d.getElementById('boardBanner')));
  H.click(H.cell(15));
  t.check('Vollbild: letztes Feld -> Banner "Vollbild! …".', /Vollbild!/.test(d.getElementById('boardBanner').textContent));

  // Neue Karte / Zurücksetzen mit Rückfrage
  const seedBefore = w.eval('appState.cards.marathon.seed');
  H.click(d.getElementById('btnNewCard'));
  t.check('"Neue Karte" mit Markierungen fragt nach (Modal offen, Karte unverändert).', H.modalOpen('confirmModal') && w.eval('appState.cards.marathon.seed') === seedBefore);
  H.click(d.querySelector('#confirmModal .form-btn-cancel'));
  t.check('Abbrechen schließt den Dialog ohne Änderung.', !H.modalOpen('confirmModal') && w.eval('appState.cards.marathon.seed') === seedBefore && w.eval('appState.cards.marathon.marks.length') === 16);
  H.click(d.getElementById('btnNewCard')); H.click(d.getElementById('confirmYes'));
  t.check('Bestätigen ersetzt die Karte: neuer Seed, keine Markierungen, Dialog zu.', !H.modalOpen('confirmModal') && w.eval('appState.cards.marathon.seed') !== seedBefore && H.markedPositions().length === 0);
  H.click(d.getElementById('btnNewCard'));
  t.check('Ohne Markierungen wird sofort neu gemischt (keine Rückfrage).', !H.modalOpen('confirmModal'));
  H.click(H.cell(0)); H.click(d.getElementById('btnResetMarks'));
  t.check('"Markierungen löschen" fragt nach; Bestätigen entfernt sie, die Karte bleibt.', H.modalOpen('confirmModal'));
  const cellsBefore = JSON.stringify(w.eval('appState.cards.marathon.cells'));
  H.click(d.getElementById('confirmYes'));
  t.check('Nach dem Bestätigen sind die Markierungen weg, die Felder gleich.', H.markedPositions().length === 0 && JSON.stringify(w.eval('appState.cards.marathon.cells')) === cellsBefore);
  w.toggleSetting('confirmNewCard', false);
  H.click(H.cell(0)); H.click(d.getElementById('btnNewCard'));
  t.check('Ist die Rückfrage in den Settings aus, wird nie nachgefragt.', !H.modalOpen('confirmModal'));
  w.toggleSetting('confirmNewCard', true);

  // Modal-Mechanik
  w.askConfirm('T', 'X', 'Ja', () => {});
  H.click(d.querySelector('#confirmModal .modal'));
  t.check('Tipp auf die Dialogkarte lässt den Dialog offen.', H.modalOpen('confirmModal'));
  H.click(d.getElementById('confirmModal'));
  t.check('Tipp auf den Hintergrund schließt den Dialog, die Aktion läuft nicht.', !H.modalOpen('confirmModal'));
  w.askConfirm('T', 'X', 'Ja', () => {}); H.click(d.querySelector('#confirmModal .modal-close'));
  t.check('✕ schließt den Dialog.', !H.modalOpen('confirmModal'));

  // Settings
  H.click(d.getElementById('nav-settings'));
  const cb = d.getElementById('settingShowCounter'); cb.checked = false; cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  t.check('Settings: "Zähler anzeigen" aus -> Meta ohne Zahlen, Spieleliste ohne x/y.', w.eval('appState.settings.showCounter') === false && !/von/.test(d.getElementById('boardMeta').textContent));
  w.toggleSetting('unbekannt', true);
  t.check('Unbekannte Einstellungs-Schlüssel werden ignoriert.', !('unbekannt' in w.eval('appState.settings')));
  H.click(d.querySelector('#view-settings .io-section:nth-of-type(2) .prog-quick-btn'));
  t.check('Installationsanleitung öffnet sich mit einem Tab pro Browser (4) und drei Schritten bei iOS.', H.modalOpen('installModal') && d.querySelectorAll('.install-tab').length === 4);
  w.switchInstallTab('ios');
  t.check('Tab-Wechsel zeigt die Schritte des gewählten Browsers.', d.querySelectorAll('.install-step').length === 3 && d.querySelector('.install-tab.active').textContent.includes('Safari'));
  w.closeModal('installModal');

  // Alles zurücksetzen
  H.click(d.querySelector('.io-btn'));
  t.check('"Alles löschen" fragt nach.', H.modalOpen('confirmModal'));
  H.click(d.getElementById('confirmYes'));
  t.check('Danach gibt es keine Karten mehr, Einstellungen bleiben.', Object.keys(w.eval('appState.cards')).length === 0 && w.eval('appState.settings.showCounter') === false);

  // Escaping
  const evil = await loadApp({ trackErrors: true, dataScript: `const BINGO_GAMES = [{ id:'evil', titel:'<img src=x onerror="window.__pwned=1">Titel & "Co"', beschreibung:"<b>fett</b> 'x'", groesse:3, freiMitte:true, ziel:'linie',
    felder:['<script>window.__pwned=1<\\/script>','a"b','c\\'d','e&f','<i>g</i>','h','i','j'] }]; const BINGO_DATA_VERSION = 1;` });
  const EH = createHelpers(evil.window, evil.document);
  EH.openGameById('evil');
  t.check('Sonderzeichen in Titel, Beschreibung und Feldern werden als Text angezeigt, nicht ausgeführt.',
    !evil.window.__pwned && !evil.document.querySelector('#boardTitle img, .game-card img, #board img, #board script') && evil.document.getElementById('boardTitle').textContent.includes('<img') && EH.cells().some(c => c.textContent === 'a"b') && EH.cells().some(c => c.textContent === "c'd") && EH.cells().some(c => c.textContent === '<i>g</i>'));
  EH.click(EH.cells().find(c => c.textContent === 'a"b'));
  t.check('Klick auf ein Feld mit Anführungszeichen funktioniert (kein kaputtes onclick).', EH.markedPositions().length === 1 && evil.errors.length === 0, evil.errors);

  // Neustart öffnet die Karte wieder
  const x = await loadApp(); const XH = createHelpers(x.window, x.document);
  XH.openGameById('festival'); XH.click(XH.cell(0));
  const y = await reloadWithState(x.window); const YH = createHelpers(y.window, y.document);
  t.check('Nach Neustart steht die Karte mit derselben Markierung wieder da.', YH.markedPositions().join() === '0' && !y.document.getElementById('view-spiel').classList.contains('hidden'));
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0, errors);
  t.finish();
})();
