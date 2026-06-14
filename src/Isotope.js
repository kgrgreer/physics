const S      = 9.47e-18;   // s⁻¹ from paper
const c      = 299792458;  // speed of light
const v1fm   = 4.77e22;    // c/(2π × 1fm) ≈ 4.775 × 10²²
const SLATER = 0.9020413;  // Slater's Rules for Multi-Electron Atoms (Shielding)
const fm     = 1e-15;
const PI     = Math.PI;


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

//        console.log('f', f, 'p', l);
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

        return (hl-0.6);
      }
    },

    {
      name: 'denominator',
      factory: function() {
        let n = this.n, z = this.z;
        return 2.5*2*(n)*Math.log10(z);
      }
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
      name: 'calc3HalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;
        this.color = 'red';
        if ( this.decayModes.indexOf('B-') != -1 ) this.color = 'blue';
        // if ( n > 125 && n < 134 && z > 83 ) this.color = 'green';

        let p = this.denominator;

        this.debug = 'denominator: ' + p;

        let hl = (2*Math.log10(S) + Math.log10(v1fm) - p)/Math.pow(10, 2*Math.E/Math.PI)+Math.log10(c);
        let bonus = 0;
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
        }
        if ( n-z == -1 ) { this.color = 'brown'; bonus -= 2.5; }
        if ( n-z <= -5 && n-z > -9 ) { this.color = 'pink'; bonus -= 7; }
        if ( n-z <= -2 && n-z >= -4 ) { this.color = 'purple'; bonus -= 2; }
        if ( n-z >= 38 && n-z <= 42 ) { this.color = 'black'; }

        if ( n > 125 && n < 134 && z > 83 ) bonus -= 7;

        this.color = this.decayModes == 'B+=100' ? 'red' : 'blue';
        hl += interp(40, 0, 18, 2)(n-z)-Math.PI/2 ;
        return hl+bonus;
      }
    },

    {
      name: 'calc4HalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;

//        let f        = v1fm * z;
        let f        = v1fm;
        let p        = S*(2+Math.pow(n, Math.pow(0.5, n-z+1)))*z * interp(1,Math.sqrt(30), 1, 0.45)(Math.sqrt(n-z)); // (or n ?);
 //       let p        = S*(2+Math.pow(n, Math.pow(0.5, n-z+1)))*z * Math.sqrt(n-z)/2;
    //    if ( Number.isNaN(p) || p == 0) p = 1e-14;
        // console.log(p);
          let duration = 1/f;
        let decay    = p/duration;
        let hl       = c * 4 / 3 * Math.log(2)/decay;
        //return h1 - Math.E;
        let oddEvenBonus = n % 2 ? -0.11 : .2; // 0.117/2;
        return Math.pow(hl - 1.34*Math.E, Math.PI/2) + oddEvenBonus;// - (n-z)/40*6*(80-n)/20
      }
    },

    {
      name: 'pa',
      factory: function() {
        let n = this.n, z = this.z;
        return 100000*(Math.pow(n, Math.pow(0.5, n-z+1))) * Math.pow(z,1/3);
      }
    },

    {
      name: 'xxxcalc4HalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;

        function calc(nz) {
          let f        = v1fm * interp(1,Math.sqrt(30), 1, 0.45)(Math.sqrt(nz)); // (or n ?)
          let pa       = (2+Math.pow(n, Math.pow(0.5, n-z+1)));
          let pb       = (2+Math.pow(n, Math.pow(0.5, 86-n+z)));
          let p        = S * (pa); //Math.max(pa,pb);
//          let duration = 1/f;
          let decay    = p*f; /// p/duration;
          let hl       = c * 4 / 3 * Math.log(2)/decay;

          // return -Math.E/2 + Math.pow(hl + 4*Math.E, Math.PI/2) || 2;
          // return h1 - Math.E;
          let oddEvenBonus = n % 2 ? -0.11 : .2; // 0.117/2;
          return Math.pow(hl - 1.34*Math.E, Math.PI/2) + oddEvenBonus;// - (n-z)/40*6*(80-n)/20
        }

        let minError = 100000000000000, minValue = 0;
        for ( let i = n-z-8 ; i <= n-z+8 ; i++ ) {
          if ( i < 1 ) continue;
          let value = calc(i);
          let error = Math.abs(this.halfLifeLog10-value);
          if ( error < minError ) { minError = error; minValue = value; this.nzOffset = n-z-i }
        }
        return calc(n-z);
        return minValue;
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
      name: 'calc5HalfLifeLog10',
      factory: function() {
        let n = this.n, z = this.z;

        let f     = 1e15;
        let p     = 3 * S / (8 * Math.PI);        // Base Free Neutron formula
        debugger;
        // Electron Capture / B+ like
        let pec   = p / C(Math.pow(n, SLATER), z - 4*PI);

        // Electron Release / B- like / Free Neutron
        let per   = p * C(Math.pow(n-1, SLATER), z); // -1 improves by 4%

        let decay = f * (pec + per);
        let hl    = Math.log(2) / decay;

        hl = Math.pow(hl, 1/Math.PI);             // hyperspherical surface-to-volume scaling

        let adj = (n / this.stableN);
        return Math.log10(hl) / adj;

    // or more geometrically:
    // const shell_factor = Math.pow(n / 50, 0.25);     // surface-like scaling

/*
        if ( this.n > 82  && this.n < 98) {
          hl = Math.pow(hl, 1/Math.PI/1.4);             // hyperspherical surface-to-volume scaling
        } else if ( this.n > 50 && this.n < 82 )  {
          hl = Math.pow(hl, 1/Math.PI/1.2);             // hyperspherical surface-to-volume scaling
        } else {
          hl = Math.pow(hl, 1/Math.PI);             // hyperspherical surface-to-volume scaling
          }
          */


      }
    },

    {
      name: 'error',
      factory: function() {
        const error = this.halfLifeLog10-this.calc4HalfLifeLog10;
        /*
        if ( error < 3 ) this.color = 'red';
        if ( error < 3 ) this.color = 'orange';
        if ( error < 2 ) this.color = 'yellow';
        if ( error < 1 ) this.color = 'green';
        */
        return error;
      }
    },

    {
      name: 'error4',
      factory: function() {
        const error = this.calc4HalfLifeLog10-this.halfLifeLog10;
        /*
        if ( error < 3 ) this.color = 'red';
        if ( error < 3 ) this.color = 'orange';
        if ( error < 2 ) this.color = 'yellow';
        if ( error < 1 ) this.color = 'green';
        */
        return error;
      }
    },
    {
      name: 'abserror4',
      factory: function() { return Math.abs(this.error4); }
    },
    {
      name: 'error5',
      factory: function() {
        const error = this.calc5HalfLifeLog10-this.halfLifeLog10;
        /*
        if ( error < 3 ) this.color = 'red';
        if ( error < 3 ) this.color = 'orange';
        if ( error < 2 ) this.color = 'yellow';
        if ( error < 1 ) this.color = 'green';
        */
        return error;
      }
    },
    {
      name: 'abserror5',
      factory: function() { return Math.abs(this.error5); }
    },
    {
      name: 'cc',
      factory: function() { return 611 + 100*Math.pow(this.u/(this.d+this.u),2); /*return this.n/(this.z+1);*/ }
    },
    {
      name: 'value',
      factory: function() {
        return this.z/this.n;
      }
    },
    {
      name: 'calc5b',
      factory: function() {
        let c = this.calc5HalfLifeLog10;
        if ( Number.isNaN(this.dt) ) return c;
                let dt = Math.log10(1+this.dt);
//        let e = Math.log10(Math.abs(Math.abs(Math.pow(10, this.halfLifeLog10)-Math.pow(10, c))-this.dt));

        let e = this.error5;
        if ( e > 0 ) {
          e = Math.min(e, dt);
        } else {
          e = Math.max(e, -dt);
        }
//          < 0 ? Math.max(this.error5, -dt) : Math.min(this.error5, dt);
        // let e = this.error5 / 2;
        return c-e;
      }
    },
    {
      name: 'color',
      factory: function() {
        let n = this.n;

        // TODO: I take the abs of log10(dt) because values below 0 are negative, so I should investiage if this is correct
        let e = Number.isNaN(this.dt) ? this.abserror5 : Math.max(0, this.abserror5 - Math.log10(this.dt+1));
        return e == 0 ? 'lime' : e < 1 ? 'green' : e < 2 ? 'yellow' : e < 3 ? 'orange' : 'red';
        // return 'hsl(' + (this.z * 20 + (this.z % 2? 0: 180)) + ',' + 90 + '%,' + 50 + '%)';
        return n <= 2 ? 'red' : n <= 8 ? 'orange' : n <= 20 ? 'yellow' : n <= 28 ? 'green' : n <= 50 ? 'blue' : n <= 82 ? 'violet' : n <= 126 ? 'gray' : n <= 184 ? 'lime' : 'black' ;
      }
    }
  ]
});
