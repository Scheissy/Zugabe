const fs = require('fs');
const path = require('path');
const { loadApp, createChecker, ROOT } = require('./test-helpers');

// Schützt den Aufbau der App: index.html + css/app.css + js/*.js (nummeriert, 99-main.js zuletzt):
//  - index.html enthält nur Markup und Verweise (kein Inline-<style>/-<script>),
//  - die Skript-Reihenfolge entspricht BINGO_EXPECTED_PARTS (99-main.js),
//  - jede Datei existiert, meldet sich unter ihrem Namen an und steht im Service-Worker-Cache,
//  - keine Datei wächst zum Monolithen, die App startet ohne Ladefehler, eine unvollständige App warnt sichtbar.
(async () => {
  const t = createChecker();
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf-8');
  const html = read('index.html');
  const sw = read('sw.js');
  const lines = s => s.split('\n').length;

  // ───────── 1) index.html ─────────
  t.check('index.html enthält kein Inline-<style>, sondern verweist auf css/app.css.',
    !/<style[\s>]/.test(html) && html.includes('<link rel="stylesheet" href="css/app.css">'));
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
  t.check('index.html enthält keine Inline-Skripte (jedes <script> hat ein src).', scriptTags.length > 0 && scriptTags.every(a => /\bsrc="/.test(a)), scriptTags);
  const srcs = scriptTags.map(a => (a.match(/src="([^"]+)"/) || [])[1]);
  t.check('Die Daten (bingo-data.js) werden vor allen App-Skripten geladen.', srcs[0] === 'bingo-data.js' && srcs.slice(1).every(s => s.startsWith('js/')), srcs);
  const jsFiles = srcs.filter(s => s.startsWith('js/'));
  const names = jsFiles.map(s => s.replace(/^js\//, '').replace(/\.js$/, ''));
  t.check('Das letzte Skript ist js/99-main.js (Start-Code).', jsFiles[jsFiles.length - 1] === 'js/99-main.js', jsFiles);
  t.check('Die Dateinamen sind nach Ladereihenfolge nummeriert (aufsteigend sortiert).', JSON.stringify(names) === JSON.stringify([...names].sort()));
  t.check('index.html ist nur noch Markup (unter 700 Zeilen).', lines(html) < 700, lines(html));

  // ───────── 2) Dateien ─────────
  const expected = JSON.parse((read('js/99-main.js').match(/const BINGO_EXPECTED_PARTS = (\[.*?\]);/) || [])[1] || '[]');
  t.check('BINGO_EXPECTED_PARTS in 99-main.js entspricht exakt den Skript-Tags (Namen und Reihenfolge).', JSON.stringify(expected) === JSON.stringify(names), { expected, names });
  let registrationsOk = true; const problems = [];
  for (const n of names) {
    const file = `js/${n}.js`;
    if (!fs.existsSync(path.join(ROOT, file))) { registrationsOk = false; problems.push('fehlt: ' + file); continue; }
    const code = read(file);
    const reg = [...code.matchAll(/\(window\.BINGO_PARTS = window\.BINGO_PARTS \|\| \[\]\)\.push\('([^']+)'\);/g)].map(m => m[1]);
    if (reg.length !== 1 || reg[0] !== n) { registrationsOk = false; problems.push(`${file}: Anmeldung ${JSON.stringify(reg)}`); }
    const firstCode = code.split('\n').slice(0, 3).join('\n');
    if (!/^\/\/ ── js\//.test(firstCode) || !firstCode.includes('push(')) { registrationsOk = false; problems.push(`${file}: Kopfzeilen fehlen`); }
  }
  t.check('Jede Datei existiert, hat Kopfzeilen und meldet sich genau einmal unter ihrem eigenen Namen an.', registrationsOk, problems);
  const big = names.map(n => [n, lines(read(`js/${n}.js`))]).filter(([, c]) => c > 700);
  t.check('Keine JS-Datei hat mehr als 700 Zeilen (kein neuer Monolith).', big.length === 0, big);
  t.check('css/app.css existiert und enthält das Stylesheet.', fs.existsSync(path.join(ROOT, 'css/app.css')) && lines(read('css/app.css')) > 80);

  // ───────── 3) Service Worker + Manifest ─────────
  const assets = (sw.match(/const ASSETS = \[([^\]]*)\]/) || [])[1] || '';
  const inAssets = f => assets.includes(`'./${f}'`);
  t.check('Service Worker cacht index.html, css/app.css, bingo-data.js und jede js-Datei vorab (ASSETS).',
    inAssets('index.html') && inAssets('css/app.css') && inAssets('bingo-data.js') && jsFiles.every(inAssets), jsFiles.filter(f => !inAssets(f)));
  const missingAssets = [...assets.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(f => !fs.existsSync(path.join(ROOT, f)));
  t.check('ASSETS enthält keine Dateien, die es nicht gibt.', missingAssets.length === 0, missingAssets);
  const manifest = JSON.parse(read('manifest.json'));
  t.check('manifest.json: start_url zeigt auf index.html und beide Icons existieren.',
    manifest.start_url === './index.html' && manifest.icons.every(i => fs.existsSync(path.join(ROOT, i.src))), manifest);

  // ───────── 4) Start der App ─────────
  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  t.check('App startet ohne Ladefehler (keine Vorwärtsverweise zwischen den Dateien).', errors.length === 0, errors);
  t.check('Alle Teile haben sich angemeldet.', JSON.stringify(w.BINGO_PARTS) === JSON.stringify(names), w.BINGO_PARTS);
  t.check('Bei vollständiger App erscheint keine Warnung.', !d.getElementById('partsWarning'));

  // Unvollständige App: ein Teil fehlt -> sichtbare Warnung mit Namen des Teils
  const broken = await loadApp({ transformHtml: h => h.replace(/<script>\/\/ ── js\/03-spiel\.js[\s\S]*?<\/script>/, '<script></script>') });
  const warn = broken.document.getElementById('partsWarning');
  t.check('Fehlt ein Teil, erscheint eine sichtbare Warnung (role=alert) mit dem Namen des Teils.',
    !!warn && warn.getAttribute('role') === 'alert' && warn.textContent.includes('03-spiel'), warn && warn.textContent);
  t.finish();
})();
