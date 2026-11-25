/* Daily Missions icons: drawn on a 24 grid with a thick round ink stroke, to
   match the sticker style. Shapes with fill="sun" etc. pick up the palette. */
(function () {
  "use strict";
  const S = (d) => `<path d="${d}"/>`;
  const F = (d, fill) => `<path d="${d}" class="fill-${fill}"/>`;
  const C = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}"${fill ? ` class="fill-${fill}"` : ""}/>`;
  const face = (mouth) => C(12, 12, 9, "sun") + C(9, 10, 0.9, "ink") + C(15, 10, 0.9, "ink") + S(mouth);

  const ICONS = {
    home: F("M3.5 11.5 12 4l8.5 7.5V20h-17z", "paper") + S("M9.5 20v-5.5h5V20"),
    settings: S("M4 7h9M17 7h3M4 17h3M11 17h9") + C(15, 7, 2.2, "sun") + C(9, 17, 2.2, "pink"),
    close: S("M6 6l12 12M18 6 6 18"),
    pencil: F("M4 20l1.2-4.8L15.5 4.9l3.6 3.6L8.8 18.8z", "sun") + S("M13.5 6.9l3.6 3.6M5.2 15.2l3.6 3.6"),
    eraser: F("M4.5 14.5 13 6l5 5-7.5 7.5h-3z", "pink") + S("M8.7 10.3l5 5M7.5 18.5H20"),
    undo: S("M9 5.5 4.5 10 9 14.5M4.5 10H14a5 5 0 0 1 0 10h-3"),
    redo: S("M15 5.5l4.5 4.5-4.5 4.5M19.5 10H10a5 5 0 0 0 0 10h3"),
    trash: S("M4 7h16M9.5 7V4.5h5V7") + F("M6 7l1 13h10l1-13z", "paper") + S("M10 11v5M14 11v5"),
    bulb: F("M12 3a6 6 0 0 0-3.8 10.6c.9.8 1.3 1.7 1.3 2.9h5c0-1.2.4-2.1 1.3-2.9A6 6 0 0 0 12 3z", "sun") + S("M9.5 19h5M10.5 21.5h3"),
    bolt: F("M13.5 2.5 4.5 14h7l-1 7.5 9-11.5h-7z", "sun"),
    trophy: F("M7.5 4h9v5a4.5 4.5 0 0 1-9 0z", "sun") + S("M7.5 6H5a3 3 0 0 0 3 4M16.5 6H19a3 3 0 0 1-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"),
    flag: S("M5.5 21V3.5") + F("M5.5 4h12l-2.5 4 2.5 4h-12z", "pink"),
    star: F("M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z", "sun"),
    check: S("M4.5 12.5l5 5 10-11"),
    mail: F("M3 6h18v12H3z", "paper") + S("M3 6l9 7 9-7"),
    offline: F("M7 18a4 4 0 0 1-.6-8 6 6 0 0 1 11.3 1.8A3.2 3.2 0 0 1 17.5 18z", "paper") + S("M4 4l16 16"),
    party: F("M3.5 20.5 8 8l8 8z", "sun") + S("M14 4.5v2M19.5 10h-2M17.5 6.5l-1.5 1.5M12 3.5l.5 1M20.5 13.5l-1-.5"),
    moon: F("M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z", "lilac"),
    rocket: F("M12 2.5c3.5 2 5 5.5 5 9.5l-2.5 3.5h-5L7 12c0-4 1.5-7.5 5-9.5z", "paper") + C(12, 9.5, 1.8, "sky") + S("M9.5 15.5 7 19.5l3-1M14.5 15.5 17 19.5l-3-1M12 17v4"),
    easy: face("M7.8 13.5c1.6 3.2 6.8 3.2 8.4 0"),
    ok: face("M8.8 14.6c1.6 1.4 4.8 1.4 6.4 0"),
    tricky: face("M8 15.5c1-1.2 2-1.2 3 0s2 1.2 3 0 2-1.2 2.2 0"),
  };

  window.Icon = function (name, cls) {
    return `<svg class="icon ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  };
})();
