const fs = require('fs');
const path = require('path');
const { ROOT, loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Felder gleich groß, Text einpassen ("so viel Text wie möglich"), Symbole optional, Zoom des Spielfelds (Buttons + Zwei-Finger-Zoom).
// Ein echtes Layout gibt es in JSDOM nicht: die Feldgröße wird per Stub vorgegeben, die Textbreite per window.BINGO_MEASURE.
(async () => {
  const t = createChecker();
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf-8');
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const m = (s, size) => String(s).length * size * 0.5;      // feste "Schrift": jedes Zeichen 0,5 × Schriftgröße breit
  w.BINGO_MEASURE = m;

  // ───────── 1) Felder gleich groß (CSS-Regel) ─────────
  const rule = sel => ((css.match(new RegExp('\\n' + sel.replace(/\./g, '\\.') + ' \\{([^}]*)\\}')) || [])[1]) || '';
  t.check('.cell: quadratisch (aspect-ratio 1) und unabhängig vom Inhalt (min-height 0, overflow hidden) - sonst wachsen Zeilen bei langem Text.',
    /aspect-ratio:\s*1/.test(rule('.cell')) && /min-height:\s*0/.test(rule('.cell')) && /min-width:\s*0/.test(rule('.cell')) && /overflow:\s*hidden/.test(rule('.cell')), rule('.cell'));
  t.check('.cell.fit: Zeilenumbrüche kommen aus der Berechnung (white-space: pre, keine automatische Silbentrennung).', /white-space:\s*pre/.test(rule('.cell.fit')) && /hyphens:\s*manual/.test(rule('.cell.fit')));
  t.check('Gezoomtes Spielfeld scrollt im eigenen Rahmen mit begrenzter Höhe.', /overflow:\s*auto/.test(rule('.board-scroll.zoomed')) && /max-height/.test(rule('.board-scroll.zoomed')));

  // ───────── 2) Symbole ─────────
  t.check('stripIcons entfernt Emojis samt Variantenselektor und räumt Leerzeichen auf.', w.stripIcons('🎸 Einsatz') === 'Einsatz' && w.stripIcons('⭐ Danke 🎛️') === 'Danke' && w.stripIcons('A  B') === 'A B');
  t.check('stripIcons lässt reinen Symbol-Text und normalen Text unverändert.', w.stripIcons('🎤') === '🎤' && w.stripIcons('Open Air') === 'Open Air' && w.stripIcons('Würstchen & Bier „Prost“') === 'Würstchen & Bier „Prost“');
  t.check('Symbole sind standardmäßig an; displayText folgt der Einstellung.', w.eval('appState.settings.icons') === true && w.displayText('🎸 Einsatz') === '🎸 Einsatz');

  // ───────── 3) fitText (reine Funktion) ─────────
  const fit = (variants, box, o = {}) => w.fitText(variants, box, { measure: m, max: 22, ...o });
  let r = fit(['Hallo Welt'], { w: 100, h: 100 });
  t.check('Großes Feld: ganzer Text in der größten erlaubten Schrift, zwei Zeilen.', r.variant === 0 && !r.cut && r.size === 22 && r.lines.join(' ') === 'Hallo Welt', r);
  r = fit(['Gitarrist verpasst den Einsatz', 'Einsatz'], { w: 38, h: 38 }, { max: 11 });
  t.check('Kleines Feld: der ganze Text würde nur winzig passen, deshalb der lesbare Kurztext (mind. 10 px).', r.variant === 1 && r.size >= 10 && r.lines.join(' ') === 'Einsatz', r);
  r = fit(['Gitarrist verpasst den Einsatz', 'Einsatz'], { w: 60, h: 60 }, { max: 11 });
  t.check('Mehr Platz (Zoom): der ganze Text passt lesbar und wird gezeigt.', r.variant === 0 && r.size >= 10 && r.lines.join(' ') === 'Gitarrist verpasst den Einsatz', r);
  r = fit(['Donaudampfschifffahrt'], { w: 40, h: 60 });
  t.check('Wort, das nirgends passt: Silbentrennung mit Trennstrich, kein Zeichen geht verloren.', r.variant === 0 && !r.cut && r.lines.length > 1 && r.lines.slice(0, -1).every(l => l.endsWith('-')) && r.lines.join('').replace(/-/g, '') === 'Donaudampfschifffahrt', r);
  r = fit(['Ein sehr langer Text der nie passt'], { w: 30, h: 12 });
  const v = 'Ein sehr langer Text der nie passt';
  t.check('Gar nicht unterzubringen: gekürzt mit "…", so viele Zeichen wie passen (ein weiteres Zeichen wäre zu breit).',
    r.cut && r.text.endsWith('…') && m(r.text, r.size) <= 30 * 0.96 && m(v.slice(0, r.text.length) + '…', r.size) > 30 * 0.96, r);
  const noRes = fit(['Zwei Worte'], { w: 100, h: 30 }), withRes = fit(['Zwei Worte'], { w: 100, h: 30 }, { reserve: s => s * 0.98 + 3 });
  t.check('Reservierte Höhe (Fortschrittszeile bei Kombi-Feldern) macht die Schrift kleiner.', withRes.size < noRes.size, [noRes.size, withRes.size]);
  t.check('Winzige Box: liefert trotzdem ein Ergebnis ("…") statt zu scheitern.', (x => x.cut && x.lines.length >= 1)(fit(['Text'], { w: 3, h: 3 })));
  // Zufallstest: das Ergebnis passt immer in die Box (Breite und Höhe), ohne Textverlust ohne Kürzung
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let bad = null;
  for (let i = 0; i < 400 && !bad; i++) {
    const word = () => 'abcdefghijklmnopqrstuvwxyz'.slice(0, 1 + Math.floor(rnd() * 14)).split('').map((_, k) => String.fromCharCode(97 + Math.floor(rnd() * 26))).join('');
    const mk = () => Array.from({ length: 1 + Math.floor(rnd() * 6) }, word).join(' ');
    const variants = rnd() < 0.5 ? [mk()] : [mk(), mk().slice(0, 12)];
    const box = { w: 20 + rnd() * 180, h: 14 + rnd() * 180 }, max = 11 + rnd() * 11;
    const res = fit(variants, box, { max, reserve: rnd() < 0.3 ? (s => s * 0.98 + 3) : null });
    const hAvail = box.h * 0.98 - (res.reserve ? 0 : 0);
    const fitsW = res.lines.every(l => m(l, res.size) <= box.w * 0.96 + 1e-9);
    const sizeOk = res.size >= 8 - 1e-9 && res.size <= Math.max(max, 8) + 1e-9;
    const textOk = res.cut || res.lines.join(' ').replace(/- /g, '') === variants[res.variant] || res.lines.join('').replace(/-/g, '').replace(/ /g, '') === variants[res.variant].replace(/ /g, '');
    if (!fitsW || !sizeOk || !textOk) bad = { variants, box, res };
  }
  t.check('Zufallstest (400 Fälle): Zeilen passen immer in die Breite, Schriftgröße im erlaubten Bereich, ohne Kürzung geht kein Text verloren.', !bad, bad);
  let badH = null; seed = 11;
  for (let i = 0; i < 400 && !badH; i++) {
    const text = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => 'x'.repeat(1 + Math.floor(rnd() * 12))).join(' ');
    const box = { w: 25 + rnd() * 150, h: 14 + rnd() * 150 };
    const res = fit([text], box, { max: 11 + rnd() * 11 });
    if (res.lines.length * res.size * 1.15 > box.h * 0.98 + 1e-9) badH = { text, box, res };
  }
  t.check('Zufallstest (400 Fälle): die Zeilen passen immer auch in die Höhe der Box.', !badH, badH);

  // ───────── 4) fitBoard mit vorgegebener Feldgröße ─────────
  let cellSize = 0;
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.classList && this.classList.contains('cell') ? cellSize : 0; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.classList && this.classList.contains('cell') ? cellSize : 0; } });
  w.switchTab('spiele'); H.openGameById('testkarte9');
  const shownCounts = () => H.cells().filter(c => !c.classList.contains('free')).reduce((a, c) => (a[c.dataset.shown || '-'] = (a[c.dataset.shown || '-'] || 0) + 1, a), {});
  const card = () => w.eval('appState.cards.testkarte9');
  t.check('Ohne Layout (Feldbreite 0) bleibt die Beschriftung unangetastet (keine Klasse fit).', H.cells().every(c => !c.classList.contains('fit')) && cellSize === 0);

  cellSize = 38; w.fitBoard();
  const small = shownCounts();
  const fullShort = H.cells().filter(c => c.dataset.shown === 'full').every(c => c.textContent.replace(/\n/g, ' ') === card().cells[+c.dataset.p] && parseFloat(c.style.fontSize) >= 8);   // ganze Texte stehen vollständig und ohne Silbentrennung da
  t.check('9×9 bei kleinen Feldern (38 px): überwiegend Kurztexte, ganze Texte nur wenn sie vollständig und ohne Wortbruch passen (mind. 8 px), nichts gekürzt, alle Felder angepasst.', (small.kurz || 0) > 40 && (small.full || 0) < 20 && fullShort && !small.cut && H.cells().filter(c => !c.classList.contains('free')).every(c => c.classList.contains('fit')), small);
  const sizes = H.cells().filter(c => c.style.fontSize).map(c => parseFloat(c.style.fontSize));
  t.check('Schriftgrößen liegen zwischen 8 und 11 px (kleine Felder).', sizes.length > 40 && Math.min(...sizes) >= 8 && Math.max(...sizes) <= 11 + 1e-9, [Math.min(...sizes), Math.max(...sizes)]);
  H.click(H.cells().find(c => c.tagName === 'BUTTON' && !c.classList.contains('combo')));
  t.check('Nach dem Antippen (Neuzeichnen der Karte) sind alle Felder sofort wieder angepasst.', H.cells().filter(c => !c.classList.contains('free')).every(c => c.classList.contains('fit') && c.style.fontSize));
  const shortCell = H.cells().find(c => c.dataset.shown === 'kurz');
  t.check('Bei Kurztext trägt das Feld den ganzen Text im aria-label und im Tooltip.', !!shortCell && shortCell.getAttribute('aria-label') === card().cells[+shortCell.dataset.p] && shortCell.title === card().cells[+shortCell.dataset.p]);

  cellSize = 150; w.fitBoard();
  const big = shownCounts();
  t.check('Große Felder (Zoom, 150 px): überall der ganze Text, nichts gekürzt.', big.full === 80 && !big.kurz && !big.cut, big);
  t.check('Der ganze Text steht auf dem Feld (Zeilenumbrüche nur durch Berechnung).', H.cells().filter(c => c.dataset.shown === 'full').every(c => c.textContent.replace(/\n/g, ' ') === card().cells[+c.dataset.p]));
  t.check('Mit größeren Feldern wird auch die Schrift größer (bis 22 px).', Math.max(...H.cells().filter(c => c.style.fontSize).map(c => parseFloat(c.style.fontSize))) > 11 && Math.max(...H.cells().filter(c => c.style.fontSize).map(c => parseFloat(c.style.fontSize))) <= 22);

  // Symbole aus: kein Emoji mehr auf den Feldern; an: Emojis bei Kurztexten
  const emoji = /\p{Extended_Pictographic}/u;
  cellSize = 38; w.toggleSetting('icons', false);
  t.check('Symbole aus: auf keinem Feld steht ein Emoji, es ist mehr Platz für Text.', H.cells().every(c => !emoji.test(c.textContent)));
  w.toggleSetting('icons', true);
  t.check('Symbole an: die Kurztexte zeigen wieder ihr Symbol.', H.cells().some(c => emoji.test(c.textContent)));
  w.toggleSetting('useKurz', false); w.fitBoard();
  const noKurz = shownCounts();
  t.check('Kurztexte aus: nie ein Kurztext, nur ganzer (kleiner/getrennt) oder gekürzter Text.', !noKurz.kurz && (noKurz.full || 0) + (noKurz.cut || 0) === 80, noKurz);
  const cutCells = H.cells().filter(c => c.dataset.shown === 'cut');
  t.check('Gekürzte Felder tragen den ganzen Text im aria-label und im Tooltip.', cutCells.length > 0 && cutCells.every(c => c.getAttribute('aria-label') === card().cells[+c.dataset.p] && c.title === card().cells[+c.dataset.p] && c.textContent.endsWith('…')), cutCells.length);
  w.toggleSetting('useKurz', true);

  // Kombi-Feld: Titel eingepasst, Fortschrittszeile bleibt
  w.switchTab('spiele'); H.openGameById('festivalwoche'); cellSize = 60; w.fitBoard();
  const cc = H.cells().find(c => c.classList.contains('combo'));
  const seen = []; const origFit = w.fitText;
  w.fitText = (v, bx, o) => { seen.push(o); return origFit(v, bx, o); };
  w.fitBoard(); w.fitText = origFit;
  const comboCalls = seen.filter(o => typeof o.reserve === 'function').length;
  t.check('Beim Einpassen bekommen genau die Kombi-Felder eine Reserve für die Fortschrittszeile, Textfelder nicht.', comboCalls === H.cells().filter(c => c.classList.contains('combo')).length && comboCalls > 0 && seen.filter(o => o.reserve === null).length === seen.length - comboCalls, [comboCalls, seen.length]);
  const ccSize = parseFloat(cc.style.fontSize), ccLines = cc.querySelector('.cell-text').textContent.split('\n').length;
  t.check('Kombi-Feld: Titelzeilen plus Fortschrittszeile passen zusammen in die Feldhöhe.', ccLines * ccSize * 1.15 + (ccSize * 0.98 + 3) <= 60 * 0.98 + 1e-6, [ccLines, ccSize]);
  t.check('Kombi-Feld: der Titel wird eingepasst, die Fortschrittszeile bleibt erhalten.', !!cc && cc.classList.contains('fit') && !!cc.querySelector('.cell-progress') && !!cc.querySelector('.cell-text').textContent);

  // ───────── 5) Zoom ─────────
  const sc = d.getElementById('boardScroll'), board = d.getElementById('board');
  w.switchTab('spiele'); H.openGameById('testkarte9'); cellSize = 38;
  t.check('Start: 100 %, Rahmen nicht gezoomt, Verkleinern gesperrt, Anzeige "100 %".', w.eval('boardZoom') === 100 && board.style.width === '100%' && !sc.classList.contains('zoomed') && d.getElementById('zoomOut').disabled && d.getElementById('zoomVal').textContent === '100 %');
  H.click(d.getElementById('zoomIn'));
  t.check('Plus-Taste: 125 %, Rahmen scrollbar, Feldbreite 125 %.', w.eval('boardZoom') === 125 && board.style.width === '125%' && sc.classList.contains('zoomed') && d.getElementById('zoomVal').textContent === '125 %' && !d.getElementById('zoomOut').disabled);
  H.click(d.getElementById('zoomOut'));
  t.check('Minus-Taste: zurück auf 100 %.', w.eval('boardZoom') === 100);
  w.setZoom(9999);
  t.check('Zoom ist nach oben auf 400 % begrenzt, Plus dann gesperrt.', w.eval('boardZoom') === 400 && d.getElementById('zoomIn').disabled);
  w.setZoom(1);
  t.check('Zoom ist nach unten auf 100 % begrenzt.', w.eval('boardZoom') === 100);
  w.setZoom(NaN); w.setZoom(undefined);
  t.check('Ungültige Zoomwerte ändern nichts und werfen keinen Fehler.', w.eval('boardZoom') === 100);
  const presetBtns = () => [...d.querySelectorAll('#zoomPresets .zoom-preset')];
  const presetBtn = z => presetBtns().find(b => +b.dataset.zoom === z);
  t.check('Stufen-Buttons: 100 %, 200 %, 300 % und 400 % - passend zu ZOOM_PRESETS und innerhalb der Grenzen.', JSON.stringify(presetBtns().map(b => b.textContent)) === '["100 %","200 %","300 %","400 %"]' && JSON.stringify(presetBtns().map(b => +b.dataset.zoom)) === JSON.stringify(w.eval('ZOOM_PRESETS')) && w.eval('ZOOM_PRESETS').every(z => z >= 100 && z <= 400) && w.eval('ZOOM_PRESETS.includes(ZOOM_MIN) && ZOOM_PRESETS.includes(ZOOM_MAX)'));
  t.check('Am Anfang ist die Stufe 100 % hervorgehoben (aria-pressed), die anderen nicht.', presetBtns().map(b => b.getAttribute('aria-pressed')).join() === 'true,false,false,false' && presetBtn(100).classList.contains('on') && presetBtns().filter(b => b.classList.contains('on')).length === 1);
  H.click(presetBtn(300));
  t.check('Stufe 300 %: Zoom 300 %, Anzeige "300 %", genau diese Stufe hervorgehoben, Rahmen scrollbar.', w.eval('boardZoom') === 300 && d.getElementById('zoomVal').textContent === '300 %' && presetBtns().map(b => b.getAttribute('aria-pressed')).join() === 'false,false,true,false' && presetBtn(300).classList.contains('on') && sc.classList.contains('zoomed') && board.style.width === '300%');
  H.click(presetBtn(200));
  t.check('Stufe 200 % springt direkt (nicht schrittweise) auf 200 %.', w.eval('boardZoom') === 200 && presetBtn(200).classList.contains('on') && !presetBtn(300).classList.contains('on'));
  H.click(presetBtn(400));
  t.check('Stufe 400 % (Maximum): Zoom 400 %, Plus gesperrt, Minus frei.', w.eval('boardZoom') === 400 && d.getElementById('zoomIn').disabled && !d.getElementById('zoomOut').disabled && presetBtn(400).classList.contains('on'));
  w.setZoom(156);
  t.check('Zwischenwert (z. B. nach Zwei-Finger-Zoom): die Anzeige nennt den genauen Wert, keine Stufe ist hervorgehoben.', d.getElementById('zoomVal').textContent === '156 %' && presetBtns().every(b => !b.classList.contains('on') && b.getAttribute('aria-pressed') === 'false'));
  H.click(presetBtn(100));
  t.check('Der 100-%-Button setzt auf das ganze Spielfeld zurück: Rahmen nicht mehr gezoomt, Minus gesperrt, Stufe 100 % hervorgehoben.', w.eval('boardZoom') === 100 && !sc.classList.contains('zoomed') && board.style.width === '100%' && d.getElementById('zoomOut').disabled && presetBtn(100).classList.contains('on') && d.getElementById('zoomVal').textContent === '100 %');
  t.check('Die Prozentanzeige ist keine Taste mehr (reiner Text).', d.getElementById('zoomVal').tagName === 'SPAN');

  // Zoom → größere Felder → mehr Text
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.classList && this.classList.contains('cell') ? Math.round(38 * w.eval('boardZoom') / 100) : 0; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.classList && this.classList.contains('cell') ? Math.round(38 * w.eval('boardZoom') / 100) : 0; } });
  w.setZoom(100); const at100 = shownCounts();
  w.setZoom(400); const at400 = shownCounts();
  t.check('Hineinzoomen zeigt mehr Text: bei 100 % nur wenige ganze Texte, bei 400 % alle 80.', (at100.full || 0) < 20 && at400.full === 80 && !at400.kurz, [at100, at400]);
  w.setZoom(160); const at160 = shownCounts();
  t.check('Dazwischen nimmt der Anteil ganzer Texte zu (160 % mehr als 100 %).', (at160.full || 0) >= (at100.full || 0), [at100, at160]);

  // Brennpunkt: Stellen unter den Fingern bleiben stehen
  Object.defineProperty(sc, 'clientWidth', { configurable: true, get: () => 300 });
  Object.defineProperty(sc, 'clientHeight', { configurable: true, get: () => 300 });
  Object.defineProperty(board, 'offsetWidth', { configurable: true, get: () => 300 * w.eval('boardZoom') / 100 });
  Object.defineProperty(board, 'offsetHeight', { configurable: true, get: () => 300 * w.eval('boardZoom') / 100 });
  w.setZoom(100); sc.scrollLeft = 0; sc.scrollTop = 0;
  w.setZoom(200, 60, 100);
  t.check('Zoomen mit Brennpunkt (60, 100) hält diese Stelle fest: Scrollposition (60, 100) - nicht die Mitte.', sc.scrollLeft === 60 && sc.scrollTop === 100, [sc.scrollLeft, sc.scrollTop]);
  w.setZoom(100); sc.scrollLeft = 0; sc.scrollTop = 0; w.setZoom(200);
  t.check('Zoomen ohne Brennpunkt zoomt um die Mitte des Rahmens (Scrollposition 150, 150).', sc.scrollLeft === 150 && sc.scrollTop === 150, [sc.scrollLeft, sc.scrollTop]);

  // Zwei-Finger-Zoom
  w.setZoom(100);
  const touch = (type, pts) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.touches = pts.map(([x, y]) => ({ clientX: x, clientY: y })); sc.dispatchEvent(e); return e; };
  touch('touchstart', [[0, 0], [100, 0]]);
  let e = touch('touchmove', [[0, 0], [200, 0]]);
  t.check('Zwei Finger auseinander (Abstand ×2): Zoom 200 %, Browser-Scrollen wird unterdrückt.', w.eval('boardZoom') === 200 && e.defaultPrevented);
  e = touch('touchmove', [[0, 0], [50, 0]]);
  t.check('Zwei Finger zusammen (Abstand ×0,5): Zoom zurück auf 100 % (Untergrenze).', w.eval('boardZoom') === 100 && e.defaultPrevented);
  touch('touchend', []);
  e = touch('touchmove', [[0, 0], [300, 0]]);
  t.check('Nach dem Loslassen ändert eine neue Bewegung nichts (kein laufender Zwei-Finger-Zoom).', w.eval('boardZoom') === 100 && !e.defaultPrevented);
  touch('touchstart', [[10, 10]]);
  e = touch('touchmove', [[50, 50]]);
  t.check('Ein Finger wischt nur (scrollt): kein Zoom, nicht unterdrückt.', w.eval('boardZoom') === 100 && !e.defaultPrevented);
  touch('touchstart', [[0, 0], [10, 0], [20, 0]]);
  e = touch('touchmove', [[0, 0], [10, 0], [200, 0]]);
  t.check('Drei Finger lösen keinen Zoom aus.', w.eval('boardZoom') === 100 && !e.defaultPrevented);
  touch('touchstart', [[0, 0], [100, 0]]);
  e = touch('touchmove', [[0, 0]]);
  t.check('Hebt man einen Finger an, hört das Zoomen auf (kein Fehler, nicht unterdrückt).', w.eval('boardZoom') === 100 && !e.defaultPrevented);
  touch('touchend', [[0, 0]]);
  touch('touchstart', [[0, 0], [100, 0]]); touch('touchmove', [[0, 0], [9000, 0]]);
  t.check('Zwei-Finger-Zoom ist nach oben auf 400 % begrenzt.', w.eval('boardZoom') === 400);
  touch('touchend', []);

  // Neues Spiel öffnen setzt den Zoom zurück
  w.setZoom(300); w.switchTab('spiele'); H.openGameById('klubnacht');
  t.check('Beim Öffnen eines Spiels steht der Zoom wieder auf 100 %.', w.eval('boardZoom') === 100 && board.style.width === '100%' && !sc.classList.contains('zoomed'));

  // ───────── 6) Einstellung Symbole ─────────
  w.toggleSetting('icons', false);
  t.check('Einstellung "Symbole" wird gespeichert; die Checkbox spiegelt sie.', JSON.parse(w.localStorage.getItem('zugabe-v1')).settings.icons === false && d.getElementById('settingIcons') !== null);
  const r2 = await reloadWithState(w);
  t.check('Nach Neustart bleibt "Symbole aus" erhalten (Checkbox und Einstellung).', r2.window.eval('appState.settings.icons') === false && r2.document.getElementById('settingIcons').checked === false);
  const bad2 = await loadApp({ storage: JSON.stringify({ settings: { icons: 'nein' } }) });
  t.check('Ungültiger gespeicherter Wert fällt auf "an" zurück.', bad2.window.eval('appState.settings.icons') === true);
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0 && r2.errors.length === 0, [...errors, ...r2.errors]);
  t.finish();
})();
