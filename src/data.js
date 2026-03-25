// alpha-emitters-extractor.js
// Generates CSV of ground-state alpha emitters from NUBASE2020 + AME2020
// Browser-only; run via button or directly

const local          = true;  // true = local files; false = direct IAEA fetch

const baseUrl        = local ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const nubaseFilename = 'nubase_4.mas20.txt';
const ameFilename    = 'mass_1.mas20.txt';

const nubaseUrl      = baseUrl + nubaseFilename;
const ameUrl         = baseUrl + ameFilename;

const ameMap         = new Map();

const S              = 9.5e-18;            // s⁻¹ from paper
const tauVib         = 1e-21;              // s
const nu             = 1e21;               // s⁻¹ assault frequency
const prefactor      = 50;                 // Gamow scaling constant

// Add this constant near the top with your other constants
const R0 = 1.2;                    // nuclear radius constant in fm (standard value)

let   he4Me;


// Use Decimal for precision
// 40 digits ensures exact Q-value differences and log-ratio residuals
// stay stable across ~100–200 isotope calculations. Half-life exponents
// are already modest (<150), so precision floor is driven by Q-value keV
// differentials, not decay-rate asymptotic behavior.
const D = Decimal;
D.set({ precision: 40 });


// ====================================================================
// parseFixedWidthFile – generic parser for fixed-width files
// ====================================================================
function parseFixedWidthFile(text, schema) {
  const lines   = text.split('\n');
  const results = [];

  for ( let line of lines ) {
    if ( ! line.trim() || line.startsWith('#') ) continue;

    const obj = {};

    try {
      for ( const entry of schema ) {
        const [key, start, end, parser = s => s] = entry;

        const raw     = line.slice(start - 1, end);
        const trimmed = raw.trim();

        obj[key] = parser(trimmed, obj);
      }

      results.push(obj);
    } catch (x) {
      console.log('skipping: ', x);
      // silently skip bad lines
    }
  }

  return results;
}


// ====================================================================
// Declarative unit conversion map (in seconds)
// ====================================================================

const UNITS = {
  ps: 1e-12,
  ns: 1e-9,
  us: 1e-6,
  μs: 1e-6,
  ms: 1e-3,
  s:  1,
  m:  60,
  h:  3600,
  d:  86400,
  y:  365.25 * 86400,
  ky: 1000 * 365.25 * 86400,
  my: 1e6 * 365.25 * 86400,
  gy: 1e9 * 365.25 * 86400,
  ty: 1e12 * 365.25 * 86400
};


// ====================================================================
// calculateDecayRatePaperModel – uses halfLifeLog10
// ====================================================================

function calculateDecayRatePaperModelOld(A, Z, halfLifeLog10, qAlphaMeV) {
  const zD             = new D(Z - 2);
  const q              = new D(qAlphaMeV);
  const log10P         = new D(50).times(zD).div(q.sqrt()).neg();
  const log10Unlocking = new D("9.5e-39").log(10);
  const log10Nu        = new D(21);
  const log10Lambda    = log10Nu.plus(log10P).plus(log10Unlocking);
  const log10THalfPred = new D(Math.log(2)).log(10).minus(log10Lambda);
  const logResidual    = new D(halfLifeLog10).minus(log10THalfPred).toFixed(3);

  return {
//    A,
//    Z,
    zD:                zD.toNumber(),
    log10P:            log10P.toFixed(6),
    log10Lambda:       log10Lambda.toFixed(6),
    predHalfLifeLog10: log10THalfPred.toFixed(6),
    logResidual:       logResidual
  };
}


/**
 * calculateDecayRatePaperModel
 *
 * Computes predicted log10(half-life) using:
 * - Universal drift rate S (passed in)
 * - Size-dependent nuclear radius R = r0 * A^{1/3}
 * - Consistent size-dependent vibration period τ_vib ∝ R
 * - Assault frequency ν = 1 / τ_vib
 */
