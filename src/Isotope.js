const S      = 9.47e-18;   // s⁻¹ from paper
const c      = 299792458;  // speed of light
const v1fm   = 4.77e22;    // c/(2π × 1fm) ≈ 4.775 × 10²²
const SLATER = 0.9020413;  // Slater's Rules for Multi-Electron Atoms (Shielding)
const fm     = 1e-15;
const PI     = Math.PI;
const E      = Math.E;

// S = 9.47797074e-18

function gamma(z) {
  return Math.sqrt(2 * Math.PI / z) * Math.pow((1 / Math.E) * (z + 1 / (12 * z - 1 / (10 * z))), z);
}
function fact(n) {
  if ( ! Number.isInteger(n) ) {
    let r = gamma(n+1);
    if ( ! Number.isNaN(r) ) return r;
  }
  var r = 1; while ( n > 0 ) r *= n--; return r;
}
function P(n, r) { return fact(n) / fact(n-r); }
function C(n, r) { return r < 0 ? 1 : P(n, r) / fact(r); }


function interp(s1, e1, s2, e2) {
  return function(v) {
    var p = (v - s1) / (e1 - s1);
    return s2 + p * (e2 - s2);
  }
}

function log10Sum(log10A, log10B) {
    const max = Math.max(log10A, log10B);
    const min = Math.min(log10A, log10B);

    // We use the identity: log10(a + b) = max + log10(1 + 10^(min - max))
    // To maintain precision, convert to natural logs for Math.log1p
    const diff = min - max;

    // 10^diff converted to e base is: Math.exp(diff * Math.LN10)
    const inner = Math.exp(diff * Math.LN10);

    // log10(1 + inner) is Math.log1p(inner) / Math.LN10
    return max + (Math.log1p(inner) / Math.LN10);
}

function L(z) {
  // Valley of stability: stable N for a given Z
  // From nuclear force balance: Coulomb vs asymmetry energy
  // N_valley = Z * (1 + a_C/(4*a_A) * Z^(2/3)) / (1 - a_C/(8*a_A) * Z^(2/3))
  // With a_C ≈ 0.714 MeV, a_A ≈ 23.2 MeV

  const aC = 0.714;
  const aA = 23.2;
  const ratio = aC / (4 * aA);

  const nValley = z * (1 + ratio * Math.pow(z, 2/3)) /
                      (1 - ratio * Math.pow(z, 2/3) / 2);

  return nValley - 1;
}
/*
function L(z) {
  // From Coulomb/asymmetry energy ratio only
  return z + 0.006 * Math.pow(z, 5/3) - 1;
}*/
/*
function L(z) {
  // Simple empirical valley fit
  return z * (1 + 0.00434 * z) - 1;
  }
  */

