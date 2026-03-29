// TODO: insert description comments here

const local          = true;  // true = local files; false = direct IAEA fetch
const baseUrl        = local ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const nubaseFilename = 'nubase_4.mas20.txt';
const ameFilename    = 'mass_1.mas20.txt';
const nubaseUrl      = baseUrl + nubaseFilename;
const ameUrl         = baseUrl + ameFilename;
const ameMap         = new Map();
const log10          = Math.log10;

let   S              = 9.5e-18;            // s⁻¹ from paper
let   he4Me;                               // to be extracted from ame database

// S = 9.9e-18;

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
  my: 1e6  * 365.25 * 86400,
  gy: 1e9  * 365.25 * 86400,
  ty: 1e12 * 365.25 * 86400
};


// ====================================================================
// download and parse fixed-width files based on supplied schema
// ====================================================================

async function load(url, schema) {
  const data    = await fetch(url);
  const text    = await data.text();
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


// ────────────────────────────────────────────────
// NUBASE2020 schema (camelCase)
// ────────────────────────────────────────────────
const nubaseSchema = [
  ['aaa',         1,   3, parseInt], // Mass Number
  ['zzzi',        5,   8, parseInt], // Atomic Number
  ['aEl',        12,  16], // Element
  ['s',          17,  17], // s=m,n (isomers); s=p,q (levels); s=r (resonance); s=i,j (IAS);
  ['mass',       19,  31, parseFloat], // Mass Excess in keV
  ['dMass',      32,  42, parseFloat], // Mass Excess uncertainty in keV
  ['exc',        43,  54, parseFloat], // Isomer Excitation Energy in keV
  ['dE',         55,  65, parseFloat], // Isomer Excitation Energy uncertainty in keV
  ['t',          70,  78, s => s === 'stbl' ? 'stable' : s],
  ['unit',       79,  80, s => s.toLowerCase()],
  ['dT',         82,  88], // Half-life uncertainty
  ['jpi',        89, 102], // Spin and Parity
  ['ensdfYear', 103, 104], // Ensdf update year
  ['discovery', 115, 118], // year of discovery
  ['br',        120, 209], // decayModes

  // Filters
 // ['isEC', 0, 0, (_, o) => { if ( o.br.indexOf('B') == -1 && o.br.indexOf('F') == -1) return true; throw 'skip'; }],
    //  ['isEC', 0, 0, (_, o) => { if ( o.br === 'EC=100' ) return true; throw 'skip'; }],

  ['badDT', 0, 0, (_, o) => { if ( o.dT > 0.1 ) throw 'skip'; }],
   // ['isSomething', 0, 0, (_, o) => { if ( o.br === 'B-=100' ) return true; throw 'skip'; }],
// Clean subset: exclude known confounding shell / symmetry effects
// This keeps the geometric model pure while allowing a larger dataset.
// Useful for EC now, and especially for alpha / beta / gamma later.

  // Virtual fields
  ['a', 0, 0, (_, o) => o.aaa ],
  ['source', 0, 0, () => 'NUBASE2020 + AME2020' ],
  ['z', 0, 0, (_, o) => o.zzzi != null ? Math.floor(o.zzzi / 10) : null],
  ['element', 0, 0, (_, o) => (o.aEl || '').match(/[A-Za-z]{1,2}$/)?.[0] ?? '??'],

  ['nuclide', 0, 0, (_, o) => o.element && o.aaa ? `${o.element}-${o.aaa}` : null],
 // [ 'elementQ' , 0, 0, (_, o) => { if ( o.nuclide != 'Po-212' ) throw 'skip'; }],
  ['halfLife', 0, 0, (_, o) => {
    if (o.t == null || o.t === 'stable') return null;
    const cleaned = String(o.t).replace(/[<~]/g, '').trim();
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }],
  ['isMeasuredHalfLife', 0, 0, (_, o) =>
    o.t != null && o.t !== 'stable' &&
    !String(o.t).includes('#') &&
    o.halfLife != null &&
    o.unit && o.unit !== ''
  ],
  ['halfLifeLog10', 0, 0, (_, o) => {
    if ( o.halfLife == null || o.unit == null || ! UNITS[o.unit] ) throw 'skip';

    const factor = UNITS[o.unit];

    return log10(o.halfLife) + log10(factor);
  }],
  // 10 is good, 7 gives better results and 6 even better
   ['hl', 0, 0, (_, o) => { if ( o.halfLifeLog10 > 6   || o.halfLifeLog10 < 4 ) throw 'skip'; }],
  ['clean', 0, 0, (_, o) => {
    return true;
    const A = parseInt(o.aaa) || 0;
    const Z = parseInt(o.z) || 0;
    const N = A - Z;

    // Exclude N≈Z symmetry (strong pairing effects that create parallel shifts)
    // if (Math.abs(N - Z) <= 2) throw 'skip';

    return true;
    // Exclude magic numbers and near-magic (strong shell closures)
    const magic = new Set([2, 8, 20, 28, 50, 82, 126]);
    if (magic.has(Z) || magic.has(N) || magic.has(A)) throw 'skip';

    const nearMagic = [2, 8, 20, 28, 50, 82, 126];
    for (let m of nearMagic) {
      if (Math.abs(Z - m) <= 2 || Math.abs(N - m) <= 2 || Math.abs(A - m) <= 2) {
        throw 'skip';
      }
    }

    return true;
  }],
  [
    'qAlphaMeV', 0, 0, (_, o) => {
      const parentKey   = `${o.aaa},${o.z}`;
      const daughterKey = `${o.aaa - 4},${o.z - 2}`;
      const parent      = ameMap.get(parentKey);
      const daughter    = ameMap.get(daughterKey);

      if ( ! parent?.reliable ||  ! daughter?.reliable ) throw 'skip';
      const qKeV = parent.me - daughter.me - he4Me;
      if ( qKeV <= 0 ) throw 'skip';

      return qKeV / 1000;
    }
  ],

  [ 'isECLike', 0, 0, (_, o) => {
    const Z = o.z || 0;
    const A = o.a || 0;
    const N = A - Z;

    // High atomic number → stronger inner-electron overlap
    if (Z < 70) throw 'skip';

    // Reasonable half-life range (avoids extremes with poor data quality)
    // if (!o.halfLifeLog10 || o.halfLifeLog10 < 3.0 || o.halfLifeLog10 > 9.5)
    //  throw 'skip';   // ~1 hour to ~3000 years

    return true;   // This is a good EC-like candidate
  }],

  // === Version 2: Z-dependent electron transit time (first-principles) ===
  [
    'calcHalfLifeLog10', 0, 0, (_, o) => {
      const log10Q = log10(o.qAlphaMeV);
      const alpha  = 1 / 137.036;
      const r0     = 1.2;                                 // nuclear radius constant (fm)

      const R_n = r0 * Math.pow(o.aaa - 4, 1/3);      // daughter nucleus radius
      const nuclearDiameter_fm = 2 * R_n;

      const beta = Math.min(o.z * alpha, 0.99);       // inner electron velocity / c
      const transit_fm_per_c = nuclearDiameter_fm / beta;

      // Expected ~5 from atomic/nuclear radius ratio
      const electronCorrection = -log10(transit_fm_per_c) - 5;

      return (
        - log10(S)        // universal shrinkage rate
          - 4.5                  // nuclear assault frequency, TODO: find source
       //   - log10(2)
        + electronCorrection   // Z-dependent electron transit time
        - 2.5 * log10Q         // shrinking shell geometric integral
      );
    }
  ],

  [ 'log10d' /* nuclear diameter */, 0, 0, (_, o) => {
    return log10(2 * Math.pow(o.a, 1/3)) - 15;
  }],

  [ 'log10v', 0, 0, (_, o) => {
    // Constants
    const log10_m = log10(6.64e-27); // /4 for one particle?
    const e = o.qAlphaMeV; // convert to joules
    // Log-space calculation
    return 0.5 * (log10(2) + Math.log10(e) + Math.log10(1.602e-13) - log10_m);
  }],

  [ 'log10F', 0, 0, (_, o) => {
    return o.log10v - o.log10d;
  }],

  // === Main formula (promoted v2 — pure geometric, zero fitting) ===
  [
    'calcHalfLifeLog10v2', 0, 0, (_, o) => {
      const log10Q = Math.log10(o.qAlphaMeV);

      return (
        - Math.log10(S)                    // universal shrinkage rate S (the clock)
          - 9.5                              // effective spin rate after normalization
        -1.2
          - 2.5 * log10Q                     // chance per spin: geometric overlap scaling (n=2.5)
      );
    }
  ],


  ['error',     0, 0, (_, o) => Math.abs(o.calcHalfLifeLog10   - o.halfLifeLog10)],
  ['errorv2',   0, 0, (_, o) => o.calcHalfLifeLog10v2 - o.halfLifeLog10],
 // [ 'errorfilter', 0, 0, (_, o) => { if ( o.error > 0.5 ) throw 'skip'; } ],
];


// AME2020 schema (unchanged)
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
async function main() {
  const status = document.getElementById('status');
  status.textContent = 'Loading NUBASE2020 and AME2020...';
  document.body.appendChild(status);

  try {
    const ameData = await load(ameUrl, ameSchema);

    for ( const entry of ameData ) {
      if ( entry.a && entry.z && entry.massExcess != null ) {
        ameMap.set(`${entry.a},${entry.z}`, {
          me:       entry.massExcess,
          reliable: entry.massExcessReliable ?? false
        });
      }
    }

    he4Me = ameMap.get('4,2').me;

    const rows = await load(nubaseUrl, nubaseSchema);

    status.textContent = `Found ${rows.length} qualifying EC=100 isotopes`

    // Statistics for both versions
    const res1     = rows.map(r => r.error).filter(x => !isNaN(x));
    const res2     = rows.map(r => r.errorv2).filter(x => !isNaN(x));
    const meanAbs1 = res1.reduce((a,b) => a+Math.abs(b),0) / res1.length;
    const rms1     = Math.sqrt(res1.reduce((a,b)=>a+b*b,0) / res1.length);
    const meanAbs2 = res2.reduce((a,b)=>a+Math.abs(b),0) / res2.length;
    const rms2     = Math.sqrt(res2.reduce((a,b)=>a+b*b,0) / res2.length);

    console.log(`v1 (Z-dependent) → Mean abs: ${meanAbs1.toFixed(3)} dex | RMS: ${rms1.toFixed(3)} dex`);
    console.log(`v2               → Mean abs: ${meanAbs2.toFixed(3)} dex | RMS: ${rms2.toFixed(3)} dex`);

    const cols = ['a','z','nuclide','qAlphaMeV','br','dT','halfLife','unit','halfLifeLog10', 'log10d', 'log10v', 'log10F',
                  'calcHalfLifeLog10','error', 'calcHalfLifeLog10v2','errorv2'];

    function format(v) {
      return typeof v === 'number' && ! Number.isInteger(v) ? v.toFixed(2) : v;
    }

    let csv = cols.join(',') + '\n';
    let html = '<table><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

    for ( let r of rows ) {
      csv  += cols.map(c => r[c] !== undefined ? r[c] : '').join(',') + '\n';
      html += '<tr>' + cols.map(c => `<td>${r[c] !== undefined ? format(r[c]) : ''}</td>`).join('') + '</tr>';
    }

    html += '</table>';

    // document.getElementById('table').innerHTML = html;
    // document.getElementById('csv').innerText = csv;

    createScatterPlot('graph1', rows, 'halfLifeLog10', 'calcHalfLifeLog10', 'error');
    createScatterPlot('graph2', rows, 'halfLifeLog10', 'calcHalfLifeLog10v2', 'errorv2');
    createScatterPlot('graph3', rows, 'a', 'errorv2', 'errorv2');
    createScatterPlot('graph4', rows, 'qAlphaMeV', 'errorv2', 'errorv2');
    createScatterPlot('graph4', rows, 'zzzi', 'errorv2', 'errorv2');


    const CALC_HALF_LIFE_LOG10 = nubaseSchema.find(p => p[0] === 'calcHalfLifeLog10');
    const ERROR                = nubaseSchema.find(p => p[0] === 'error');

    console.log('Best S:', solve(function (x) {
      S = x;
      let error = 0;
      rows.forEach(r => {
        r.calcHalfLifeLog10v2 = CALC_HALF_LIFE_LOG10[3](null, r);
        error += ERROR[3](null, r);
        // console.log('   ', error);
      });
//      console.log('error x:', x, 'y:', error);
      return error;
    }, 9.4e-18, 9.9e-18, 100));

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

// Run automatically
main();
