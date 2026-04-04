foam = {
  CLASS: function(model) {

    globalThis[model.name] = function(str) {
      var o = { model_: model };

      model.properties.forEach(p => {
        if ( p.start ) {
          var subStr = str.slice(p.start-1, p.end).trim();
          o[p.name] = { Int: parseInt, Float: parseFloat, String: s => s }[p.class || 'String'](subStr);
        } else if ( p.factory ) {
          o[p.name] = p.factory.call(o);
        }
      });

      return o;
    };

    globalThis[model.name].model_ = model;
  },

  TableView: function(data, cols) {
    let html = '<table><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

    function format(v) {
      return typeof v === 'number' && ! Number.isInteger(v) ? v.toFixed(2) : v;
    }

    data.forEach(o => {
      html += '<tr>' + cols.map(c => `<td>${o[c] !== undefined ? format(o[c]) : ''}</td>`).join('') + '</tr>';
    });

    html += '</table>';

    return html;
  }
};
