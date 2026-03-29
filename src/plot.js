// ====================== INLINE SVG SCATTER PLOT ======================
function createScatterPlot(id, rows, xName, yName, errorName) {
  const width   = 400;
  const height  = 400;
  const padding = 40;

  // Find min/max for scaling
  const xValues = rows.map(r => parseFloat(r[xName]));
  const yValues = rows.map(r => parseFloat(r[yName]));

  const xMin = Math.min(...xValues) - 1;
  const xMax = Math.max(...xValues) + 1;
  const yMin = Math.min(...yValues) - 1;
  const yMax = Math.max(...yValues) + 1;

  // SVG container
  let svg = `<svg width="${width}" height="${height}" style="background:#f8f8f8; font-family:sans-serif;">`;

  // Axes
  svg += `<line x1="${padding}" y1="${height-padding}" x2="${width-padding}" y2="${height-padding}" stroke="#333" stroke-width="2"/>`; // x-axis
  svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height-padding}" stroke="#333" stroke-width="2"/>`; // y-axis

  // Labels
  svg += `<text x="${width/2}" y="${height-15}" text-anchor="middle" font-size="14">Observed log₁₀(t½)</text>`;
  svg += `<text x="20" y="${height/2}" text-anchor="middle" transform="rotate(-90 20 ${height/2})" font-size="14">Predicted log₁₀(t½)</text>`;

  // 1:1 reference line
  const x1 = padding + (xMin - xMin) / (xMax - xMin) * (width - 2*padding);
  const y1 = height - padding - (xMin - yMin) / (yMax - yMin) * (height - 2*padding);
  const x2 = padding + (xMax - xMin) / (xMax - xMin) * (width - 2*padding);
  const y2 = height - padding - (xMax - yMin) / (yMax - yMin) * (height - 2*padding);
  svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#999" stroke-dasharray="4" stroke-width="1"/>`;

  // Plot points
  rows.forEach(r => {
    const x = parseFloat(r[xName]);
    const y = parseFloat(r[yName]);

    const px = padding + (x - xMin) / (xMax - xMin) * (width - 2*padding);
    const py = height - padding - (y - yMin) / (yMax - yMin) * (height - 2*padding);

    const error = Math.abs(parseFloat(r[errorName]) || 0);
    const radius = 4; // + Math.min(error * 1.2, 8);   // larger dot = bigger error
    const color = error > 2 ? '#e74c3c' : (error > 1 ? '#f39c12' : '#3498db');

    svg += `<circle cx="${px}" cy="${py}" r="${radius}" fill="${color}" stroke="#222" stroke-width="1"
             data-nuclide="${r.nuclide}" data-obs="${x.toFixed(2)}" data-pred="${y.toFixed(2)}" data-error="${error.toFixed(2)}"/>`;
  });

  svg += '</svg>';

  // Add tooltip support (simple hover)
  const tooltip = document.createElement('div');
  tooltip.style.position = 'absolute';
  tooltip.style.background = 'rgba(0,0,0,0.8)';
  tooltip.style.color = 'white';
  tooltip.style.padding = '6px 10px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '13px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  // Insert SVG
  const container = document.createElement('div');
  container.innerHTML = svg;
  document.getElementById('graphContainer')?.remove(); // clear old if exists
  container.id = id;;
  document.body.appendChild(container);

  // Simple tooltip on hover
  container.querySelectorAll('circle').forEach(circle => {
    circle.addEventListener('mousemove', e => {
      tooltip.style.left = (e.pageX + 15) + 'px';
      tooltip.style.top = (e.pageY - 10) + 'px';
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        ${circle.dataset.nuclide}<br>
        Obs: ${circle.dataset.obs}<br>
        Pred: ${circle.dataset.pred}<br>
        Error: ${circle.dataset[errorName]} dex
      `;
    });
    circle.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  });
}
