"use client";

import { useEffect, useRef, useState } from "react";
import type { LearningCenter } from "@/lib/types";
import BORDER from "@/lib/chitral-border.json";

/*
 * The Learning Centers map, ported from the old site's wef-centers.js:
 * colour-and-glyph markers per center model, a funding-partner filter,
 * legend toggles and popups. Leaflet is bundled (no CDN) and loaded only in
 * the browser.
 *
 * Colours are Okabe-Ito derived so the five stay separable under red-green
 * colour blindness, and every model also has its own glyph, so colour is
 * never the only cue (WCAG 1.4.1).
 */
const MODEL_ORDER = ["Entrepreneurial Model", "Government School", "Private School", "Elementary School", "Other"];
const MODEL_COLORS: Record<string, string> = {
  "Entrepreneurial Model": "#125740",
  "Government School": "#E69F00",
  "Private School": "#56B4E9",
  "Elementary School": "#CC79A7",
  Other: "#6B6B6B",
};
const MODEL_GLYPHS: Record<string, string> = {
  "Entrepreneurial Model": "M12 3 1 9l11 6 9-4.909V17h2V9L12 3zm6.82 9L12 15.72 5.18 12 3.6 12.87 12 17.46l8.4-4.59L18.82 12z",
  "Government School": "M12 3 3 8v2h18V8l-9-5zM5 12h2.6v5H5v-5zm5.7 0h2.6v5h-2.6v-5zm5.7 0H19v5h-2.6v-5zM3 19h18v2H3v-2z",
  "Private School": "M6 2h13v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2H6zm0 2a.5.5 0 0 0-.5.5V17c.3-.1.6-.2 1-.2H17V4H6z",
  "Elementary School": "M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z",
  Other: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
};
const modelOf = (m: string | null) => (m && MODEL_COLORS[m] ? m : "Other");
const colorFor = (m: string | null) => MODEL_COLORS[modelOf(m)];
const glyphSvg = (m: string | null, cls: string) =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${MODEL_GLYPHS[modelOf(m)]}"/></svg>`;
const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function popupHtml(c: LearningCenter) {
  let rows = "";
  if (c.sponsor) rows += `<div><dt>Made possible by</dt><dd>${esc(c.sponsor)}</dd></div>`;
  if (c.name) rows += `<div><dt>Center lead</dt><dd>${esc(c.name)}</dd></div>`;
  if (c.enrollment != null) rows += `<div><dt>Children enrolled</dt><dd class="wef-pop-enroll">${c.enrollment}</dd></div>`;
  const title = c.village || c.name || "Learning center";
  const region = [c.region, "Chitral, Pakistan"].filter(Boolean).join(" · ");
  return (
    `<div class="wef-pop"><span class="wef-pop-model" style="--c:${colorFor(c.model)}">${glyphSvg(c.model, "wef-pop-model-glyph")}${esc(modelOf(c.model) === "Other" ? c.model || "Other" : c.model)}</span>` +
    `<h3>${esc(title)}</h3><div class="wef-pop-region">${esc(region)}</div>${rows ? `<dl>${rows}</dl>` : ""}</div>`
  );
}

