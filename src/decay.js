const local          = true;  // true = local files; false = direct IAEA fetch
const baseUrl        = local ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const nubaseFilename = 'nubase_4.mas20.txt';

const MAGIC = {
  2: true,
  8: true,
  20: true,
  28: true,
  50: true,
  82: true,
  98: true,
  126: true /* neutrons only? */,
  184: true,
  258: true,
  350: true,
  462: true
};

// ====================================================================
// download and parse fixed-width files based on supplied schema
// ====================================================================

function log(s) {
  document.getElementById('console').innerText += s;
}

async function load(url, model) {
  log(`Loading ${url}...`);
  const data  = await fetch(url);
  const text  = await data.text();
  const lines = text.split('\n');
  log(` done.\n`);

  return lines.filter(l => ! l.startsWith('#') && l != '').map(l => model(l));
}


load(baseUrl + nubaseFilename, Isotope).then(data => {

  log(`Loaded ${data.length} isotopes.\n`);

  // Apply filtering criteria
  data = data
    .filter(o => o.halfLifeLog10 > -8 && o.halfLifeLog10 < 8) // In reliable range
//    .filter(o => o.z)                  // Has Electrons ??? Why needed
    .filter(o => ! isNaN(o.t))         // Stable
    .filter(o => o.i == '0');          // Non ground state isotopes

  log(`Keeping ${data.length} isotopes.\n`);

  function pointRenderer(x, y, o, i) {
    const s = 255-255*(o.halfLifeLog10+8)/16;
    let color = `rgb(${0},${s},${0})`;
    if ( o.halfLifeLog10 > 1.9 && o.halfLifeLog10 < 3.5 ) color = 'red';
    return `<circle cx="${x}" cy="${y}" r="2" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function nMinusZPointRenderer(x, y, o, i) {
    let b = o.beta_exposure;

//    const s = interp(20, 64, 0, 255)(o.nMinusZ);
    const color = o.color; // || b < 0.1 ? 'white' : `rgb(${255},0,0)`;
    return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function exposureRenderer(x, y, o, i) {
    let b = o.beta_exposure;

    const color = `rgb(${(o.n-o.z)*5},0,0)`;
    const isBeta = o.beta_exposure < 0.01;
    const stroke = isBeta ? 'green' : '#222';
    const strokeWidth = isBeta ? 3 : 0; // o.decayModes.indexOf('B-') == -1 ? '2' : '0';
    return `<circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" data-id="${i}"/>`;
  }

  function nMinusZRenderer(x, y, o, i) {
    let nz = o.n-o.z;
    let colors = [ 'red', 'green', 'gray', 'orange', 'blue', 'brown', 'violet', 'pink', 'black' ];
    let color = colors[(nz+10)% colors.length];
    let ccolor = o.n % 2 ? 'red' : 'blue';

    let error = Math.abs(o.error4);
    // color = error < 1 ? 'green' : error < 2 ? 'orange' : 'red';
    return `<circle cx="${x}" cy="${y}" r="2" fill="${ccolor}" stroke="#222" stroke-width="0.3" data-id="${i}"/><text fill="${color}" x="${x}" y="${y}" font-size="0">${nz},${o.n},${o.z}</text>`;
  }

  function offsetRenderer(x, y, o, i) {
    let nzo = o.nzOffset;
    let color = nzo == 0 ? 'black' : nzo > 0 ? 'green' : 'red';
    color = o.abserror4 < 0.05 ? 'red' : 'gray';
    return `<circle cx="${x}" cy="${y}" fill="${color}" r="2" data-id="${i}"/><text fill="${color}" x="${x}" y="${y}" font-size="6">${o.u},${o.d}</text>`;
  }

  function magicRenderer(x, y, o, i) {
    let m = o.totalMagic;

    const color = `rgb(${m*21},0,0)`;
    const stroke = 'black', strokeWidth = 0.5;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" data-id="${i}"/>`;
  }

  function drawMagicLines(toX, toY) {
    const magic = Object.keys(MAGIC);
    let   svg   = '';

    magic.forEach(m => {
      const x = toX(m), y = toY(m);
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="10000" stroke="red" stroke-dasharray="4" stroke-width="1.5"/>`;
      svg += `<line x1="$0" y1="${y}" x2="10000" y2="${y}" stroke="red" stroke-dasharray="4" stroke-width="1.5"/>`;
    });

    for( let i = -8 ; i < 8 ; i ++ ) {
      const x = toX(i), y = toY(i);
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="10000" stroke="#999" stroke-width="0.2"/>`;
      svg += `<line x1="$0" y1="${y}" x2="10000" y2="${y}" stroke="#999" stroke-width="0.2"/>`;
    }

    return svg;
  }

  //////////////////////////////////////////////////////////////////////////////
  //                                                                     Graphs
  //////////////////////////////////////////////////////////////////////////////
  const bMinusData = data.filter(o => o.decayModes.startsWith('B-'));
  const ecLikeData = data.filter(o => o.decayModes.indexOf('B-') == -1/* && o.beta_exposure < 3*/);



  //  const smallData = data.filter(e => e.z < 8);
  let smallData = data; //data.filter(e => (e.z < 82) && e.decayModes.startsWith('B') /*&& e.z % 4 == 0 *//*&& (e.n-e.z) % 10 == 1 &&  e.decayModes == 'B+=100' && e.n<130 && e.n%2==1 */ /*|| e.decayModes == 'B+=100'*/);
//  smallData = smallData.filter(e => e.decayModes === 'B-=100');
//  smallData = smallData.filter(e => e.decayModes === 'B+=100');
//  smallData = smallData.filter(e => e.decayModes === 'B+=100' || e.decayModes === 'B-=100');
//  smallData = smallData.filter(e => e.decayModes.indexOf('p') == -1 && e.decayModes.indexOf('A') == -1  && e.decayModes.indexOf('SF') == -1 /*&& e.decayModes.indexOf('?') == -1*/ );
 // smallData = smallData.filter(e => e.halfLifeLog10 < 4.7 && e.halfLifeLog10 > -3);
//    smallData = smallData.filter(e => e.nMinusZ > 8);
//   smallData = smallData.filter(e => e.halfLifeLog10 < 5);
//  smallData = smallData.filter(e => e.decayModes == 'A=100');
  smallData = smallData.filter(e => e.decayModes.indexOf('A') == -1);
  smallData = smallData.filter(e => e.n < 150);
//  smallData = smallData.filter(e => e.n > 5);
//  smallData = smallData.filter(e => e.dt >3);
//  smallData = smallData.filter(e => e.n == 80);
//  smallData = smallData.filter(e => e.n%2 == 0);
  smallData = smallData.filter(e => e.n-e.z > 5);
//  smallData = smallData.filter(e => e.n != 70 && e.z != 70 && e.z != 60 && ( e.z >53 || e.z <50 ) && e.n != 82 && e.n != 25 && e.n != 132 && e.z != 15 && e.z != 50 && e.z != 68 && e.nMinusZ != 56 && e.n > 43);
  console.log('smallData size:', smallData.length);

  let byNZ = [];
  smallData.forEach(o => {
    let nz = o.n-o.z;
    (byNZ[nz] || (byNZ[nz] = [])).push(o);
  });
  const getAverage = (array) =>
        array.reduce((sum, currentValue) => sum + currentValue, 0) / array.length;
  byNZ = byNZ.map(a => {
    a.sort(function(o1, o2) { Math.abs(o2.error4) - Math.abs(o1.error4); });
    a = a.map(o => o.error4);
    a = a.slice(0, Math.max(4, a.length-4));
    return getAverage(a);
  });
  globalThis.byNZ = byNZ;

  let avgData = smallData;
  console.log('avg error:', getAverage(avgData.map(o => o.abserror)));
  console.log('avg odd error:', getAverage(avgData.filter(o => o.n %2).map(o => o.abserror)));
  console.log('avg even error:', getAverage(avgData.filter(o => o.n % 2 == 0).map(o => o.abserror)));

//  smallData.push(Isotope({aEl: '0N', a: 1, i: '0', n: 1, z: 0, color: 'pink', t: 611, unit: 's', decayModes:'B-=100', element: '-', nuclide: 'N-0', r: 8 }));

  /*

  for ( let z = 4 ; z < 83 ; z++ )
  createScatterPlot('graph0', data.filter(o => o.z == z), 'n', 'halfLifeLog10', {
    title: 'HL X N Z=' + z,
    squareAspect: true,
    pointRenderer: nMinusZRenderer
    });
    */


  /*
  createScatterPlot('graph0', data.filter(o => o.n < 21), 'n', 'halfLifeLog10', {
    title: 'Calc4 HL',
    squareAspect: true,
    xxxpointRenderer: nMinusZRenderer
    });
    */


  createScatterPlot('graph0', smallData, 'calcHalfLifeLog10', 'halfLifeLog10', {
    title: 'Calc4 HL',
    squareAspect: true,
    xxxpointRenderer: nMinusZRenderer
  });

    createScatterPlot('graph0', smallData, 'calcHalfLifeLog10', 'error', {
    title: 'Calc4 HL',
    squareAspect: false,
    xxxpointRenderer: nMinusZRenderer
    });

  createScatterPlot('graph0', smallData, 'd', 'u', {
    title: 'N X Z',
    squareAspect: false,
    pointRenderer: offsetRenderer,
    customizeSVG: drawMagicLines
  });


  createScatterPlot('graph0', data.filter(e => e.decayModes.indexOf('A') == -1 ), 'calcHalfLifeLog10', 'halfLifeLog10', {
    title: 'Calc HL',
    squareAspect: true,
    pointRenderer: nMinusZPointRenderer
  });

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: exposureRenderer, customizeSVG: drawMagicLines});

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: pointRenderer, customizeSVG: drawMagicLines});

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: function(x,y,o,i) {
    var color = o.decayModes == 'B-=100' ? 'red' : o.decayModes == 'A=100' ? 'blue' : o.decayModes == 'B+=100' ? 'pink' : o.decayModes == 'EC=100' ? 'black' : 'green';
    if ( o.decayModes.indexOf('A') != -1 ) color = 'white';
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;

  }, customizeSVG: drawMagicLines});


  createScatterPlot('graph0', data, 'z', 'nMinusZ', { pointRenderer: pointRenderer, pointRenderer2: function(x,y,o,i) {
    var color = o.decayModes == 'B-=100' ? 'red' : o.decayModes == 'A=100' ? 'blue' : o.decayModes == 'B+=100' ? 'pink' : o.decayModes == 'EC=100' ? 'black' : 'gray';
    if ( o.decayModes.indexOf('A') != -1 ) color = 'white';
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;

  }, customizeSVG: drawMagicLines});

    createScatterPlot('graph0', data, 'u', 'd', { squareAspect: true, pointRenderer: pointRenderer, customizeSVG: drawMagicLines});

  /*
  for ( let n = 3 ; n < 177 ; n++ ) {
    createScatterPlot('graph0', data.filter(o => o.decayModes.indexOf('B-=') != -1), 'beta_exposure', 'halfLifeLog10', {
      pointRenderer:   function (x, y, o, j) {
        const color = (o.n) == n ? 'red' : 'white';
        return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${j}"/>`;
      },
      title: 'N = ' + n,
      squareAspect: true
    });
    }
    */

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: pointRenderer, customizeSVG: drawMagicLines });

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'n', 'z');


  /*
  function avg(data, p) {
    let sum = 0;
    data.forEach(o => sum += o[p]);
    return sum/data.length;
  }

  data = data.filter(o => o.decayModes.indexOf('B-=') != -1);
  console.log('average even half-life log10:', avg(data.filter(o => o.z % 2 == 0), 'halfLifeLog10'));
  console.log('average odd  half-life log10:', avg(data.filter(o => o.z % 2 == 1), 'halfLifeLog10'));
*/

