const S = 9.5e-18;            // s⁻¹ from paper
const Ssq = S * S;
const c = 299792458;          // speed of light
const v1fm = 4.77e22; // c/(2π × 1fm) ≈ 4.775 × 10²²

function interp(s1, e1, s2, e2) {
  return function(v) {
    var p = (v - s1) / (e1 - s1);
    return s2 + p * (e2 - s2);
  }
}


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
        const n = this.n, abs = Math.abs;
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
        const z = this.z, abs = Math.abs;
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
      name: 'beta_exposure',
      factory: function() {
        const nzRatio           = this.n / this.z;
        const stableRatioApprox = 1.0 + 0.00434 * this.z;   // tuned to real data

        return nzRatio - stableRatioApprox-0.12;
      }
    },

    {
      name: 'calc2HalfLifeLog10',
      factory: function() {
        const n = this.n, z = this.z;

        // thl = ln(2)/(f*p)
        let f = 10e21;
//        let p = S * Math.pow(z, 2.5*n);
        let l = Math.log10(S) + (2.5*n/z*Math.log10(z));

        console.log('f', f, 'p', l);
        let hl = Math.log10(Math.log(2))-Math.log10(f)-l;

        return hl + 17;
//        let hl = Math.log(10)/(-f*Math.log(1-p));

  //      return hl;
        return interp(-34.51,255.48,6.66,4.86)(hl);
//        return interp(-12.51, 277.48, 6.66, 4.859)(Math.log10(S * Math.pow(z, 2.5*n)));
      }
    },
    {
      name: 'calcHalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;
//        this.color = 'red';
//        if ( n > 126 && n < 133 && z > 83) { this.color='black'; } //else if ( n > 82 ) { z -= 3; }
        const log10Z = Math.log10(z);
        let hl=           (( n > 126 &&  n < 133 && z > 83) ? -3 : 0) +
(
          5
          + Math.log10(S)
          + n *5* log10Z
)/(Math.sqrt(z)*4) + interp(60, 115, -18, -41)(z);

        let bonus = 0;

//        this.color = '#fff0';
        if ( this.beta_exposure > 0.1 ) {
  //        this.color = 'black';
        }
        if ( n-z == 1 ) {
          bonus = -1;
        } else if ( n-z == -1 ) {
          bonus = -3.5;
        } else if ( n-z == -1 || n-z == -2 || n-z == -3 || n-z == -4 ) {
          bonus = -4;
        } else if ( n == z && this.beta_exposure < 0 && n % 2 == 0 ) {
          bonus = -1;
        } else if ( n == z && this.beta_exposure < 0 && n % 2 == 1 ) {
          bonus = -4;
        } else if ( n == 126 ) {
          bonus = -2;
        } else if ( n >= 127 && n < 135 ) {
          if ( this.beta_exposure < 0 ) {
            bonus = -3;
//          this.color = 'lime';
          } else {
            bonus += 1;
  //        this.color = 'white';
          }
        }

        hl += (this.beta_exposure > 0.001 ? 6+2*(13-hl)-21.5 : 0) + bonus;

        if ( hl > 0) hl = Math.pow(hl, 1.2)/1.3;

        return hl -0.6;
      }
    },

      {
      name: 'calc3HalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;
        return (2*Math.log10(S) + Math.log10(v1fm) - (n-1) * Math.log10(z))/Math.pow(10, 2*Math.E/Math.PI)+Math.log10(c);
      }
    },

    // B⁻ half-life predictor (pure geometry, no Q)
    {
      name: 'calcHalfLifeLog10_Bminus',
      factory: function() {
        const exposure = this.beta_exposure;
        // Base scaling is π/2 from nuclear diameter exposure (your fitted -1.56 ≈ -π/2)
        return 18.5 - (Math.PI / 2) * Math.log10(this.z || 1) + 0.09 * exposure + interp(19,50,-20,-8)(this.z)
        // 18.5 is the intercept (tuned once on the large dataset)
      }
    },

    {
      name: 'nMinusZ',
      factory: function() { return this.n - this.z; }
    },

    {
      name: 'error',
      factory: function() {
        const error = Math.abs(this.halfLifeLog10-this.calcHalfLifeLog10);
        if ( error < 3 ) this.color = 'red';
        if ( error < 3 ) this.color = 'orange';
        if ( error < 2 ) this.color = 'yellow';
        if ( error < 1 ) this.color = 'green';
        return error;
      }
    }

  ]
});
