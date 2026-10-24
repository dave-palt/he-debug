#!/usr/bin/env bun
// he-debug.mjs — debugger offline per le custom function di Header Editor
//
// Simula l'invocazione ESATTA dell'estensione (src/share/core/rule-utils.ts):
//     new Function('val', 'detail', 'util', code)
// con gli argomenti reali osservati nei call site (web-request-handler.ts):
//     redirect:  _func(url, detail, util)        -> return = nuova URL
//     headers:   _func(headersArray, detail, util) -> muta val in place
//
// Uso:  bun he-debug.mjs [urlDiProva]
//       (default: SAMPLE_URL qui sotto)

// ================= CONFIGURAZIONE — modifica qui =================
const RULE = {
  // 'modifySendHeader' | 'modifyReceiveHeader' | 'redirect' | 'cancel'
  ruleType: 'modifySendHeader',

  // Il filtro del campo "Match type: Regular expression" (come lo scrivi in HE)
  matchRegex: '^https://www\\.google\\.com',
  excludeRegex: '',

  // Il corpo della custom function, ESATTAMENTE come nell'editor di HE
  // (senza "function(...)" niente graffe di apertura/chiusura)
  code: `
const m = detail.url.match(/^https?:\\/\\/www\\.([^\\/:?#]+)/);
if (m) {
  const h = val.find(x => x.name.toLowerCase() === 'host');
  if (h) { h.value = m[1]; }
  else { val.push({ name: 'Host', value: String(m[1]) }); }
}
`,
};

const SAMPLE_URL = 'https://www.google.com/search?q=test';
const SAMPLE_METHOD = 'GET';
const SAMPLE_TYPE = 'main_frame'; // resource type: main_frame, xmlhttprequest, image...

// Header iniziali della richiesta simulata
const SAMPLE_HEADERS = [
  { name: 'Host', value: 'www.google.com' },
  { name: 'User-Agent', value: 'Mozilla/5.0 (X11; Linux x86_64) he-debug' },
  { name: 'Accept', value: '*/*' },
  { name: 'Accept-Language', value: 'en-US,en;q=0.9,it;q=0.8' },
];
// ================================================================

// util stub — nell'estensione reale (5.4.2+) c'è lodash + codec base64/testo
const getPath = (o, p) =>
  String(p).split(/[.[\]]+/).filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
const util = {
  _: {
    get: getPath,
    has: (o, p) => getPath(o, p) !== undefined,
    set: (o, p, v) => {
      const ks = String(p).split(/[.[\]]+/).filter(Boolean);
      let c = o;
      for (let i = 0; i < ks.length - 1; i++) c = c[ks[i]] ??= {};
      c[ks.at(-1)] = v;
      return o;
    },
    first: a => a?.[0],
    last: a => a?.[a?.length - 1],
    head: a => a?.[0],
    flatten: a => a.flat(),
    uniq: a => [...new Set(a)],
    clone: o => structuredClone(o),
    cloneDeep: o => structuredClone(o),
    pick: (o, ks) => Object.fromEntries(ks.map(k => [k, o[k]])),
    eq: (a, b) => a === b,
    isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  },
  atob: (enc, b64) => new TextDecoder(enc).decode(Buffer.from(b64, 'base64')),
  btoa: s => Buffer.from(s, 'utf-8').toString('base64'),
};

// detail con la stessa forma di makeDetails() in web-request-handler.ts
const buildDetail = url => ({
  id: 1,
  url,
  tab: 1,
  method: SAMPLE_METHOD,
  frame: 0,
  parentFrame: -1,
  proxy: null,
  type: SAMPLE_TYPE,
  time: Date.now(),
  originUrl: '',
  documentUrl: '',
  incognito: false,
  cookieStoreId: undefined,
  requestHeaders: null,
  responseHeaders: null,
  browser: 'chrome',
});

