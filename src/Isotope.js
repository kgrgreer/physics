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
        const N = this.n;
        const Z = this.z;
        if (N < 1 || Z < 1) return 0;

        // 1. Neutron excess relative to approximate valley of stability
        const stableN = 1.4 * Z;                    // works well for Z > 20
        const neutronExcess = Math.max(0, N - stableN);

        // 2. Current neutron shell + fill fraction (magic shells: 2,8,20,28,50,82,126,184)
        const magicN = [2,8,20,28,50,82,126,184];
        let shellStart = 0;
        let shellEnd = 2;
        for (let i = 1; i < magicN.length; i++) {
          if (N <= magicN[i]) {
            shellStart = magicN[i-1];
            shellEnd = magicN[i];
            break;
          }
        }
        const shellCapacity = shellEnd - shellStart;
        const fillFraction = (N - shellStart) / shellCapacity;   // 0..1

        // 3. Proton covering of the outer neutron shell (preferential covering)
        const protonCover = Math.min(1, Z / (shellCapacity * 1.6));   // tuned to repulsion preference

        // 4. Unpaired neutron bonus (stronger staggering in B⁻)
        const unpairedBonus = (N % 2 === 1) ? 1.25 : 1.0;

        // 5. Final exposure (higher = shorter half-life)
        return neutronExcess * (1 - protonCover) * fillFraction * unpairedBonus * 2.8;
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
    }
  ]
});
