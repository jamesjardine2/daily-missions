/* Daily Missions: a handwriting pad for Apple Pencil.
   Strokes are kept in a fixed logical space (1000 units wide) so the drawing
   survives rotating the iPad. Once a Pencil has touched the pad, finger touches
   are ignored (palm rejection). */
(function () {
  "use strict";

  const W = 1000;                 // logical width
  const LINE = 118;               // logical height of one writing line
  const TOP = 40;                 // space above the first line
  const SIZES = { small: 360, medium: 560, large: 780 };
  const INK = "#1f2a44";
  let penSeen = false;            // shared by every pad on the page

  function layout(opts) {
    if (opts.kind === "lined") return { h: TOP + LINE * opts.lines + 26 };
    return { h: SIZES[opts.size] || SIZES.medium };
  }

  function paintPaper(ctx, s, opts, h) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W * s, h * s);
    if (opts.kind === "lined") {
      for (let i = 0; i < opts.lines; i++) {
        const base = TOP + LINE * (i + 1) - 18;
        const mid = base - LINE * 0.36;
        const top = base - LINE * 0.72;
        ctx.lineWidth = 1.5 * s;
        ctx.strokeStyle = "#d7dbe6";
        ctx.setLineDash([]);
        line(ctx, s, top);
        ctx.strokeStyle = "#c5cbe0";
        ctx.setLineDash([7 * s, 9 * s]);
        line(ctx, s, mid);
        ctx.setLineDash([]);
        ctx.lineWidth = 2.5 * s;
        ctx.strokeStyle = "#8f9bc2";
        line(ctx, s, base);
      }
      if (opts.model) {
        ctx.fillStyle = "rgba(31,42,68,0.16)";
        ctx.font = `${LINE * 0.62 * s}px "Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif`;
        ctx.textBaseline = "alphabetic";
        wrapText(ctx, opts.model, 30 * s, (TOP + LINE - 18) * s, (W - 60) * s, LINE * s, opts.lines);
      }
    } else if (opts.grid) {
      ctx.fillStyle = "#c5cbe0";
      for (let x = 25; x < W; x += 50) for (let y = 25; y < h; y += 50) {
        ctx.beginPath(); ctx.arc(x * s, y * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function line(ctx, s, y) {
    ctx.beginPath(); ctx.moveTo(18 * s, y * s); ctx.lineTo((W - 18) * s, y * s); ctx.stroke();
  }

  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(/\s+/);
    let row = "", n = 0;
    for (const w of words) {
      const test = row ? row + " " + w : w;
      if (ctx.measureText(test).width > maxW && row) {
        ctx.fillText(row, x, y); y += lh; row = w; n++;
        if (n >= maxLines) return;
      } else row = test;
    }
    if (row && n < maxLines) ctx.fillText(row, x, y);
  }

  function paintStroke(ctx, s, st) {
    const p = st.p;
    if (!p.length) return;
    ctx.strokeStyle = st.c || INK;
    ctx.fillStyle = st.c || INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const base = st.w || 6;
    if (p.length === 1) {
      ctx.beginPath(); ctx.arc(p[0][0] * s, p[0][1] * s, (base * widthFor(p[0][2])) / 2 * s, 0, Math.PI * 2); ctx.fill();
      return;
    }
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      ctx.lineWidth = base * widthFor((a[2] + b[2]) / 2) * s;
      ctx.beginPath();
      if (i === 1) ctx.moveTo(a[0] * s, a[1] * s);
      else { const m = mid(p[i - 2], a); ctx.moveTo(m[0] * s, m[1] * s); }
      const m2 = mid(a, b);
      ctx.quadraticCurveTo(a[0] * s, a[1] * s, m2[0] * s, m2[1] * s);
      ctx.stroke();
    }
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const widthFor = (pr) => (pr == null ? 1 : 0.55 + pr * 0.9);

  /* create(container, opts, strokes, onChange)
     opts: { kind: "lined" | "blank", lines, size, grid, model, colours: true }
     strokes: saved array (mutated in place) */
  function create(host, opts, strokes, onChange) {
    const { h } = layout(opts);
    const wrap = document.createElement("div");
    wrap.className = "pad";
    const tools = document.createElement("div");
    tools.className = "pad-tools";
    const canvas = document.createElement("canvas");
    canvas.className = "pad-canvas";
    canvas.style.aspectRatio = `${W} / ${h}`;
    wrap.append(canvas, tools);
    host.append(wrap);

    const ctx = canvas.getContext("2d");
    let scale = 1, mode = "pen", colour = INK, current = null, activeId = null;
    const redo = [];

    function fit() {
      const cssW = canvas.clientWidth || 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * dpr * h / W);
      scale = canvas.width / W;
      render();
    }
    function render() {
      paintPaper(ctx, scale, opts, h);
      for (const st of strokes) paintStroke(ctx, scale, st);
      if (current) paintStroke(ctx, scale, current);
    }
    function pt(e) {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * h;
      const pr = e.pointerType === "pen" ? (e.pressure || 0.5) : null;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, pr == null ? null : Math.round(pr * 100) / 100];
    }
    function eraseAt(p) {
      const R = 22;
      let hit = false;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].p.some((q) => Math.abs(q[0] - p[0]) < R && Math.abs(q[1] - p[1]) < R)) {
          redo.push(strokes[i]); strokes.splice(i, 1); hit = true;
        }
      }
      if (hit) { render(); onChange && onChange(); }
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen") penSeen = true;
      if (e.pointerType === "touch" && penSeen && !window.dmFingerDrawing) return;
      if (activeId !== null) return;
      e.preventDefault();
      activeId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
      const p = pt(e);
      if (mode === "erase") { eraseAt(p); return; }
      current = { p: [p], c: colour, w: colour === INK ? 6 : 16 };
      render();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== activeId) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const p = pt(ev);
        if (mode === "erase") eraseAt(p);
        else if (current) {
          const last = current.p[current.p.length - 1];
          if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) > 1.2) current.p.push(p);
        }
      }
      if (current) render();
    });
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      if (current) {
        strokes.push(current); current = null; redo.length = 0;
        render(); onChange && onChange();
      }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    // Stop iPad Safari scrolling or selecting text while writing.
    canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

    function button(label, title, fn, cls) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tool " + (cls || ""); b.innerHTML = label; b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", fn);
      tools.append(b);
      return b;
    }
    const penBtn = button(Icon("pencil"), "Pencil", () => setMode("pen"), "on");
    const swatches = [];
    if (opts.colours) {
      for (const c of ["#1f2a44", "#ff4f8b", "#2b8fe0", "#16a34a", "#f5a300"]) {
        const sw = button("", "Colour", () => { colour = c; setMode("pen"); swatches.forEach((x) => x.classList.toggle("on", x === sw)); }, "swatch");
        sw.style.setProperty("--sw", c);
        if (c === INK) sw.classList.add("on");
        swatches.push(sw);
      }
    }
    const eraseBtn = button(Icon("eraser"), "Rubber", () => setMode("erase"));
    button(Icon("undo"), "Undo", () => { if (strokes.length) { redo.push(strokes.pop()); render(); onChange && onChange(); } });
    button(Icon("redo"), "Redo", () => { if (redo.length) { strokes.push(redo.pop()); render(); onChange && onChange(); } });
    button(Icon("trash"), "Start again", () => {
      if (!strokes.length) return;
      if (confirm("Rub out everything on this page?")) { strokes.length = 0; redo.length = 0; render(); onChange && onChange(); }
    }, "right");
    function setMode(m) { mode = m; penBtn.classList.toggle("on", m === "pen"); eraseBtn.classList.toggle("on", m === "erase"); }

    const ro = new ResizeObserver(() => fit());
    ro.observe(canvas);
    requestAnimationFrame(fit);
    return { destroy: () => ro.disconnect(), redraw: fit };
  }

  /* Render saved strokes to a PNG data URL for marking. */
  function toPNG(opts, strokes) {
    const { h } = layout(opts);
    const s = 1.2;
    const c = document.createElement("canvas");
    c.width = Math.round(W * s); c.height = Math.round(h * s);
    const ctx = c.getContext("2d");
    paintPaper(ctx, s, opts, h);
    for (const st of strokes) paintStroke(ctx, s, st);
    return c.toDataURL("image/png");
  }

  window.Pad = { create, toPNG };
})();
