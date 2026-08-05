/* ==========================================================================
   WEF — Learning Centers interactive map.
   Renders every [data-wef-centers] block from window.WEF_CENTERS_DATA using
   Leaflet: colour-by-model markers, sponsor filter, legend toggles, popups.
   Requires Leaflet (L) and centers-data.js to be loaded first.
   ========================================================================== */
(function () {
  if (typeof L === 'undefined' || !window.WEF_CENTERS_DATA) return;

  var DATA = window.WEF_CENTERS_DATA;

  /* Categorical palette, fixed order for the legend.
     Chosen so the five stay separable for red-green colour blindness, which the
     previous green/gold/terracotta set did not: simulated under deuteranopia and
     protanopia the closest pair was ~16 RGB units apart (Private vs Other were
     effectively the same colour). This set is Okabe-Ito derived, keeps the brand
     green for the flagship model, and holds a worst-pair distance of ~57 while
     also spreading lightness (L* 33-71) so it survives greyscale.

     Colour is still never the ONLY cue — every model also carries its own glyph
     below, on the marker, in the legend key and in the popup chip (WCAG 1.4.1). */
  var MODEL_ORDER = ['Entrepreneurial Model', 'Government School', 'Private School', 'Elementary School', 'Other'];
  var MODEL_COLORS = {
    'Entrepreneurial Model': '#125740',
    'Government School': '#E69F00',
    'Private School': '#56B4E9',
    'Elementary School': '#CC79A7',
    'Other': '#6B6B6B'
  };

  /* Distinct silhouettes, readable at the 15px the marker renders them at. */
  var MODEL_GLYPHS = {
    'Entrepreneurial Model': 'M12 3 1 9l11 6 9-4.909V17h2V9L12 3zm6.82 9L12 15.72 5.18 12 3.6 12.87 12 17.46l8.4-4.59L18.82 12z',
    'Government School': 'M12 3 3 8v2h18V8l-9-5zM5 12h2.6v5H5v-5zm5.7 0h2.6v5h-2.6v-5zm5.7 0H19v5h-2.6v-5zM3 19h18v2H3v-2z',
    'Private School': 'M6 2h13v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2H6zm0 2a.5.5 0 0 0-.5.5V17c.3-.1.6-.2 1-.2H17V4H6z',
    'Elementary School': 'M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z',
    'Other': 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z'
  };
  function colorFor(m) { return MODEL_COLORS[m] || MODEL_COLORS.Other; }
  function glyphFor(m) { return MODEL_GLYPHS[m] || MODEL_GLYPHS.Other; }
  function glyphSvg(m, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      glyphFor(m) + '"/></svg>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function popupHtml(c) {
    var rows = '';
    if (c.sponsor) rows += '<div><dt>Made possible by</dt><dd>' + esc(c.sponsor) + '</dd></div>';
    if (c.name) rows += '<div><dt>Center lead</dt><dd>' + esc(c.name) + '</dd></div>';
    if (c.enrollment != null) rows += '<div><dt>Children enrolled</dt><dd class="wef-pop-enroll">' + c.enrollment + '</dd></div>';
    var title = c.village || c.name || 'Learning center';
    var region = [c.region, 'Chitral, Pakistan'].filter(Boolean).join(' · ');
    return '<div class="wef-pop">' +
      '<span class="wef-pop-model" style="--c:' + colorFor(c.model) + '">' +
      glyphSvg(c.model, 'wef-pop-model-glyph') + esc(c.model) + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<div class="wef-pop-region">' + esc(region) + '</div>' +
      (rows ? '<dl>' + rows + '</dl>' : '') +
      '</div>';
  }

  function schoolIcon(model) {
    return L.divIcon({
      className: 'wef-pin-icon',
      html: '<div class="wef-pin" style="--c:' + colorFor(model) + '">' +
        glyphSvg(model, '') + '</div>',
      iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
    });
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
      { maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }
    );
    var labels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.9 }
    );
    var street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    });
    var satGroup = L.layerGroup([sat, labels]);
    satGroup.addTo(map);
    var layersCtl = L.control.layers(
      { 'Satellite': satGroup, 'Street map': street },
      {}, { position: 'topright', collapsed: true }
    ).addTo(map);

    /* Safety net: if the satellite tiles ever fail to load (blocked/offline on a
       given host), fall back to the street basemap so the map is never blank. */
    var fellBack = false;
    sat.on('tileerror', function () {
      if (fellBack) return; fellBack = true;
      if (map.hasLayer(satGroup)) { map.removeLayer(satGroup); street.addTo(map); }
    });

    /* Enable scroll-zoom only after the map is clicked/focused, so the page still scrolls past it. */
    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur', function () { map.scrollWheelZoom.disable(); });

    /* District boundary */
    if (DATA.border && DATA.border.length) {
      L.polygon(DATA.border, {
        color: '#F7F3EA', weight: 1.5, opacity: 0.9, dashArray: '3 6',
        fill: true, fillColor: '#61AF54', fillOpacity: 0.05, interactive: false
      }).addTo(map);
    }

    /* Markers */
    var markersLayer = L.layerGroup().addTo(map);
    var entries = DATA.centers.map(function (c) {
      var m = L.marker([c.lat, c.lon], {
        icon: schoolIcon(c.model),
        title: (c.village || c.name || 'Learning center'),
        riseOnHover: true
      });
      m.bindPopup(popupHtml(c), { closeButton: true, maxWidth: 280 });
      return { marker: m, sponsor: c.sponsor || '', model: c.model, latlng: [c.lat, c.lon] };
    });

    var hiddenModels = {};
    var activeSponsor = '';

    function visibleEntries() {
      return entries.filter(function (e) {
        return (!activeSponsor || e.sponsor === activeSponsor) && !hiddenModels[e.model];
      });
    }
    function render() {
      markersLayer.clearLayers();
      var vis = visibleEntries();
      vis.forEach(function (e) { markersLayer.addLayer(e.marker); });
      if (countEl) countEl.textContent = vis.length;
      if (countLabel) countLabel.textContent = vis.length === 1 ? 'center' : 'centers';
    }

    /* A gentle "something changed" nudge: zoom in a little on the filtered
       group's centre rather than snapping hard to its exact bounds (which
       would jump wildly depending on how spread out that sponsor's centers
       are). Clearing the filter eases back out to the full district view. */
    var fullBounds = (DATA.border && DATA.border.length)
      ? L.latLngBounds(DATA.border)
      : L.latLngBounds(entries.map(function (e) { return e.latlng; }));
    function focusOn(sponsor) {
      if (!sponsor) {
        map.flyToBounds(fullBounds, { padding: [20, 20], duration: 1.1, maxZoom: 11 });
        return;
      }
      var vis = visibleEntries();
      if (!vis.length) return;
      var center = L.latLngBounds(vis.map(function (e) { return e.latlng; })).getCenter();
      var targetZoom = Math.min(Math.max(map.getZoom() + 1.6, 11), 14);
      map.flyTo(center, targetZoom, { duration: 1.1 });
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
        render();
        focusOn(activeSponsor);
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
          '<span class="wef-legend-dot" style="background:' + colorFor(m) + '">' +
          glyphSvg(m, 'wef-legend-glyph') + '</span>' +
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
          render();
        });
      });
    }

    /* Initial view + render — shows every center by default */
    map.fitBounds(fullBounds, { padding: [20, 20] });
    render();

    /* Tiles can render blank if the map is measured before it is actually
       visible (e.g. inside a scroll-reveal / transformed ancestor). Recompute
       size on load, on resize, and the first time it scrolls into view. */
    function refresh() { map.invalidateSize(); }
    setTimeout(refresh, 200);
    window.addEventListener('load', refresh);
    window.addEventListener('resize', refresh);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { if (e.isIntersecting) { refresh(); } });
      }, { threshold: 0.05 });
      io.observe(mapEl);
    }
  }

  function init() {
    document.querySelectorAll('[data-wef-centers]').forEach(buildOne);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