function calculateDecayRatePaperModeMediuml(S, A, Z, halfLifeLog10, qAlphaMeV) {
  if (typeof qAlphaMeV !== 'number' || qAlphaMeV <= 0) { debugger; return { error: "Invalid qAlphaMeV" }; }
  if (typeof Z !== 'number' || Z < 2) { debugger; return { error: "Invalid Z" }; }
  if (typeof halfLifeLog10 !== 'number') { debugger; return { error: "Invalid halfLifeLog10" }; }
  if (typeof S !== 'number' || S <= 0) { debugger; return { error: "Invalid S" }; }

  const zD = new D(Z - 2);
  const q  = new D(qAlphaMeV);

  // ================================================================
  // 1. Nuclear radius R = r0 × A^{1/3} fm
  // ================================================================
  const r0 = 1.2;                                           // standard nuclear radius constant (fm)
  const R  = new D(r0).times(new D(A).pow(1/3));            // nuclear radius in fm

  // ================================================================
  // 2. Size-dependent vibration period and assault frequency
  //    Both scale with nuclear size for physical consistency
  // ================================================================
  const tauVib0 = 1e-21;                                    // reference vibration period for a typical nucleus
  const tauVib  = new D(tauVib0).times(R);                  // τ_vib ∝ R  → longer for larger nuclei

  const assaultFrequency = new D(1).div(tauVib);            // ν = 1 / τ_vib

  // ================================================================
  // 3. Universal unlocking factor = S × τ_vib(R)
  //    This is the core "one clock" mechanism
  // ================================================================
  const unlockingPerVibration = new D(S).times(tauVib);     // probability drift per vibration
  const log10Unlocking = unlockingPerVibration.log(10);

  // ================================================================
  // 4. Gamow tunneling probability
  // ================================================================
  const log10P = new D(50).times(zD).div(q.sqrt()).neg();

  // ================================================================
  // 5. Combine everything in log space
  // ================================================================
  const log10Nu        = assaultFrequency.log(10);
  const log10Lambda    = log10Nu.plus(log10P).plus(log10Unlocking);

  const log10THalfPred = new D(Math.log(2)).log(10).minus(log10Lambda);

  const logResidual    = new D(halfLifeLog10).minus(log10THalfPred).toFixed(3);

  return {
    A,
    Z,
    zD:                zD.toNumber(),
    log10P:            log10P.toFixed(2),
    log10Lambda:       log10Lambda.toFixed(2),
    predHalfLifeLog10: log10THalfPred.toFixed(2),
    logResidual:       logResidual,
    note:              `S = ${S}, ν(R) and τ_vib(R) consistent`
  };
}

function calculateDecayRatePaperModel(S, A, Z, halfLifeLog10, qAlphaMeV) {
  if (typeof qAlphaMeV !== 'number' || qAlphaMeV <= 0) debugger;
  if (typeof Z !== 'number' || Z < 2) debugger;
  if (typeof halfLifeLog10 !== 'number') debugger;

  const zD = new D(Z - 2);
  const q  = new D(qAlphaMeV);

  // ================================================================
  // Use daughter radius for the outer shell / surface layer
  // (this is where the alpha is actually preformed)
  // ================================================================
  const r0 = 1.2;                                           // fm
  const effectiveA = A - 4;                                 // daughter mass number
  const R_outer = new D(r0).times(new D(effectiveA).pow(1/3));

  // ================================================================
  // Size-dependent vibration dynamics (now based on outer shell)
  // ================================================================
  const tauVib0 = 1e-21;
  const tauVib  = new D(tauVib0).times(R_outer);            // τ_vib ∝ R_outer

  const assaultFrequency = new D(1).div(tauVib);            // ν = 1 / τ_vib

  // ================================================================
  // Universal unlocking (the single clock)
  // ================================================================
  const unlockingPerVibration = new D(S).times(tauVib);
  const log10Unlocking = unlockingPerVibration.log(10);

  // ================================================================
  // Gamow tunneling (unchanged)
  // ================================================================
  const log10P = new D(1/*50*/).times(zD).div(q.sqrt()).neg();

  // ================================================================
  // Combine
  // ================================================================
  const log10Nu = assaultFrequency.log(10);
  const log10Lambda = log10Nu.plus(log10P).plus(log10Unlocking).plus(6+Math.pow(2.5,4));

  console.log('Nu', log10Nu.toFixed(4), 'P', log10P.toFixed(4), 'unlocking', log10Unlocking.toFixed(4));

  const log10THalfPred = new D(Math.log(2)).log(10).minus(log10Lambda);

  const logResidual = new D(halfLifeLog10).minus(log10THalfPred).toFixed(3);

  return {
    A,
    Z,
    zD:                zD.toNumber(),
    log10P:            log10P.toFixed(8),
    log10Lambda:       log10Lambda.toFixed(8),
    predHalfLifeLog10: log10THalfPred.toFixed(8),
    logResidual:       logResidual,
    note:              `Outer-shell radius (daughter A-4), S = ${S}`
  };
}


