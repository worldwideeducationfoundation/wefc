/* ==========================================================================
   WEF — Learning Centers interactive map.
   Renders every [data-wef-centers] block from window.WEF_CENTERS_DATA using
   Leaflet: colour-by-model markers, sponsor filter, legend toggles, popups.
   Requires Leaflet (L) and centers-data.js to be loaded first.
   ========================================================================== */
(function () {
  if (typeof L === 'undefined' || !window.WEF_CENTERS_DATA) return;

  var DATA = window.WEF_CENTERS_DATA;

  /* Brand-adjacent categorical palette, fixed order for the legend. */
  var MODEL_ORDER = ['Entrepreneurial Model', 'Government School', 'Private School', 'Elementary School', 'Other'];
  var MODEL_COLORS = {
    'Entrepreneurial Model': '#2F6B45',
    'Government School': '#C6923E',
    'Private School': '#2C6E7A',
    'Elementary School': '#B4553B',
    'Other': '#7C8A80'
  };
  function colorFor(m) { return MODEL_COLORS[m] || MODEL_COLORS.Other; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function popupHtml(c) {
    var rows = '';
    if (c.sponsor) rows += '<div><dt>Made possible by</dt><dd>' + esc(c.sponsor) + '</dd></div>';
    if (c.name) rows += '<div><dt>Center lead</dt><dd>' + esc(c.name) + '</dd></div>';
    if (c.enrollment != null) rows += '<div><dt>Children enrolled</dt><dd class="wef-pop-enroll">' + c.enrollment + '</dd></div>';
    var title = c.village || c.name || 'Learning center';
    var region = [c.region, 'Chitral, Pakistan'].filter(Boolean).join(' · ');
    return '<div class="wef-pop">' +
      '<span class="wef-pop-model" style="--c:' + colorFor(c.model) + '">' + esc(c.model) + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<div class="wef-pop-region">' + esc(region) + '</div>' +
      (rows ? '<dl>' + rows + '</dl>' : '') +
      '</div>';
  }

  function buildOne(root) {
    var mapEl = root.querySelector('[data-map]');
    var legendEl = root.querySelector('[data-legend]');
    var sponsorSel = root.querySelector('[data-sponsor]');
    var countEl = root.querySelector('[data-count]');
    var countLabel = root.querySelector('[data-count-label]');
    if (!mapEl) return;

    var map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });

    var sat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, attribution: 'Imagery &copy; Esri' }
    );
    var labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.9 }
    );
    var satGroup = L.layerGroup([sat, labels]);
    var street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    });
    satGroup.addTo(map);
    L.control.layers(
      { 'Satellite': satGroup, 'Street map': street },
      {}, { position: 'topright', collapsed: true }
    ).addTo(map);

    /* Enable scroll-zoom only after the map is clicked/focused, so the page still scrolls past it. */
    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur', function () { map.scrollWheelZoom.disable(); });

    /* District boundary */
    if (DATA.border && DATA.border.length) {
      L.polygon(DATA.border, {
        color: '#F7F3EA', weight: 1.5, opacity: 0.9, dashArray: '3 6',
        fill: true, fillColor: '#2F6B45', fillOpacity: 0.05, interactive: false
      }).addTo(map);
    }

    /* Markers */
    var markersLayer = L.layerGroup().addTo(map);
    var entries = DATA.centers.map(function (c) {
      var m = L.circleMarker([c.lat, c.lon], {
        radius: 6.5, color: '#ffffff', weight: 1.6, opacity: 1,
        fillColor: colorFor(c.model), fillOpacity: 0.92, className: 'wef-marker-hit'
      });
      m.bindPopup(popupHtml(c), { closeButton: true, maxWidth: 280 });
      m.on('mouseover', function () { m.setRadius(9); m.setStyle({ weight: 2.2 }); });
      m.on('mouseout', function () { m.setRadius(6.5); m.setStyle({ weight: 1.6 }); });
      return { marker: m, sponsor: c.sponsor || '', model: c.model, latlng: [c.lat, c.lon] };
    });

    var hiddenModels = {};
    var activeSponsor = '';

    function visibleEntries() {
      return entries.filter(function (e) {
        return (!activeSponsor || e.sponsor === activeSponsor) && !hiddenModels[e.model];
      });
    }
    function render(fit) {
      markersLayer.clearLayers();
      var vis = visibleEntries();
      vis.forEach(function (e) { markersLayer.addLayer(e.marker); });
      if (countEl) countEl.textContent = vis.length;
      if (countLabel) countLabel.textContent = vis.length === 1 ? 'center' : 'centers';
      if (fit && vis.length) {
        var b = L.latLngBounds(vis.map(function (e) { return e.latlng; }));
        map.fitBounds(b, { padding: [42, 42], maxZoom: 12 });
      }
    }

    /* Sponsor filter */
    if (sponsorSel && DATA.meta && DATA.meta.sponsors) {
      DATA.meta.sponsors.forEach(function (s) {
        var n = entries.filter(function (e) { return e.sponsor === s; }).length;
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + '  (' + n + ')';
        sponsorSel.appendChild(opt);
      });
      sponsorSel.addEventListener('change', function () {
        activeSponsor = sponsorSel.value;
        render(true);
      });
    }

    /* Legend with toggles */
    if (legendEl) {
      var counts = {};
      entries.forEach(function (e) { counts[e.model] = (counts[e.model] || 0) + 1; });
      var items = MODEL_ORDER.filter(function (m) { return counts[m]; });
      var html = '<h4>Center type — tap to filter</h4><div class="wef-legend-items">';
      items.forEach(function (m) {
        html += '<button type="button" class="wef-legend-item" data-model="' + esc(m) + '">' +
          '<span class="wef-legend-dot" style="background:' + colorFor(m) + '"></span>' +
          '<span class="wef-legend-label">' + esc(m) + '</span>' +
          '<span class="wef-legend-count">' + counts[m] + '</span></button>';
      });
      html += '</div>';
      legendEl.innerHTML = html;
      legendEl.querySelectorAll('.wef-legend-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var m = btn.getAttribute('data-model');
          hiddenModels[m] = !hiddenModels[m];
          btn.classList.toggle('is-off', !!hiddenModels[m]);
          render(false);
        });
      });
    }

    /* Initial view + render */
    var initBounds = DATA.border && DATA.border.length
      ? L.latLngBounds(DATA.border)
      : L.latLngBounds(entries.map(function (e) { return e.latlng; }));
    map.fitBounds(initBounds, { padding: [20, 20] });
    render(false);

    setTimeout(function () { map.invalidateSize(); }, 200);
    window.addEventListener('resize', function () { map.invalidateSize(); });
  }

  function init() {
    document.querySelectorAll('[data-wef-centers]').forEach(buildOne);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
