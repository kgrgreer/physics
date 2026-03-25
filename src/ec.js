// TODO: insert comments here

const local          = true;  // true = local files; false = direct IAEA fetch
const baseUrl        = local ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const nubaseFilename = 'nubase_4.mas20.txt';
const ameFilename    = 'mass_1.mas20.txt';
const nubaseUrl      = baseUrl + nubaseFilename;
const ameUrl         = baseUrl + ameFilename;
const ameMap         = new Map();
const S              = 9.5e-18;            // s⁻¹ from paper
const NU             = 1e21;               // s⁻¹ assault frequency

let   he4Me;                               // to be extracted from ame database


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
// parseFixedWidthFile – generic parser for fixed-width files
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
  ['zzzi',        5,   8, parseInt], // Atoic Number
  ['aEl',        12,  16], // Element
  ['s',          17,  17], // s=m,n (isomers); s=p,q (levels); s=r (reonance); s=i,j (IAS);
  ['mass',       19,  31, parseFloat], // Mass Excess in keV
  ['dMass',      32,  42, parseFloat], // Mass Excess uncertainty in keV
  ['exc',        43,  54, parseFloat], // Isomer Excitation Energy in keV
  ['dE',         55,  65, parseFloat], // Isomer Excitation Energy uncertainty in keV
  ['t',          70,  78, s => s === 'stbl' ? 'stable' : s],
  ['unit',       79,  80, s => s.toLowerCase()],
  ['dT',         82,  88], // Half-life uncertainty
  ['jpi',        89, 102], // Sping and Parity
  ['ensdfYear', 103, 104], // Ensdf update year
  ['discovery', 115, 118], // year of discovery
  ['br',        120, 209], // decayModes

  // Filters
  ['isEC', 0, 0, (_, o) => { if ( o.br === 'EC=100' ) return true; throw 'skip'; }],
  ['badDT', 0, 0, (_, o) => { if ( o.dT > 0.6 ) throw 'skip'; }],

  // Virtual fields
  ['a', 0, 0, (_, o) => o.aaa ],
  ['source', 0, 0, () => 'NUBASE2020 + AME2020' ],
  ['z', 0, 0, (_, o) => o.zzzi != null ? Math.floor(o.zzzi / 10) : null],
  ['element', 0, 0, (_, o) => (o.aEl || '').match(/[A-Za-z]{1,2}$/)?.[0] ?? '??'],
  ['nuclide', 0, 0, (_, o) => o.element && o.aaa ? `${o.element}-${o.aaa}` : null],
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

    return Math.log10(o.halfLife) + Math.log10(factor);
  }],
 ['hl', 0, 0, (_, o) => { if ( o.halfLifeLog10 > 10 ) throw 'skip'; }],
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
  [
    'calcHalfLifeLog10', 0, 0, (_, o) => {
      return (
        - Math.log10(S) // Decay rate of the atom
        - 4.5 //  - Math.log10(S*NU)           // 4.5 is for the nuclear attack frequencey
        - 5             // but for electrons, the equivalent is 100,000 times slower
        - 2.5           // integrate from a solid 2D sphere to a fading 3D sphere
        * Math.log10(o.qAlphaMeV)
      );
    }
  ],
  [
    'error', 0, 0, (_, o) => {
      return Math.abs(o. calcHalfLifeLog10-o.halfLifeLog10).toFixed(2);
    }
  ],
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
async function main() {
  const status = document.createElement('p');
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

    console.log(`Found ${rows.length} qualifying isotopes`);

    const cols = ['a','z','qAlphaMeV', 'aEl', 's', 'mass', 'dMass', 'dT', 'nuclide','halfLife','unit','qAlphaMeV','halfLifeLog10',/*'decayModes',*/'calcHalfLifeLog10', 'error'];
    let csv = cols.join(',') + '\n';
    let html = '<table><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

    for ( let r of rows ) {
      csv  += cols.map(c => r[c] !== undefined ? r[c] : '').join(',') + '\n';
      html += '<tr>' + cols.map(c => `<td>${r[c] !== undefined ? r[c] : ''}</td>`).join('') + '</tr>';
    }

    status.textContent = `Done! ${rows.length} entries exported.`;

    html += '</table>';

    document.getElementById('table').innerHTML = html;
    document.getElementById('csv').innerText = csv;

    const avgError = rows.reduce((a, row) => a+parseFloat(row.error), 0);
    console.log('avg erro: ', avgError / rows.length);

    createScatterPlot(rows);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

// Run automatically
main();