const url = process.argv[2] || SAMPLE_URL;
const C = { g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` };

console.log(`${C.b('Header Editor — debug harness')}`);
console.log(`${C.d('URL:')}    ${url}`);
console.log(`${C.d('Rule:')}   ${RULE.ruleType}  ${C.d(`match: /${RULE.matchRegex || '(nessuno)'}/`)}${RULE.excludeRegex ? C.d(`  exclude: /${RULE.excludeRegex}/`) : ''}`);

// --- 1. Filtro match: stessa logica di isMatchUrl() (RegExp con flag g, lastIndex azzerato) ---
let matchResult = 'MATCH';
if (RULE.matchRegex) {
  try {
    const reg = new RegExp(RULE.matchRegex, 'g');
    reg.lastIndex = 0;
    matchResult = reg.test(url) ? 'MATCH' : 'NOT_MATCH';
  } catch (e) {
    console.log(C.r(`✗ Regex del filtro invalida: ${e.message}`));
    process.exit(1);
  }
}
if (matchResult === 'MATCH' && RULE.excludeRegex) {
  matchResult = new RegExp(RULE.excludeRegex).test(url) ? 'EXCLUDE' : 'MATCH';
}

if (matchResult !== 'MATCH') {
  console.log(`Match:   ${matchResult === 'NOT_MATCH' ? C.r('✗ No match') : C.y('⊘ Excluded')} — la regola NON scatterebbe su questa URL (come in HE)`);
  process.exit(0);
}

// mostra i capture group del filtro (solo informativo: HE NON li passa alla funzione)
const filterMatch = RULE.matchRegex ? url.match(new RegExp(RULE.matchRegex)) : null;
console.log(`Match:   ${C.g('✓ Matched')}`);
if (filterMatch?.length > 1)
  console.log(`${C.d('Gruppi catturati dal filtro:')} ${JSON.stringify(filterMatch.slice(1))} ${C.d('(informativo — HE non li passa alla funzione)')}`);

// --- 2. Compilazione: identica a rule-utils.ts ---
let fn;
try {
  fn = new Function('val', 'detail', 'util', RULE.code);
} catch (e) {
  console.log(C.r(`✗ Errore di sintassi nella funzione: ${e.message}`));
  process.exit(1);
}

const detail = buildDetail(url);

// --- 3. Esecuzione con gli argomenti reali per tipo di regola ---
try {
  if (RULE.ruleType === 'redirect' || RULE.ruleType === 'cancel') {
    const r = fn(url, detail, util); // getRedirectUrl(): _func(redirectTo, detail, util)
    console.log('');
    if (r === '_header_editor_cancel_') console.log(C.r('Risultato: request CANCELLATA (_header_editor_cancel_)'));
    else if (typeof r === 'string') console.log(`${C.g('Redirect →')} ${r !== url ? C.g(r) : C.d('(nessuna modifica, return = URL invariata)')}`);
    else console.log(C.d('Risultato: nessun return → redirect invariato'));
  } else {
    const before = new Map(SAMPLE_HEADERS.map(h => [h.name, h.value]));
    const headers = structuredClone(SAMPLE_HEADERS);
    fn(headers, detail, util); // modifyHeaders(): _func(headers, detail, util), muta in place
    const after = new Map(headers.map(h => [h.name, h.value]));
    console.log('');
    let changes = 0;
    for (const [k, v] of after) {
      if (!before.has(k)) { console.log(`  ${C.g('+')} ${k}: ${v}`); changes++; }
      else if (before.get(k) !== v) { console.log(`  ${C.y('~')} ${k}: ${before.get(k)} ${C.d('→')} ${v}`); changes++; }
    }
    for (const k of before.keys()) {
      if (!after.has(k)) { console.log(`  ${C.r('-')} ${k} (rimosso)`); changes++; }
    }
    console.log(changes ? C.d(`(${changes} modifiche applicate)`) : C.d('(nessuna modifica agli header)'));
  }
} catch (e) {
  console.log(C.r(`✗ Errore a runtime nella funzione: ${e.message}`));
  console.log(C.d(e.stack?.split('\n').slice(1, 3).join('\n') ?? ''));
  process.exit(1);
}
