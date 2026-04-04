const local          = true;  // true = local files; false = direct IAEA fetch
const baseUrl        = local ? '' : 'https://www-nds.iaea.org/amdc/ame2020/';
const nubaseFilename = 'nubase_4.mas20.txt';

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

  createScatterPlot('graph0', data, 'halfLifeLog10', 'calcHalfLifeLog10', {
    squareAspect: true,
    customizePoint: function(o) {
      return [ 3, o.decayModes.startsWith('B-') ? 'black' : 'red' ];
    }
  });

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'halfLifeLog10', 'calcHalfLifeLog10_Bminus', {
    squareAspect: true,
    customizePoint: function(o) {
      return [ 3, o.decayModes.startsWith('B-') ? 'black' : 'red' ];
    }
  });

  createScatterPlot('graph0', data, 'n', 'z');

  createScatterPlot('graph0', data.filter(o => o.decayModes.startsWith('B-')), 'n', 'z');

//  document.getElementById('table').innerHTML = foam.TableView(data, ['nuclide', 'a', 'n', 'z', 'decayModes', 't', 'unit', 'halfLifeLog10', 'calcHalfLifeLog10']);

});
