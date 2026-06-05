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

function sym() {
  const H0 = 0.00001;
  const S  = H0*3;
  const g  = 1; //10;
  const R  = 100;

  // Actually there are two masses, the mirror image of each other
  let m1 = { name: 'm1', r: R, m: 10, x: 5*R, v: 0 };

  let oldD = 2 * m1.x;
  for ( let i = 0 ; i < 10000 ; i++ ) {
    // Calculate distance using matter as the ruler
    let d = 2 * m1.x * R / m1.r;
    let f = g * m1.m * m1.m / Math.pow(d, 2);

    let r = S*oldD/(d-oldD);
    console.log(`i: ${i}, H: ${r.toFixed(6)}, v: ${(-m1.v).toFixed(8)}, dist: ${(d).toFixed(4)}, force: ${(1000000*f).toFixed(5)} -- ${JSON.stringify(m1)}`);

    // Shrink
    // size
    m1.r = Math.pow(Math.pow(m1.r, 3) * (1-S), 1/3)
//    m1.v *= S1; // if v is m/s, it isn't the m getting smaller but the s getting faster as matter shrinks

    // Gravitational Acceleration
 //   m1.v -= f/m1.m;

    // Accumulate Velocity, relative to size of matter
    m1.x += R * m1.v / m1.r;

    // Stop if collide with the other mass
    if ( m1.x < m1.r ) { console.log('***',m1); break; m1.x = m1.r; m1.v = 0; }

    oldD = d;
  }
}


sym();
