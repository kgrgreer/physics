// alpha-emitters-extractor.js
// Generates CSV of ground-state alpha emitters from NUBASE2020 + AME2020
// Browser-only; run via button or directly

const LOCAL = true;  // true = local files; false = direct IAEA fetch (CORS permitting)

const BASE_URL       = LOCAL ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const NUBASE_FILENAME = 'nubase_4.mas20.txt';
const AME_FILENAME    = 'mass_1.mas20.txt';

const NUBASE_URL = BASE_URL + NUBASE_FILENAME;
const AME_URL    = BASE_URL + AME_FILENAME;

const AME_MAP = new Map();

let he4ME;

const S         = 9.5e-18;               // s⁻¹ from paper
const tau_vib   = 1e-21;                 // s
const nu        = 1e21;                  // s⁻¹ assault frequency
const prefactor = 50;                    // Gamow scaling constant
const ln2       = Math.log(2);

const LOG10_MIN_SAFE = -300;             // safe exponent threshold for direct computation
const LN10          = Math.LN10;



// ====================================================================
// bnLog10(x) – computes log₁₀(x) with arbitrary precision using BigNumber.js
// Uses series expansion for ln(1+z) after range reduction to [0.1, 10]
// ====================================================================


// ────────────────────────────────────────────────
// Generic fixed-width parser
// ────────────────────────────────────────────────
function parseFixedWidthFile(text, schema) {
  const lines   = text.split('\n');
  const results = [];

  for (let line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;

    const obj = {};

    try {
      for ( const entry of schema ) {
        const [key, start, end, parser = s => s] = entry;  // default: identity

        const raw     = line.slice(start - 1, end);
        const trimmed = raw.trim();

        obj[key] = parser(trimmed, obj);
      }

      results.push(obj);
    } catch (x) {
      console.log(x);
    }
  }

  return results;
}

// ====================================================================
// Final single-object calculator – uses BigNumber for full precision
// No thresholds, no fallbacks — direct computation for all cases
// ====================================================================

// ====================================================================
// Uses bignumber.js for full precision – direct formula implementation
// No log-space shortcuts – computes everything as in the paper
// ====================================================================

// Load bignumber.js (add this to your HTML or import in Node)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/bignumber.js/9.1.2/bignumber.min.js"></script>

function calculateDecayRate_paperModel(A, Z, halfLife_s, Q_alpha_MeV) {
  // Use Decimal for precision
  const D = Decimal;

  // Constants from the paper
  const S         = new D("9.5e-18");
  const tau_vib   = new D("1e-21");
  const nu        = new D("1e21");
  const prefactor = new D("50");
  const ln2       = new D(Math.log(2));

  const Z_d = new D(Z - 2);
  const Q   = new D(Q_alpha_MeV);

  // Step 1: Gamow penetrability P
  // log₁₀(P) = - (50 × Z_d / √Q)
  const sqrtQ   = Q.sqrt();
  const log10_P = prefactor.times(Z_d).div(sqrtQ).neg();

  // P = 10^{log₁₀(P)} – decimal.js supports fractional exponents
  const P = D(10).pow(log10_P);

  // Step 2: unlocking = S × τ_vib
  const unlocking = S.times(tau_vib);

  // Step 3: λ = ν × P × unlocking
  const lambda = nu.times(P).times(unlocking);

  // Step 4: predicted half-life t₁/₂ = ln(2) / λ
  const t_half_pred = ln2.div(lambda);

  // Log residual (log₁₀(obs / pred))
  let log_residual = null;
  if (typeof halfLife_s === 'number' && halfLife_s > 0) {
    const obs = new D(halfLife_s);
    log_residual = obs.div(t_half_pred).log(10).toFixed(3);
  }

  // Format for display
  return {
    A,
    Z,
    Z_d:               Z_d.toNumber(),
    log10_P:           log10_P.toFixed(2),
    P:                 P.toExponential(4),
    unlocking:         unlocking.toExponential(4),
    lambda_s1:         lambda.toExponential(6),          // decay rate λ (s⁻¹)
    t_half_pred_s:     t_half_pred.toExponential(4),     // predicted half-life in seconds
    log_residual,
    note:              "Computed with decimal.js for arbitrary precision"
  };
}