// ────────────────────────────────────────────────
// NUBASE2020 schema (camelCase)
// ────────────────────────────────────────────────
const nubaseSchema = [
  ['aaa',         1,   3, parseInt],
  ['zzzi',        5,   8, parseInt],
  ['aEl',        12,  16],
  ['s',          17,  17],
  ['mass',       19,  31, parseFloat],
  ['dMass',      32,  42, parseFloat],
  ['exc',        43,  54, parseFloat],
  ['dE',         55,  65, parseFloat],
  ['t',          70,  78, s => s === 'stbl' ? 'stable' : s],
  ['unitT',      79,  80, s => s.toLowerCase()],
  ['dT',         82,  88],
  ['jpi',        89, 102],
  ['ensdfYear', 103, 104],
  ['discovery', 115, 118],
  ['br',        120, 209],

  // Virtual fields
  ['z', 0, 0, (_, o) => o.zzzi != null ? Math.floor(o.zzzi / 10) : null],
  ['isGroundState', 0, 0, (_, o) => o.zzzi != null && o.zzzi % 10 === 0],
  ['element', 0, 0, (_, o) => (o.aEl || '').match(/[A-Za-z]{1,2}$/)?.[0] ?? '??'],
  ['nuclide', 0, 0, (_, o) => o.element && o.aaa ? `${o.element}-${o.aaa}` : null],
  ['halfLifeValue', 0, 0, (_, o) => {
    if (o.t == null || o.t === 'stable') return null;
    const cleaned = String(o.t).replace(/[<~]/g, '').trim();
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }],
  ['hasAlphaDecay', 0, 0, (_, o) => !!o.br && /A=|\bα\b|AD/i.test(o.br)],
  ['isMeasuredHalfLife', 0, 0, (_, o) =>
    o.t != null && o.t !== 'stable' &&
    !String(o.t).includes('#') &&
    o.halfLifeValue != null &&
    o.unitT && o.unitT !== ''
  ],
  ['isHeavyAlphaCandidate', 0, 0, (_, o) =>
    o.isGroundState && o.aaa >= 100 && o.hasAlphaDecay && o.isMeasuredHalfLife
  ],

  // halfLifeLog10
  ['halfLifeLog10', 0, 0, (_, o) => {
    if ( o.halfLifeValue == null || o.unitT == null || ! UNITS[o.unitT] ) throw 'skip';

    const factor = UNITS[o.unitT];

    return Math.log10(o.halfLifeValue) + Math.log10(factor);
  }],

  [
    'qAlphaMeV', 0, 0, (_, o) => {
      const parentKey   = `${o.aaa},${o.z}`;
      const daughterKey = `${o.aaa - 4},${o.z - 2}`;

      const parent   = ameMap.get(parentKey);
      const daughter = ameMap.get(daughterKey);

      if (!parent?.reliable || !daughter?.reliable) throw 'skip';
      const qKeV = parent.me - daughter.me - he4Me;
      if (qKeV <= 0) throw 'skip';

      return (qKeV / 1000).toFixed(5);
    }
  ],

  [
    'calcHalfLifeLog10', 0, 0, (_, o) => {
      const a = o.aaa;
      const z = o.z;
      const halfLifeLog10 = o.halfLifeLog10;
      const qAlphaMeV = parseFloat(o.qAlphaMeV);

      const r = calculateDecayRatePaperModel(S, a, z, halfLifeLog10, qAlphaMeV);

      if (o.nuclide === 'U-238') {
        console.log('U-238 debug:', r);
      }

      return r.predHalfLifeLog10;
    }
  ]
];

