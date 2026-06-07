const c      = 299792458;  // speed of light, Units: m/s
const v1fm   = 4.77e22;    // c/(2π × 1fm) ≈ 4.775 × 10²², Units: s^-1
const fm     = 1e-15;      // Standard Femtometer definition, approximate size of nucleus, Units: m
const PI     = Math.PI;
const E      = Math.E;


// Hubble Constant
const H0_67     = 2.171e-18; // 67 km s-1 Mpc-1
const H0_73     = 2.366e-18; // 73 km s-1 Mpc-1
const H0        = H0_73;     // Units s^-1

// How fast Matter shrinks relative to fixed size Universe
// const S_      = H0 * 4;
const S_ = 9.5e-18;
// Units are also s^-1, but since this is the 3D size change per second,
// unlike H0 it can't be multiplied but must be used in an exponent.
// So let's make it a function to avoid misuse
const S = (t) => S_ * t; //Math.exp(-S * t); // approximately equal for small values of t like we're using


console.log('HO:', H0);
console.log('S:', S_);
console.log('S/HO:', S_/H0);


const f = v1fm;// / fm;
const p = S(fm/c);              // Unitless
const decay = f * p;            // Units: s^-1
const hl = Math.log(2) / decay; // Units: s

console.log(`f: ${f}, p: ${p}, decay: ${decay}, hl: ${hl}, hlLog10: ${Math.log10(hl)}`);

console.log(Math.log(2)/(3*S_/(8*PI)/fm));
console.log(Math.log(2)/(3*S_/(8*PI)/(S_*137.035999166)));
console.log(Math.log(2)/(3/(8*PI)/(137.035999166)));

/**
 * Calculates Newton's gravitational constant (G) based on the background
 * metric volume contraction rate (S) and fundamental subatomic boundaries.
 * * @param {number} S - The macro-cosmic metric contraction rate (approx 9.4757e-18 s^-1)
 * @returns {number} G - The derived Newtonian gravitational constant (m^3 kg^-1 s^-2)
 */
function deriveGravityFromMetric(S) {
  // 1. Define fundamental subatomic and atomic boundaries (SI Units)
  const a0 = 5.29177210903e-11;      // Bohr radius (meters)
  const m_p = 1.67262192369e-27;     // Proton rest mass (kilograms)
  const c = 299792458;               // Speed of light (meters / second)

  // 2. Define baseline electrostatic coupling boundary (ke * e^2)
  // where ke = 1 / (4 * PI * epsilon_0)
  // Standard value for ke * e^2 is approx 2.30707755e-28 J*m
  const ke_e2 = 2.307077552397e-28;

  // 3. Compute the active cosmological load (Numerator)
  const cosmologicalLoad = S * a0 * ke_e2;

  // 4. Compute the structural inertia of baryonic matter (Denominator)
  const materialInertia = 2 * c * Math.pow(m_p, 2);

  // 5. Calculate the localized pressure gradient deficit (G)
  const G = cosmologicalLoad / materialInertia;

  return G;
}

// --- Verification Example ---
const targetS = 9.47573e-18;
const derivedG = deriveGravityFromMetric(targetS);

console.log(`Input S: ${targetS.toExponential(5)} s^-1`);
console.log(`Derived G: ${derivedG.toExponential(5)} m^3 kg^-1 s^-2`);
// Output matches the standard gravitational constant scale: ~6.6743e-11
// Simple 1D Universe Simulator
// Contains only two masses which are the mirror image of each other
function sym() {
  const H0 = 0.00001; // Much larger H0 to make simulation easier
  const S  = H0*3;    // Contraction Rate
  const g  = 0.012; //deriveGravityFromMetric(S); //0.012;   // Gravitational constant
  const R  = 100;     // Starting Size of Matter

  console.log('g: ', g);

  // Actually there are two masses, the mirror image of each other, so we can just simulate one
  let m1 = {
    name: 'm1',
    r: R,    // Size, shrinks with time
    m: 10,   // mass, in it's own frame, doesn't change
    x: 5*R,  // x location in the unchanging fixed size space frame
    v: 0     // Starting velocity, in relation to the own size 'r'
  };
  let s1 = { x: 5*R };

  let oldD = 2 * m1.x; // Distance between masses in previous iteration
  let oldD2 = 2 * s1.x; // Distance between masses in previous iteration

  for ( let i = 0 ; i < 10000000 ; i++) {
    // Calculate distance using matter as the ruler
    let d = 2 * m1.x * R / m1.r;
    let d2 = 2 * s1.x * R / m1.r;
    // Force of gravity
    let f = g * m1.m * m1.m / Math.pow(d, 2);
    // Observed Matter Separation: equivalent of H0
    let r = 1/((d-oldD)/oldD/S);
    let r2 = 1/((d2-oldD2)/oldD2/S);

    if ( i % 50000 == 0 )
      console.log(`i: ${i}, Hm: ${r.toFixed(8)} S, Hs: ${r2.toFixed(8)}S, v: ${(-m1.v).toFixed(8)}, dist: ${(d).toFixed(4)}, force: ${(1000000*f).toFixed(5)}`);//  ${JSON.stringify([s1, m1])}`);

    // Shrink Matter
    m1.r = m1.r * Math.pow(1-S, 1/3); // same as above

    // Gravitational Acceleration
    m1.v -= f/m1.m;

    // Accumulate Velocity, relative to size of matter, since 'x' is absolute
    m1.x += R * m1.v / m1.r;

    // Stop if collide with the other mass
    // if ( m1.x < m1.r ) { console.log('***',m1); break; m1.x = m1.r; m1.v = 0; }

    oldD = d;
    oldD2 = d2;
  }
}


sym();