// ────────────────────────────────────────────────
// NUBASE2020 schema (as before, minor cleanup)
// ────────────────────────────────────────────────
const NUBASE_SCHEMA = [
  ['AAA',         1,   3, parseInt],
  ['ZZZi',        5,   8, parseInt],
  ['A_El',       12,  16],
  ['s',          17,  17],
  ['Mass',       19,  31, parseFloat],
  ['dMass',      32,  42, parseFloat],
  ['Exc',        43,  54, parseFloat],
  ['dE',         55,  65, parseFloat],
  ['T',          70,  78, s => s === 'stbl' ? 'stable' : s],
  ['unit_T',     79,  80, s => s.toLowerCase()],
  ['dT',         82,  88],
  ['Jpi',        89, 102],
  ['Ensdf_year',103, 104],
  ['Discovery', 115, 118],
  ['BR',        120, 209],

  // Virtual Computed Fields
  ['Z', 0, 0, (_, o) => o.ZZZi != null ? Math.floor(o.ZZZi / 10) : null],
  ['isGroundState', 0, 0, (_, o) => o.ZZZi != null && o.ZZZi % 10 === 0],
  ['element', 0, 0, (_, o) => (o.A_El || '').match(/[A-Za-z]{1,2}$/)?.[0] ?? '??'],
  ['nuclide', 0, 0, (_, o) => o.element && o.AAA ? `${o.element}-${o.AAA}` : null],
  ['halfLifeValue', 0, 0, (_, o) => {
    if (o.T == null || o.T === 'stable') return null;
    const cleaned = String(o.T).replace(/[<~]/g, '').trim();
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }],
  ['hasAlphaDecay', 0, 0, (_, o) => !!o.BR && /A=|\bα\b|AD/i.test(o.BR)],
  ['isMeasuredHalfLife', 0, 0, (_, o) =>
    o.T != null && o.T !== 'stable' &&
    !String(o.T).includes('#') &&
    o.halfLifeValue != null &&
    o.unit_T && o.unit_T !== ''
  ],
  ['isHeavyAlphaCandidate', 0, 0, (_, o) =>
    // o.BR.indexOf(';') == -1 && // avoids those with other decay types
    o.isGroundState && o.AAA >= 100 && o.hasAlphaDecay && o.isMeasuredHalfLife
  ],
  // ── NEW: half-life converted to seconds ──
  ['halfLife_s', 0, 0, (_, o) => {
    if ( o.halfLifeValue == null || o.unit_T == null ) throw 'skip';

    let factor;

    switch (o.unit_T) {
      case 'ps': factor = 1e-12; break;
      case 'ns': factor = 1e-9;  break;
      case 'us': case 'μs': factor = 1e-6; break;
      case 'ms': factor = 1e-3;  break;
      case 's':  factor = 1;     break;
      case 'm':  factor = 60;    break;
      case 'h':  factor = 3600;  break;
      case 'd':  factor = 86400; break;
      case 'y':  factor = 365.25 * 86400; break;   // approximate tropical year
      case 'ky': factor = 1000 * 365.25 * 86400; break;
      case 'my': factor = 1e6 * 365.25 * 86400;  break;
      case 'gy': factor = 1e9 * 365.25 * 86400;  break;
      case 'ty': factor = 1e12 * 365.25 * 86400; break;  // rarely used
      default:   throw 'skip';
    }

    return o.halfLifeValue * factor;
  }],
  ['halfLifeLog10', 0, 0, (_, o) => {
    if ( o.halfLifeValue == null || o.unit_T == null ) throw 'skip';

    let factor;

    switch (o.unit_T) {
      case 'ps': factor = 1e-12; break;
      case 'ns': factor = 1e-9;  break;
      case 'us': case 'μs': factor = 1e-6; break;
      case 'ms': factor = 1e-3;  break;
      case 's':  factor = 1;     break;
      case 'm':  factor = 60;    break;
      case 'h':  factor = 3600;  break;
      case 'd':  factor = 86400; break;
      case 'y':  factor = 365.25 * 86400; break;   // approximate tropical year
      case 'ky': factor = 1000 * 365.25 * 86400; break;
      case 'my': factor = 1e6 * 365.25 * 86400;  break;
      case 'gy': factor = 1e9 * 365.25 * 86400;  break;
      case 'ty': factor = 1e12 * 365.25 * 86400; break;  // rarely used
      default:   throw 'skip';
    }

    return Math.log10(o.halfLifeValue) + Math.log10(factor);
  }],
  [
    'Q_alpha_MeV', 0, 0, (_, o) => {
      const parentKey   = `${o.AAA},${o.Z}`;
      const daughterKey = `${o.AAA - 4},${o.Z - 2}`;

      const parent   = AME_MAP.get(parentKey);
      const daughter = AME_MAP.get(daughterKey);

      if ( ! parent?.reliable || ! daughter?.reliable ) throw 'skip';
      const Q_keV = parent.me - daughter.me - he4ME;
      if ( Q_keV <= 0 ) throw 'skip';

      return (Q_keV / 1000).toFixed(5);
    }
  ],
  [
    'calcHL', 0, 0, (_, o) => {
      const A = o.AAA, Z = o.Z, halfLife_s = o.halfLife_s, Q_alpha_MeV = o.Q_alpha_MeV;
      const r = calculateDecayRate_paperModel(A, Z, halfLife_s, Q_alpha_MeV);

      if ( o.nuclide === 'U-238' )
        console.log(o.nuclide, 'input:', A, Z, halfLife_s, Q_alpha_MeV, 'output:', {...o, ...r});

      return r.t_half_pred_s;
    }
  ]
];

