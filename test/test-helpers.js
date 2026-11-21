// ── test-helpers.js ─────────────────────────────────────────────────────────
// Gemeinsame Hilfsfunktionen für die Testdateien (gleiche Namen wie im Projekt rbf2027):
// loadApp() lädt index.html + Daten + css/js in ein frisches JSDOM, reloadWithState() simuliert
// einen Neustart, createChecker() zählt Prüfungen, createHelpers() bündelt kleine DOM-Helfer.

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

// Die Tests liegen in test/, die App eine Ebene darüber.
const ROOT = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');
const DEFAULT_DATA_PATH = path.join(ROOT, 'bingo-data.js');
// Die App initialisiert sich synchron beim Skript-Parsing; die Wartezeit ist nur eine Sicherheitsmarge.
const DEFAULT_INIT_DELAY_MS = 50;

/**
 * Lädt index.html + eine Datendatei (Standard: bingo-data.js) in ein frisches JSDOM.
 * @param {object} [opts]
 * @param {string} [opts.dataScript]   Eigener Daten-Code als String statt bingo-data.js
 * @param {string} [opts.dataPath]     Alternativer Pfad zur Datendatei
 * @param {function} [opts.transformHtml] Verändert das zusammengesetzte HTML vor dem Laden
 *     (z. B. um ein Skript wegzulassen und eine unvollständig geladene App zu simulieren)
 * @param {string} [opts.storage]      JSON-Text, der VOR dem Start in localStorage[bingo-v1] liegt
 * @param {number} [opts.initDelayMs]  Wartezeit nach dem Laden (ms)
 * @param {boolean} [opts.trackErrors] window-'error'-Events in .errors sammeln
 * @returns {Promise<{dom, window, document, errors: string[]}>}
 */
async function loadApp(opts = {}) {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const dataScript = opts.dataScript !== undefined
    ? opts.dataScript
    : fs.readFileSync(opts.dataPath || DEFAULT_DATA_PATH, 'utf-8');

  // Funktions-Replacer statt String: sonst würden "$&"/"$'"-Muster im Skript als Ersetzungsmuster missverstanden.
  const htmlForTest = html
    .replace(/<script src="bingo-data\.js"><\/script>/, () => `<script>${dataScript}</script>`)
    .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, f) => `<style>${fs.readFileSync(path.join(ROOT, f), 'utf-8')}</style>`)
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${fs.readFileSync(path.join(ROOT, f), 'utf-8')}</script>`);

  const errors = [];
  const vc = new VirtualConsole();
  vc.forwardTo(console);
  vc.on('jsdomError', e => errors.push(`jsdomError: ${e.message}`));

  const dom = new JSDOM(opts.transformHtml ? opts.transformHtml(htmlForTest) : htmlForTest, {
    url: 'https://example.github.io/bingo/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    // beforeParse läuft vor dem ersten Skript: so liegt ein vorbereiteter Speicherstand schon beim Start da
    beforeParse(window) {
      if (opts.storage !== undefined) window.localStorage.setItem('zugabe-v1', opts.storage);
    }
  });

  if (opts.trackErrors) {
    dom.window.addEventListener('error', e => errors.push(`window error: ${e.error ? e.error.message : e.message}`));
  }
  await new Promise(resolve => setTimeout(resolve, opts.initDelayMs ?? DEFAULT_INIT_DELAY_MS));
  return { dom, window: dom.window, document: dom.window.document, errors };
}

/**
 * Simuliert einen echten Neustart: neue, frische Instanz, die beim Start den localStorage-Stand
 * der alten Instanz vorfindet (läuft also durch denselben Ladeweg wie im Browser).
 */
async function reloadWithState(sourceWindow, opts = {}) {
  return loadApp({ ...opts, storage: sourceWindow.localStorage.getItem('zugabe-v1') ?? undefined });
}

/** Minimaler Check-Helfer: zählt Prüfungen, druckt OK/FEHLER und beendet mit passendem Exit-Code. */
function createChecker() {
  let pass = true;
  let count = 0;
  return {
    check(description, condition, details) {
      count++;
      if (condition) console.log(`OK: ${description}`);
      else { console.error(`FEHLER: ${description}`, details !== undefined ? details : ''); pass = false; }
      return condition;
    },
    get passed() { return pass; },
    get count() { return count; },
    finish() {
      console.log(pass ? `\n✅ ALLE ${count} PRÜFUNGEN BESTANDEN` : `\n❌ MINDESTENS EINE PRÜFUNG FEHLGESCHLAGEN (von ${count})`);
      process.exit(pass ? 0 : 1);
    }
  };
}

/** Kleine DOM-Helfer für eine geladene App-Instanz. */
function createHelpers(w, d) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const cells = () => [...d.querySelectorAll('#board .cell')];
  const cell = p => d.querySelector(`#board .cell[data-p="${p}"]`);
  const markedPositions = () => cells().filter(c => c.classList.contains('marked') && !c.classList.contains('free')).map(c => +c.dataset.p);
  const visible = el => !!el && el.style.display !== 'none' && !el.classList.contains('hidden');
  const modalOpen = id => d.getElementById(id).classList.contains('open');
  const openGameById = id => click(d.querySelector(`.game-card[data-id="${id}"]`));
  return { sleep, click, cells, cell, markedPositions, visible, modalOpen, openGameById };
}

module.exports = { ROOT, loadApp, reloadWithState, createChecker, createHelpers };