export function CentersMap({ centers, compact = false }: { centers: LearningCenter[]; compact?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const placed = centers.filter((c) => c.lat !== null && c.lon !== null);
  const sponsors = [...new Set(placed.map((c) => c.sponsor).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b));
  const counts: Record<string, number> = {};
  for (const c of placed) counts[modelOf(c.model)] = (counts[modelOf(c.model)] ?? 0) + 1;
  const models = MODEL_ORDER.filter((m) => counts[m]);

  const [sponsor, setSponsor] = useState("");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const visible = placed.filter((c) => (!sponsor || c.sponsor === sponsor) && !hidden[modelOf(c.model)]);

  // Leaflet objects live outside React state; the effects below drive them.
  const api = useRef<{ render: (list: LearningCenter[]) => void; focus: (s: string, list: LearningCenter[]) => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
      });
      const labels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, opacity: 0.9 },
      );
      const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      });
      const satGroup = L.layerGroup([sat, labels]).addTo(map);
      L.control.layers({ Satellite: satGroup, "Street map": street }, {}, { position: "topright", collapsed: true }).addTo(map);
      // If the satellite tiles fail (blocked or offline), fall back so the map is never blank.
      let fellBack = false;
      sat.on("tileerror", () => {
        if (fellBack) return;
        fellBack = true;
        if (map.hasLayer(satGroup)) {
          map.removeLayer(satGroup);
          street.addTo(map);
        }
      });
      // Scroll-zoom only once the map has focus, so the page still scrolls past it.
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());

      const border = BORDER as [number, number][];
      L.polygon(border, {
        color: "#F7F3EA",
        weight: 1.5,
        opacity: 0.9,
        dashArray: "3 6",
        fill: true,
        fillColor: "#77D161",
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      const markers = new Map<LearningCenter, L.Marker>();
      for (const c of placed) {
        const icon = L.divIcon({
          className: "wef-pin-icon",
          html: `<div class="wef-pin" style="--c:${colorFor(c.model)}">${glyphSvg(c.model, "")}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -28],
        });
        const m = L.marker([c.lat!, c.lon!], { icon, title: c.village || c.name || "Learning center", riseOnHover: true });
        m.bindPopup(popupHtml(c), { closeButton: true, maxWidth: 280 });
        markers.set(c, m);
      }

      const fullBounds = border.length ? L.latLngBounds(border) : L.latLngBounds(placed.map((c) => [c.lat!, c.lon!]));
      api.current = {
        render(list) {
          layer.clearLayers();
          for (const c of list) {
            const m = markers.get(c);
            if (m) layer.addLayer(m);
          }
        },
        // A gentle zoom towards the filtered group, or back out to the district.
        focus(s, list) {
          if (!s) {
            map.flyToBounds(fullBounds, { padding: [20, 20], duration: 1.1, maxZoom: 11 });
            return;
          }
          if (!list.length) return;
          const center = L.latLngBounds(list.map((c) => [c.lat!, c.lon!])).getCenter();
          map.flyTo(center, Math.min(Math.max(map.getZoom() + 1.6, 11), 14), { duration: 1.1 });
        },
      };
      map.fitBounds(fullBounds, { padding: [20, 20] });
      api.current.render(placed);

      // Tiles render blank if measured before the map is visible; re-measure.
      const refresh = () => map.invalidateSize();
      const t = setTimeout(refresh, 200);
      window.addEventListener("resize", refresh);
      const io = new IntersectionObserver((ents) => ents.forEach((e) => e.isIntersecting && refresh()), { threshold: 0.05 });
      io.observe(mapRef.current);
      cleanup = () => {
        clearTimeout(t);
        window.removeEventListener("resize", refresh);
        io.disconnect();
        map.remove();
        api.current = null;
      };
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
    // The centers are fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.render(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsor, hidden]);

  return (
    <div className="wef-centers" data-size={compact ? "compact" : undefined}>
      <div className="wef-centers-controls">
        <div className="wef-centers-count">
          <span className="wef-count-num" aria-live="polite">
            {visible.length}
          </span>
          <span className="wef-count-total">
            <span>{visible.length === 1 ? "center" : "centers"}</span> shown
          </span>
        </div>
        <label className="wef-centers-field">
          <span>Find your centers — filter by funding partner</span>
          <span className="wef-select-wrap">
            <select
              aria-label="Filter centers by funding partner"
              value={sponsor}
              onChange={(e) => {
                const s = e.target.value;
                setSponsor(s);
                api.current?.focus(
                  s,
                  placed.filter((c) => (!s || c.sponsor === s) && !hidden[modelOf(c.model)]),
                );
              }}
            >
              <option value="">All funding partners</option>
              {sponsors.map((s) => (
                <option key={s} value={s}>
                  {`${s}  (${placed.filter((c) => c.sponsor === s).length})`}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </label>
      </div>
      <div className="wef-centers-mapwrap">
        <div
          className="wef-centers-map"
          ref={mapRef}
          tabIndex={0}
          role="application"
          aria-label="Interactive map of WEF learning centers in Chitral, Pakistan"
        />
        <div className="wef-centers-legend" aria-label="Center types">
          <h4>Center type — tap to filter</h4>
          <div className="wef-legend-items">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                className={`wef-legend-item${hidden[m] ? " is-off" : ""}`}
                aria-pressed={!hidden[m]}
                onClick={() => setHidden((h) => ({ ...h, [m]: !h[m] }))}
              >
                <span className="wef-legend-dot" style={{ background: colorFor(m) }}>
                  <svg className="wef-legend-glyph" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={MODEL_GLYPHS[m]} />
                  </svg>
                </span>
                <span className="wef-legend-label">{m}</span>
                <span className="wef-legend-count">{counts[m]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