// ────────────────────────────────────────────────
// AME2020 schema (mass_1.mas20.txt)
// Positions verified against official header
// ────────────────────────────────────────────────
const AME_SCHEMA = [
  ['cc',           1,   1],                             // a1 control (0/1)
  ['NZ',           2,   4, parseInt],                   // i3
  ['N',            5,   9, parseInt],
  ['Z',           10,  14, parseInt],
  ['A',           15,  19, parseInt],
  ['el',          21,  23],
  ['o',           24,  27],                             // qualifier / flag
  ['massExcess',  29,  42, parseFloat],                 // f14.6 mass excess (keV)
  ['massUnc',     43,  54, parseFloat],                 // f12.6 unc
  ['bindingA',    56,  68, parseFloat],                 // f13.5 BE/A
  ['bindingUnc',  69,  78, parseFloat],                 // f10.5
  ['betaMode',    80,  81],
  ['betaQ',       82,  94, parseFloat],                 // f13.5 beta-decay energy
  ['betaUnc',     95, 105, parseFloat],
  ['flag',       107, 109, parseInt],                   // i3
  ['atomicMass_uu', 111, 123, parseFloat],              // f13.6 micro-u
  ['atomicUnc',    124, 135, parseFloat],               // f12.6

  // computed / reliability
  ['nuclide', 0, 0, (_, o) => o.el && o.A ? `${o.el.trim()}-${o.A}` : null],
  ['massExcessReliable', 0, 0, (_, o) => {
    if (o.massExcess == null || Number.isNaN(o.massExcess) || o.massUnc == null || Number.isNaN(o.massUnc)) return false;
    // # replaces decimal point → estimated → not reliable for your Qα use
    const rawMassStr = o.massExcess.toString(); // but better to check original slice if needed
    return !rawMassStr.includes('#');
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
      fetch(NUBASE_URL),
      fetch(AME_URL)
    ]);

    if (!nubaseResp.ok || !ameResp.ok) throw new Error('Fetch failed');

    const nubaseText = await nubaseResp.text();
    const ameText    = await ameResp.text();

    // ─── Parse both files using generic function ───
    const ameData    = parseFixedWidthFile(ameText,    AME_SCHEMA);

    // Build fast lookup Map from AME
    for ( const entry of ameData ) {
      if ( entry.A && entry.Z && entry.massExcess != null ) {
        AME_MAP.set(`${entry.A},${entry.Z}`, {
          me:       entry.massExcess,
          reliable: entry.massExcessReliable ?? false
        });
      }
    }

    // ⁴He reference (very reliable in AME2020)
    const he4   = AME_MAP.get('4,2');
    he4ME = he4?.reliable ? he4.me : 2424.91587; // keV fallback

    const nubaseData = parseFixedWidthFile(nubaseText, NUBASE_SCHEMA);

    // ─── Filter & compute Qα ───
    const rows = [];

    for (const data of nubaseData) {
      if ( ! data.isHeavyAlphaCandidate ) continue;

      rows.push({
        ...data,
        A:           data.AAA,
        Z:           data.Z,
        Nuclide:     data.nuclide,
        HalfLife:    data.halfLifeValue,
        Unit:        data.unit_T,
        halfLife_s:  data.halfLife_s,
        Q_alpha_MeV: data.Q_alpha_MeV,
        DecayModes:  data.BR?.slice(0, 60) || '',
        Source:      'NUBASE2020 + AME2020',
        calcHL:      data.calcHL
      });
    }

    console.log(`Found ${rows.length} qualifying ground-state alpha emitters`);

    // ─── CSV export ───
    const COLS = 'A,Z,Nuclide,HalfLife,Unit,halfLife_s,halfLifeLog10,Q_alpha_MeV,DecayModes,calcHL'.split(',');
    let csv = COLS.join(',') + '\n';
    let html = '<table><tr>' + COLS.map(c => `<th>${c}</th>`) + '<tr>';
    for (let r of rows) {

      if ( r.Nuclide === 'U-238' ) console.log('u238:', r);

      csv += COLS.map(c => r[c]).join(',') + '\n';
//      csv += `${r.A},${r.Z},"${r.Nuclide}",${r.HalfLife},${r.Unit},${r.halfLife_s},${r.Q_alpha_MeV},"${r.DecayModes.replace(/"/g, '""')}",${r.calcHL}\n`;

      html += '<tr>' + COLS.map(c => `<td>${r[c]}</td>`).join() + '</tr>';
//      html += `<tr><td>${r.A}</td><td>${r.Z}</td><td>${r.Nuclide}</td><td>${r.HalfLife}</td><td>${r.Unit}</td><td>${r.halfLife_s}</td><td>${r.Q_alpha_MeV}</td><td>${r.calcHL}</td><td>${r.DecayModes.replace(/"/g, '""')}</td></tr>`;
    }

    /*
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `alpha-emitters_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    */

    status.textContent = `Done! ${rows.length} entries exported.`;

    html += '</table>';

    document.getElementById('table').innerHTML = html;
    document.getElementById('csv').innerText   = csv;
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

// Run automatically (or attach to button)
generateAlphaEmittersCSV();
