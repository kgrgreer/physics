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
    const s = 255*(o.halfLifeLog10+8)/16;
    const color = `rgb(${s},${s},${s})`;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function nMinusZPointRenderer(x, y, o, i) {
    let b = o.beta_exposure;

//    const s = interp(20, 64, 0, 255)(o.nMinusZ);
    const color = b < 0.1 ? 'white' : `rgb(${255},0,0)`;
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  }

  function exposureRenderer(x, y, o, i) {
    let b = o.beta_exposure;

    const color = `rgb(${(o.n-o.z)*10},0,0)`;
    const stroke = o.decayModes.indexOf('B-') == -1 ? 'green' : '#222';
    const strokeWidth = o.decayModes.indexOf('B-') == -1 ? '2' : '0';
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


  ////////////////////////////////////////////////////////////////////////////// Graphs

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: exposureRenderer, customizeSVG: drawMagicLines});

  createScatterPlot('graph0', data.filter(o => o.decayModes.indexOf('B-=') != -1), 'beta_exposure', 'halfLifeLog10', { xxxpointRenderer: exposureRenderer, squareAspect: true });

  return;

  createScatterPlot('graph0', data, 'halfLifeLog10', 'calcHalfLifeLog10', {
    squareAspect: true,
    pointRenderer: nMinusZPointRenderer
  });

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'halfLifeLog10', 'calcHalfLifeLog10_Bminus', {
    squareAspect: true,
    customizePoint: function(o) {
      return [ 3, o.decayModes.startsWith('B-') ? 'black' : 'red' ];
    }
  });

  createScatterPlot('graph0', data, 'n', 'z', { pointRenderer: pointRenderer, customizeSVG: drawMagicLines });

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'n', 'z');

//  document.getElementById('table').innerHTML = foam.TableView(data, ['nuclide', 'a', 'n', 'z', 'decayModes', 't', 'unit', 'halfLifeLog10', 'calcHalfLifeLog10']);

});
