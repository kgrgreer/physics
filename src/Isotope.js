const S = 9.5e-18;            // s⁻¹ from paper


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
      name: 'calcHalfLifeLog10',
      factory: function() {
        const log10Z = Math.log10(this.z);
        return (
          5
          + Math.log10(S)
          + this.n *5* log10Z
        )/(Math.sqrt(this.z)*4)+  interp(60, 115, -18, -41)(this.z);
      }
    },


    {
      name: 'beta_exposure',
      factory: function() {
        const nzRatio = this.n / this.z;

        const stableRatioApprox = 1.0 + 0.00355 * this.z;   // tuned to real data

        return Math.pow(1- (nzRatio - stableRatioApprox -0.12),-0.5);

    let remZ = this.z;
    let remN = this.n;
    let lastI = 0; // last shell
    if (remZ < 3 || remN < 3) return 0;

    const SHELLS = [2, 6, 12, 8, 22, 32, 44, 58, 100];
    // Step 1: Pair across all shells (no exposure yet)
    const shells = [];
    for ( let i = 0 ; i < SHELLS.length && (remN > 0 || remZ > 0) ; i++ ) {
      const cap     = SHELLS[i];
      const nPlaced = Math.min(remN, cap);
      const zPlaced = Math.min(remZ, cap);
      shells.push({ n: nPlaced, z: zPlaced, i: i, size: SHELLS[i], exposed: nPlaced-zPlaced });
      remN -= nPlaced;
      remZ -= zPlaced;
      lastI = i;
    }
    if ( lastI < 2 ) return 0;
    // Step 2: Get the last two non-empty shells
    let outer = shells[lastI];
    let inner = shells[lastI-1];

    this.debug = JSON.stringify([inner, outer]);
// if ( this.n == 52 && this.z == 32 ) debugger;

    // Step 3: Move protons up one level
    let emptyNeutrons    = outer.n - outer.z;
    let availableProtons = inner.z;
//    let centeredness     = inner.z/inner.size;
    let centeredness     = 1-outer.n/outer.size;
    centeredness = 1;
//    centeredness = Math.min(1.0, centeredness + ([1, -1, 0.1, 0.05][inner.z] || 0));
    this.debug += ' c: ' + centeredness.toFixed(2);
    let movedProtons     = Math.min(emptyNeutrons, Math.ceil(availableProtons*centeredness));

    outer.z += movedProtons;
    inner.z -= movedProtons;

    // If you just crossed Z magic number you can borrow the most Protons

    let outerExposure = Math.max(0, outer.n - outer.z);// * outer.i;
    let innerExposure = Math.max(0, inner.n - inner.z);// * inner.i;

    this.debug += ` m:${movedProtons} i:${innerExposure} o:${outerExposure}`;

    let outerFilled = Math.min(1, outer.n / Math.ceil(Math.pow(outer.size,1/3)));

    return outerExposure;
    return innerExposure * (1-outerFilled) + outerExposure;
    this.debug += ' ' + innerExposure + " " + outerExposure;
    let exposure = outerExposure * outer.i + innerExposure * inner.i;
//    if ( exposure < this.n ) return 0;
    //return ( exposure > this.n-this.z ) ? exposure : 0;
    return exposure;
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
    }
  ]
});
