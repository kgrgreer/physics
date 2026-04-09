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

  return lines.filter(l => ! l.startsWith('#')).map(l => model(l));
}


load(baseUrl + nubaseFilename, Isotope).then(data => {

  log(`Loaded ${data.length} isotopes.\n`);

  // Apply filtering criteria
  data = data
    .filter(o => o.halfLifeLog10 > -8 && o.halfLifeLog10 < 8) // In reliable range
    .filter(o => o.z)                  // Has Electrons
    .filter(o => ! isNaN(o.t))         // Stable
    .filter(o => o.i == '0');          // Non ground state isotopes
 //   .filter(o => o.halfLifeLog10 < 8); // Long (unreliable) half-lives

  log(`Keeping ${data.length} isotopes.\n`);

  function pointRenderer(x, y, o, i) {
    const s = 255-255*(o.halfLifeLog10+8)/16;
    const color = `rgb(${0},${s},${0})`;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function nMinusZPointRenderer(x, y, o, i) {
    let b = o.beta_exposure;

//    const s = interp(20, 64, 0, 255)(o.nMinusZ);
    const color = o.color; // || b < 0.1 ? 'white' : `rgb(${255},0,0)`;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function exposureRenderer(x, y, o, i) {
    let b = o.beta_exposure;

    const color = `rgb(${(o.n-o.z)*5},0,0)`;
    const isBeta = o.beta_exposure < 0.01;
    const stroke = isBeta ? 'green' : '#222';
    const strokeWidth = isBeta ? 3 : 0; // o.decayModes.indexOf('B-') == -1 ? '2' : '0';
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" data-id="${i}"/>`;
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
  const ecLikeData = data.filter(o => o.decayModes.indexOf('B-') == -1 && o.beta_exposure < 3);

const data2 = ecLikeData.filter(e => e.decayModes=='EC=100' && isFinite(e.calc2HalfLifeLog10))
  createScatterPlot('graph0', data2, 'calc2HalfLifeLog10', 'halfLifeLog10', {
    title: 'Calc2 HL',
    squareAspect: true,
    pointRenderer: nMinusZPointRenderer
  });

  // return;

  createScatterPlot('graph0', data, 'calcHalfLifeLog10', 'halfLifeLog10', {
    title: 'Calc HL',
    squareAspect: true,
    pointRenderer: nMinusZPointRenderer
  });

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: exposureRenderer, customizeSVG: drawMagicLines});

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: pointRenderer, customizeSVG: drawMagicLines});

//  return;
  createScatterPlot('graph0', bMinusData, 'beta_exposure', 'halfLifeLog10', { pointRenderer: exposureRenderer, squareAspect: true });

  createScatterPlot('graph0', bMinusData, 'beta_exposure', 'halfLifeLog10', { pointRenderer: magicRenderer, squareAspect: true });

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
  createScatterPlot('graph0', bMinusData, 'halfLifeLog10', 'calcHalfLifeLog10_Bminus', {
    squareAspect: true,
    title: 'BMinus HL',
    customizePoint: function(o) {
      return [ 3, o.decayModes.startsWith('B-') ? 'black' : 'red' ];
    }
  });

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: pointRenderer, customizeSVG: drawMagicLines });

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'n', 'z');

  document.getElementById('table').innerHTML = foam.TableView(data2, ['nuclide', 'a', 'n', 'z', 'decayModes', 't', 'unit', 'halfLifeLog10', 'calcHalfLifeLog10', 'error', 'calc2HalfLifeLog10']);

  function avg(data, p) {
    let sum = 0;
    data.forEach(o => sum += o[p]);
    return sum/data.length;
  }

  data = data.filter(o => o.decayModes.indexOf('B-=') != -1);
  console.log('average even half-life log10:', avg(data.filter(o => o.z % 2 == 0), 'halfLifeLog10'));
  console.log('average odd  half-life log10:', avg(data.filter(o => o.z % 2 == 1), 'halfLifeLog10'));
});