function seq(...a) {
  return [ (m, o) => a.map((r, i) => r[0](m[i], o)), a.map(r => r[1]), m => m.map((n, i) => (a[i][2] || (x => x))(n)) ];
}
function mapM(m, f) {
  let r = {};
  Object.keys(m).forEach(k => r[k] = f(m[k]));
  return r;
}
function mToA(m, f) {
  return Object.keys(m).map((o, i) => f(m[o], o));
}
console.log('mapM', mapM);

function avg(f) {
  f = f || ( o => o);
  return [ (m, o) => [m[0] + f(o), m[1]+1], [0,0], m => m[0] / m[1] ];
}


function sum(f) {
  f = f || ( o => o);
  return [ (m, o) => m + f(o), 0 ];
}

function count() {
  return [ (m, o) => m + 1, 0 ];
}


function reduce(data, r) {
  return (r[2] || (a => a))(data.reduce.apply(data, r));
}
function groupBy(f, r) {
  return [
    (m, o) => {
      let k = f(o);
      m = {...m};
      m[k] = r[0](m[k] ?? r[1], o, k);
      return m;
    },
    {},
    r[2] && (m => mapM(m, a => r[2](a)))
  ];
}

  console.log(reduce([1,2,3], sum(o => o)));
  console.log(reduce([1,2,3], avg(o => o)));
  console.log(reduce([1,2,3], seq(sum(), avg())));
  console.log(reduce([1,2,3], avg(o => o)));
  console.log(reduce([1,2,3,4,5], avg()));

  console.log(reduce([1,2,3,4], groupBy(o => o<3, sum())));
  console.log(reduce([1,2,3,4], groupBy(o => o<3, sum())));

  console.log(reduce([1,2,3,4], groupBy(o => o<3, avg())));
  console.log(reduce([1,2,3,4], groupBy(o => o<3, avg())));

  console.log(reduce(smallData, groupBy(o => o.n, avg(o => o.error))));
  console.log(reduce(smallData, groupBy(o => o.n-o.z, avg(o => o.error))));
  console.log(reduce(smallData, groupBy(o => o.n-o.z, count())));

  console.log(reduce(smallData, groupBy(o => o.color, count())));

  console.log('*********', reduce(data, avg(o => o.dt || 0)));
  console.log('sum', reduce(data, count()));
  console.log('sum2', reduce(data.filter(o => Math.abs(o.error) < Math.log10(o.dt)), count()));

  /*
  let byNSlope = mToA(
    reduce(smallData, groupBy(o => o.n, avg(a => a.halfLifeLog10/a.calc5HalfLifeLog10))),
    (o, i) => { return { n: i, slope: o }; }
    );
    */
  let byNSlope = mToA(
    reduce(smallData, groupBy(o => o.n, seq(avg(a => a.halfLifeLog10), avg(a => a.calcHalfLifeLog10)))),
    (o, i) => { return { n: i, slope: o[0]/o[1] }; }
  );
  let slopes = [];
  byNSlope.map(s => slopes[s.n] = s.slope);

  console.log('slope:', slopes);

  // big outliers: 25, 80*, 82, 132

  createScatterPlot('graph0', byNSlope, 'n', 'slope', {
    title: 'Slope X N',
    squareAspect: false
  });

  // big outliers: 15, 50*, 68

  let byZSlope = mToA(
    reduce(smallData, groupBy(o => o.z, avg(a => a.halfLifeLog10/a.calc5HalfLifeLog10))),
    (o, i) => { return { z: i, slope: o }; }
  );

  createScatterPlot('graph0', byZSlope, 'z', 'slope', {
    title: 'Slope X Z',
    squareAspect: false
  });

  // big outliers: 56

  let byASlope = mToA(
    reduce(smallData, groupBy(o => o.nMinusZ, avg(a => a.halfLifeLog10/a.calc5HalfLifeLog10))),
    (o, i) => { return { nMinusZ: i, slope: o }; }
  );

  createScatterPlot('graph0', byASlope, 'nMinusZ', 'slope', {
    title: 'Slope X N-Z',
    squareAspect: false
  });


});
