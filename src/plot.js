// ====================== INLINE SVG SCATTER PLOT ======================
// options = {
//   squareAspect: true,     // default: enforce square aspect ratio (recommended)
//   xLabel: null,           // if not provided, falls back to xName
//   yLabel: null            // if not provided, falls back to yName
// }
function createScatterPlot(id, rows, xName, yName, errorName, options = {}) {
  const width   = 500;
  const height  = 500;
  const padding = 50;

  // Default labels if not provided in options
  const xLabel  = options.xLabel !== undefined ? options.xLabel : xName;
  const yLabel  = options.yLabel !== undefined ? options.yLabel : yName;

  const xValues = rows.map(r => parseFloat(r[xName]));
  const yValues = rows.map(r => parseFloat(r[yName]));

  let dataMin, dataMax;

  if ( options.squareAspect ) {
    // Honest square aspect ratio (recommended for model comparison)
    const allValues = [...xValues, ...yValues];
    dataMin = Math.min(...allValues) - 0.5;
    dataMax = Math.max(...allValues) + 0.5;
  } else {
    // Independent scaling (useful for data exploration)
    dataMin = Math.min(...xValues) - 0.5;
    dataMax = Math.max(...xValues) + 0.5;
  }

  // SVG container
  let svg = `<svg width="${width}" height="${height}" style="background:#f8f8f8; font-family:sans-serif;">`;

  // Axes
  svg += `<line x1="${padding}" y1="${height-padding}" x2="${width-padding}" y2="${height-padding}" stroke="#333" stroke-width="2"/>`;
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height-padding}" stroke="#333" stroke-width="2"/>`;

  // Labels
  svg += `<text x="${width/2}" y="${height-15}" text-anchor="middle" font-size="14">${xLabel}</text>`;
  svg += `<text x="20" y="${height/2}" text-anchor="middle" transform="rotate(-90 20 ${height/2})" font-size="14">${yLabel}</text>`;

  // 1:1 reference line
  const x1 = padding + (dataMin - dataMin) / (dataMax - dataMin) * (width - 2*padding);
  const y1 = height - padding - (dataMin - dataMin) / (dataMax - dataMin) * (height - 2*padding);
  const x2 = padding + (dataMax - dataMin) / (dataMax - dataMin) * (width - 2*padding);
  const y2 = height - padding - (dataMax - dataMin) / (dataMax - dataMin) * (height - 2*padding);
  svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#999" stroke-dasharray="4" stroke-width="1"/>`;

  // Plot points
  rows.forEach((r,i) => {
    const x  = parseFloat(r[xName]);
    const y  = parseFloat(r[yName]);
    const px = padding + (x - dataMin) / (dataMax - dataMin) * (width - 2*padding);

    let py;
    if ( options.squareAspect ) {
      py = height - padding - (y - dataMin) / (dataMax - dataMin) * (height - 2*padding);
    } else {
      const yMin = Math.min(...yValues) - 0.5;
      const yMax = Math.max(...yValues) + 0.5;
      py = height - padding - (y - yMin) / (yMax - yMin) * (height - 2*padding);
    }

    const error  = Math.abs(parseFloat(r[errorName]) || 0);
    let   radius = 1;
    let   color  = error > 2 ? '#e74c3c' : (error > 1 ? '#f39c12' : '#3498db');
    color = r.isBetaMinusCandidate ? 'orange': 'white';
    color = 'white';
    /*
    color = 'black';
    if ( r.br.startsWith('B+') ) color = 'red';
    if ( r.br.startsWith('B-') ) color = 'orange';
    if ( r.br.startsWith('A')  ) color = 'yellow';
    if ( r.br.startsWith('EC') ) color = 'green';
    if ( r.br.startsWith('SF') ) color = 'brown';
    */
//    if ( rr > 1.5 && rr < 1.56 ) { color = 'red'; radius += 4; }
//    color = (['red', 'orange', 'yellow', 'green', 'brown', 'pink', 'yello', 'black'])[r.a % 8];

    if ( r.n == options.n ) { radius = 4; color = r.z % 2 ? 'red' : 'black'; } else { radius = 1; color = 'white'; }
//        if ( r.z == options.z ) { color = 'red'; } else { color = 'white'; }
//    if ( color == 'red' && ( r.z == 2 || r.z == 10 || r.z == 18 || r.z == 36 || r.z == 54 || r.z == 86 ) ) { color='black'; radius = 8; } //color='red';
    /*if ( color != 'white' )*/   svg += `<circle cx="${px}" cy="${py}" r="${radius}" fill="${color}" stroke="#222" stroke-width="0.3" data-id="${i}"/>`;
  });

  svg += '</svg>';

  // Tooltip support (unchanged)
  const tooltip = document.createElement('div');
  tooltip.style.position      = 'absolute';
  tooltip.style.background    = 'rgba(0,0,0,0.8)';
  tooltip.style.color         = 'white';
  tooltip.style.padding       = '6px 10px';
  tooltip.style.borderRadius  = '4px';
  tooltip.style.fontSize      = '13px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.display       = 'none';
  document.body.appendChild(tooltip);

  const container = document.createElement('div');
  container.innerHTML = svg;
  document.getElementById('graphContainer')?.remove();
  container.id = id;
  document.body.appendChild(container);

  // Hover tooltip
  container.querySelectorAll('circle').forEach(circle => {
    circle.addEventListener('mousemove', e => {
      const row = rows[circle.dataset.id];
      tooltip.style.left    = (e.pageX + 15) + 'px';
      tooltip.style.top     = (e.pageY - 10) + 'px';
      tooltip.style.display = 'block';
      tooltip.innerHTML     = `
        ${row.nuclide}<br>
        N=${row.n}, Z=${row.z}<br>
        Obs: ${row[xName].toFixed(2)}<br>
        Pred: ${row[yName].toFixed(2)}<br>
        Error: ${row[errorName].toFixed(2)} dex
      `;
    });
    circle.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  });
}