// AME2020 schema (camelCase)
const ameSchema = [
  ['cc',           1,   1],
  ['nz',           2,   4, parseInt],
  ['n',            5,   9, parseInt],
  ['z',           10,  14, parseInt],
  ['a',           15,  19, parseInt],
  ['el',          21,  23],
  ['o',           24,  27],
  ['massExcess',  29,  42, parseFloat],
  ['massUnc',     43,  54, parseFloat],
  ['bindingA',    56,  68, parseFloat],
  ['bindingUnc',  69,  78, parseFloat],
  ['betaMode',    80,  81],
  ['betaQ',       82,  94, parseFloat],
  ['betaUnc',     95, 105, parseFloat],
  ['flag',       107, 109, parseInt],
  ['atomicMassUu', 111, 123, parseFloat],
  ['atomicUnc',    124, 135, parseFloat],

  ['nuclide', 0, 0, (_, o) => o.el && o.a ? `${o.el.trim()}-${o.a}` : null],
  ['massExcessReliable', 0, 0, (_, o) => {
    if (o.massExcess == null || Number.isNaN(o.massExcess) || o.massUnc == null || Number.isNaN(o.massUnc)) return false;
    return !o.massExcess.toString().includes('#');
  }]
];


// ────────────────────────────────────────────────
// Main function
// ────────────────────────────────────────────────
async function generateAlphaEmittersCSV() {
  const status = document.createElement('p');
  status.textContent = 'Loading NUBASE2020 and AME2020...';
  document.body.appendChild(status);

  try {
    const [nubaseResp, ameResp] = await Promise.all([
      fetch(nubaseUrl),
      fetch(ameUrl)
    ]);

    if ( ! nubaseResp.ok || ! ameResp.ok ) throw new Error('Fetch failed');

    const ameText    = await ameResp.text();
    const ameData    = parseFixedWidthFile(ameText, ameSchema);

    for ( const entry of ameData ) {
      if ( entry.a && entry.z && entry.massExcess != null ) {
        ameMap.set(`${entry.a},${entry.z}`, {
          me:       entry.massExcess,
          reliable: entry.massExcessReliable ?? false
        });
      }
    }

    he4Me = ameMap.get('4,2').me;

    const nubaseText = await nubaseResp.text();
    const nubaseData = parseFixedWidthFile(nubaseText, nubaseSchema);
    const rows       = [];

    // TODO: remove this, make virtual fields / filters
    for ( const data of nubaseData ) {
      if ( ! data.isHeavyAlphaCandidate ) continue;

      if ( data.br.indexOf(';') != -1 ) continue;

      rows.push({
        ...data,
        a:           data.aaa,
        z:           data.z,
        nuclide:     data.nuclide,
        halfLife:    data.halfLifeValue,
        unit:        data.unitT,
        halfLifeLog10: data.halfLifeLog10,
        qAlphaMeV:   data.qAlphaMeV,
        decayModes:  data.br?.slice(0, 60) || '',
        source:      'NUBASE2020 + AME2020',
        calcHL:      data.calcHL
      });
    }

    console.log(`Found ${rows.length} qualifying ground-state alpha emitters`);

    const cols = ['a','z','nuclide',/*'halfLife','unit',*/'qAlphaMeV','halfLifeLog10',/*'decayModes',*/'calcHalfLifeLog10'];
    let csv = cols.join(',') + '\n';
    let html = '<table><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

    for (let r of rows) {
      if (r.nuclide === 'U-238') console.log('U-238 debug:', r);

      csv += cols.map(c => r[c] !== undefined ? r[c] : '').join(',') + '\n';
      html += '<tr>' + cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('') + '</tr>';
    }

    status.textContent = `Done! ${rows.length} entries exported.`;

    html += '</table>';

    document.getElementById('table').innerHTML = html;
    document.getElementById('csv').innerText = csv;

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

// Run automatically
generateAlphaEmittersCSV();