foam.CLASS({
  name: 'Isotope',

  properties: [
    {
      class: 'Int',
      name: 'a',
      start: 1,
      end: 3,
      documentation: 'Mass Number'
    },
    {
      class: 'Int',
      name: 'z',
      start: 5,
      end: 7,
      documentation: 'Atomc Number'
    },
    {
      name: 'i',
      start: 8,
      end: 8,
      documentation: 'i=0 (gs); i=1,2 (isomers); i=3,4 (levels); i=5 (resonance); i=8,9 (IAS)'
    },
    {
      name: 'aEl',
      start: 12,
      end: 16
    },
    {
      class: 'Float',
      name: 't',
      start: 70,
      end: 78,
      documentation: 'Half-life'
    },
    {
      name: 'unit',
      start: 79,
      end: 80,
      documentation: 'Half-life unit'
    },
    {
      class: 'Float',
      name: 'dt',
      start: 82,
      end: 88,
      documentation: 'Half-life uncertainty'
    },
    {
      name: 'decayModes',
      start: 120,
      end: 209,
      documentation: 'Decay Modes'
    },

    // Computed Properties
    {
      class: 'Int',
      name: 'n',
      documentation: 'Number of Neutrons',
      factory: function() { return this.a - this.z; }
    },
    {
      name: 'element',
      factory: function() { return this.aEl.match(/[A-Za-z]{1,2}$/)?.[0]; }
    },
    {
      name: 'nuclide',
      factory: function() { return `${this.element}-${this.a}`; }
    },
    {
      name: 'halfLifeLog10',
      factory: function() {
        const UNITS = {
          zs: 1e-21,   // zeptosecond
          ys: 1e-24,   // yoctosecond
          as: 1e-18,   // attosecond
          fs: 1e-15,   // femtosecond
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
          My: 1e6  * 365.25 * 86400,
          Gy: 1e9  * 365.25 * 86400,
          Ty: 1e12 * 365.25 * 86400,
          Py: 1e15 * 365.25 * 86400,
          Ey: 1e18 * 365.25 * 86400,
          Zy: 1e21 * 365.25 * 86400,
          Yy: 1e24 * 365.25 * 86400
        };

        return Math.log10(this.t) + Math.log10(UNITS[this.unit]);
      }
    },

    {
      name: 'nMagic',
      factory: function() {
        const n = this.n, abs = function(a) { return a; }; //Math.abs;
//        const n = this.n, abs = Math.abs;
        return Math.min(
          abs(n-2),
          abs(n-8),
          abs(n-20),
          abs(n-28),
          abs(n-50),
          abs(n-82),
//          abs(n-126), // electron only
          abs(n-184),
          abs(n-258));
      }
    },

    {
      name: 'zMagic',
      factory: function() {
        const z = this.z, abs = function(a) { return a; }; //Math.abs;
        return Math.min(
          abs(z-2),
          abs(z-8),
          abs(z-20),
          abs(z-28),
          abs(z-50),
          abs(z-82),
          abs(z-126));
      }
    },

    {
      name: 'totalMagic',
      factory: function() {
        this.debug = `magic: N ${this.nMagic} + Z ${this.zMagic} = ${this.nMagic + this.zMagic}`;
        return this.nMagic + this.zMagic;
//        return Math.min(this.nMagic, this.zMagic);
      }
    },

    {
      name: 'u',
      factory: function() { return 2 * this.z + this.n; }
    },

    {
      name: 'd',
      factory: function() { return this.z + 2 * this.n; }
    },

    {
      name: 'ud',
      factory: function() { return this.u - this.d; }
    },

    {
      name: 'dLz',
      factory: function() { return this.n-L(this.z); }
    },
    {
      name: 'nMinusZ',
      factory: function() { return this.n-this.z; }
    },
    {
      name: 'nPlusZ',
      factory: function() { return this.n+this.z; }
    },

    {
      name: 'stableN',
      factory: function() {
        let z = this.n;
        return z + 0.006 * Math.pow(z, 2);
      }
    },

    {
      name: 'stableZ',
      factory: function() {
        return this.z * ( 1 + 0.1526 * Math.pow(this.a, 2/3));
      }
    },

    {
      name: 'calcHalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;

        let f = 2.471180e20; // ν_e (Zitterbewegung frequency) ≈ 2.471 × 10^{20} Hz
        let p = S / E;

        // Note: We have accidentally discovered the fine structured constant alpha at this point:
        // let alpha = 2 * Math.PI / (f * p);
        // 1 / alpha = 137.01875251495488

        // Note: We have the hl of the free neutron now, with two derivatives:
        // let freeNeutronHL = Math.log(2)*f*p;
        // let freeNeutronHL = Math.log(2)*2*Math.PI/alpha
        // freeNeutronHL = 596.7402591746348

        // Calclate Free Neutron Half-Life
        //   Bottle Method: 608s
        //   Beam Method:   615s
        //   This calculation without corrections: 597sv
        // My theory is that both the Bottle and Beam methods use magnetic fields which
        // provide the same kind of shielding that would be provided by an electron shell
        // which has the effect of deflecting would-be escaping electrons and extending
        // the half-life. The Beam method uses a strong field so extends the HL longer than
        // the Bottle method does, but they both extend it beyond the 497s baseline.

        // Electron Capture / B+ like
        let pec   = 1 / C(Math.pow(n, SLATER), z - 4*PI);

        // Electron Release / B- like / Free Neutron
        let per   = 1 * C(Math.pow(n-1, SLATER), z); // -1 improves by 4%, expected by hypothesis, not fit

        let decay = f * Math.pow(p * (pec + per), E/2); // Why ^E/2?
        let hl    = Math.log(2) / decay;

        hl = Math.pow(hl, 1/Math.PI);               // hyperspherical surface-to-volume scaling

        let adj = (n / this.stableN);               // Adjust for curve in valley of stability
        return Math.log10(hl) / adj;
      }
    },

    {
      name: 'error',
      factory: function() {
        const error = this.halfLifeLog10-this.calcHalfLifeLog10;
        if ( error < 3 ) this.color = 'red';
        if ( error < 3 ) this.color = 'orange';
        if ( error < 2 ) this.color = 'yellow';
        if ( error < 1 ) this.color = 'green';
        return error;
      }
    },

    {
      name: 'abserror',
      factory: function() { return Math.abs(this.error); }
    },

    {
      name: 'value',
      factory: function() {
        return this.z/this.n;
      }
    },
    {
      name: 'color',
      factory: function() {
        let n = this.n;

        // TODO: I take the abs of log10(dt) because values below 0 are negative, so I should investiage if this is correct
        let e = Number.isNaN(this.dt) ? this.abserror : Math.max(0, this.abserror - Math.log10(this.dt+1));
        return e == 0 ? 'lime' : e < 1 ? 'green' : e < 2 ? 'yellow' : e < 3 ? 'orange' : 'red';
        // return 'hsl(' + (this.z * 20 + (this.z % 2? 0: 180)) + ',' + 90 + '%,' + 50 + '%)';
        return n <= 2 ? 'red' : n <= 8 ? 'orange' : n <= 20 ? 'yellow' : n <= 28 ? 'green' : n <= 50 ? 'blue' : n <= 82 ? 'violet' : n <= 126 ? 'gray' : n <= 184 ? 'lime' : 'black' ;
      }
    }
  ]
});
