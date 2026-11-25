/* Daily Missions: ten minutes of practice a day, marked by Claude.
   Data lives in a private GitHub repo, reached with a fine-grained key saved on
   this device only. Data format: SCHEMA.md in the data repo. */
(function () {
  "use strict";

  const CFG = "dm.config";
  const app = document.getElementById("app");
  const POLL_MS = 15000;
  const POLL_LIMIT_MS = 20 * 60 * 1000;

  /* ---------- settings ---------- */
  function cfg() {
    try { return Object.assign({ repo: "jamesjardine2/daily-missions-data", api: "https://api.github.com" }, JSON.parse(localStorage.getItem(CFG) || "{}")); }
    catch { return { repo: "jamesjardine2/daily-missions-data", api: "https://api.github.com" }; }
  }
  function saveCfg(patch) {
    const next = Object.assign(cfg(), patch);
    localStorage.setItem(CFG, JSON.stringify(next));
    window.dmFingerDrawing = !!next.finger;
    return next;
  }
  window.dmFingerDrawing = !!cfg().finger;

  /* ---------- GitHub contents API ---------- */
  function headers(extra) {
    const c = cfg();
    return Object.assign({ Authorization: `Bearer ${c.token}`, "X-GitHub-Api-Version": "2022-11-28" }, extra || {});
  }
  const url = (path) => `${cfg().api}/repos/${cfg().repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

  async function readText(path) {
    const r = await fetch(url(path) + `?ref=main&t=${Date.now()}`, { headers: headers({ Accept: "application/vnd.github.raw+json" }), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new ApiError(r.status);
    return r.text();
  }
  async function readJSON(path) {
    const t = await readText(path);
    return t == null ? null : JSON.parse(t);
  }
  async function shaOf(path) {
    const r = await fetch(url(path) + `?ref=main&t=${Date.now()}`, { headers: headers({ Accept: "application/vnd.github.object+json" }), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new ApiError(r.status);
    return (await r.json()).sha || null;
  }
  async function writeText(path, text, message) {
    const sha = await shaOf(path);
    const body = { message, content: b64(text), branch: "main" };
    if (sha) body.sha = sha;
    const r = await fetch(url(path), { method: "PUT", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) });
    if (!r.ok) throw new ApiError(r.status);
  }
  function b64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  class ApiError extends Error {
    constructor(status) { super("GitHub said " + status); this.status = status; }
  }
  function problem(e) {
    if (!navigator.onLine) return "This iPad isn't connected to the internet.";
    if (e && (e.status === 401 || e.status === 403)) return "The key on this iPad isn't working. Ask Dad to check Settings.";
    if (e && e.status === 404) return "Couldn't find the missions. Ask Dad to check Settings.";
    return "Something went wrong talking to the internet. Try again in a minute.";
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>"); }
  function today() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function prettyDate(d) {
    return new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
  }
  function view(html) { app.innerHTML = html; window.scrollTo(0, 0); return app; }
  const $ = (sel, root) => (root || app).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || app).querySelectorAll(sel));
  const draftKey = (id) => `dm.draft.${id}`;
  const pendingKey = (kid) => `dm.pending.${kid}`;
  function loadDraft(id) { try { return JSON.parse(localStorage.getItem(draftKey(id)) || "null"); } catch { return null; } }
  function saveDraft(id, d) { try { localStorage.setItem(draftKey(id), JSON.stringify(d)); } catch { /* storage full: keep going */ } }
  function starRow(n, size) {
    let s = "";
    for (let i = 1; i <= 3; i++) s += `<span class="star ${i <= n ? "on" : ""} ${size || ""}">★</span>`;
    return `<span class="stars" aria-label="${n} of 3 stars">${s}</span>`;
  }
  function loading(msg) { view(`<section class="screen center"><div class="spinner"></div><p class="muted">${esc(msg || "Loading...")}</p></section>`); }
  function failure(msg, retry) {
    view(`<section class="screen center"><div class="big-emoji">🛰️</div><h1>Hmm.</h1><p>${esc(msg)}</p>
      <div class="row"><button class="btn primary" data-retry>Try again</button><button class="btn ghost" data-settings>Settings</button></div></section>`);
    $("[data-retry]").onclick = retry;
    $("[data-settings]").onclick = settings;
  }

  /* ---------- start ---------- */
  let kids = null, kid = null, state = null;

  async function start() {
    const c = cfg();
    if (!c.token) return settings(true);
    loading("Finding your missions...");
    try {
      kids = kids || (await readJSON("kids/index.json")) || [];
    } catch (e) { return failure(problem(e), start); }
    kid = kids.find((k) => k.id === c.kid);
    if (!kid) return pickKid();
    document.documentElement.style.setProperty("--me", kid.colour || "#ff7a45");
    home();
  }

  function pickKid() {
    view(`<section class="screen center">
      <div class="big-emoji">👋</div><h1>Who's practising on this iPad?</h1>
      <div class="kid-grid">${kids.map((k) => `<button class="kid" data-kid="${esc(k.id)}" style="--me:${esc(k.colour || "#ff7a45")}">${esc(k.name)}</button>`).join("")}</div>
      <button class="link" data-settings>Settings</button></section>`);
    $$("[data-kid]").forEach((b) => (b.onclick = () => { saveCfg({ kid: b.dataset.kid }); start(); }));
    $("[data-settings]").onclick = () => settings();
  }

  /* ---------- home ---------- */
  async function home() {
    loading("Finding your missions...");
    let session = null, last = null;
    try {
      state = await readJSON(`kids/${kid.id}/state.json`);
      if (!state) throw new ApiError(404);
      const pending = localStorage.getItem(pendingKey(kid.id));
      if (pending) {
        const fb = await readJSON(`kids/${kid.id}/feedback/${pending}.json`);
        if (!fb) return waiting(pending);
        localStorage.removeItem(pendingKey(kid.id));
        return feedback(fb, true);
      }
      if (state.nextSession) session = await readJSON(`kids/${kid.id}/sessions/${state.nextSession}.json`);
      const h = state.history || [];
      if (h.length) last = h[h.length - 1];
    } catch (e) { return failure(problem(e), home); }

    const hist = state.history || [];
    const stars = hist.reduce((n, x) => n + (x.stars || 0), 0);
    const streak = streakOf(hist);
    const ready = session && session.date <= today();
    const doneToday = last && last.date === today();
    const draft = session ? loadDraft(session.id) : null;

    let card;
    if (ready) {
      card = `<div class="mission-card">
        <div class="mission-emoji">${esc(session.emoji || "🚀")}</div>
        <div class="tag ${esc(session.subject)}">${session.subject === "numeracy" ? "Maths" : "Literacy"} · Day ${esc(session.day)}</div>
        <h2>${esc(session.title)}</h2>
        <p>${rich(session.intro || "")}</p>
        <button class="btn primary big" data-go>${draft ? "Keep going" : "Start mission"}</button></div>`;
    } else {
      card = `<div class="mission-card done">
        <div class="mission-emoji">${doneToday ? "🎉" : "🌙"}</div>
        <h2>${doneToday ? "All done for today!" : "No mission yet"}</h2>
        <p>${session ? `Your next mission unlocks on ${esc(prettyDate(session.date))}.` : "Your next mission is being made. Check back soon."}</p>
        ${last ? `<button class="btn ghost" data-last>See my last feedback</button>` : ""}</div>`;
    }
    view(`<section class="screen">
      <header class="top"><div><p class="muted">${esc(prettyDate(today()))}</p><h1>Hi ${esc(kid.name)}!</h1></div>
        <button class="icon-btn" data-settings aria-label="Settings">⚙️</button></header>
      <div class="badges"><div class="badge"><b>${stars}</b><span>stars</span></div>
        <div class="badge"><b>${streak}</b><span>day streak</span></div>
        <div class="badge"><b>${hist.length}</b><span>missions</span></div></div>
      ${card}
      ${hist.length ? `<h3 class="section">Recent missions</h3><ul class="history">${hist.slice(-5).reverse().map((x) =>
        `<li data-hist="${esc(x.session)}"><span>${esc(x.title || x.session)}</span>${starRow(x.stars || 0)}</li>`).join("")}</ul>` : ""}
    </section>`);
    $("[data-settings]").onclick = () => settings();
    if (ready) $("[data-go]").onclick = () => runSession(session);
    const lb = $("[data-last]");
    if (lb) lb.onclick = () => openFeedback(last.session);
    $$("[data-hist]").forEach((li) => (li.onclick = () => openFeedback(li.dataset.hist)));
  }

  function streakOf(hist) {
    const days = new Set(hist.map((x) => x.date));
    let n = 0;
    const d = new Date(today() + "T00:00:00Z");
    if (!days.has(today())) d.setUTCDate(d.getUTCDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }

  async function openFeedback(id) {
    loading();
    try {
      const fb = await readJSON(`kids/${kid.id}/feedback/${id}.json`);
      if (!fb) return home();
      feedback(fb, false);
    } catch (e) { failure(problem(e), home); }
  }

  /* ---------- a session ---------- */
  let pads = [];
  function runSession(session) {
    const d = loadDraft(session.id) || { i: -1, answers: {}, strokes: {}, hints: [], seconds: 0 };
    let shownAt = Date.now();
    const tick = () => { d.seconds += Math.round((Date.now() - shownAt) / 1000); shownAt = Date.now(); saveDraft(session.id, d); };
    document.addEventListener("visibilitychange", function onVis() {
      if (!document.getElementById("session")) return document.removeEventListener("visibilitychange", onVis);
      if (document.hidden) tick(); else shownAt = Date.now();
    });

    const items = session.items || [];
    function show(i) {
      pads.forEach((p) => p.destroy()); pads = [];
      d.i = i; tick();
      if (i < 0) return intro();
      if (i >= items.length) return finish();
      const it = items[i];
      const dots = items.map((x, n) => `<span class="dot ${n < i ? "done" : ""} ${n === i ? "now" : ""} ${x.boss ? "boss" : ""}"></span>`).join("");
      view(`<section class="screen" id="session">
        <header class="bar"><button class="icon-btn" data-home aria-label="Back to home">🏠</button><div class="dots">${dots}</div><span class="count">${i + 1} / ${items.length}</span></header>
        <article class="item ${it.boss ? "boss" : ""}">
          ${it.boss ? `<div class="boss-tag">⚡ Boss level</div>` : ""}
          ${it.passage ? `<div class="passage">${rich(it.passage)}</div>` : ""}
          ${it.prompt ? `<p class="prompt">${rich(it.prompt)}</p>` : ""}
          <div class="answer"></div>
          ${it.hint ? `<div class="hint-wrap"><button class="link" data-hint>Need a hint?</button><p class="hint" hidden>${rich(it.hint)}</p></div>` : ""}
        </article>
        <footer class="nav"><button class="btn ghost" data-back>Back</button><button class="btn primary" data-next>${i === items.length - 1 ? "Finish" : "Next"}</button></footer>
      </section>`);
      renderAnswer(it, $(".answer"));
      $("[data-home]").onclick = () => { tick(); home(); };
      $("[data-back]").onclick = () => show(i - 1);
      $("[data-next]").onclick = () => show(i + 1);
      const hb = $("[data-hint]");
      if (hb) {
        if (d.hints.includes(it.id)) { hb.hidden = true; $(".hint").hidden = false; }
        hb.onclick = () => { hb.hidden = true; $(".hint").hidden = false; if (!d.hints.includes(it.id)) d.hints.push(it.id); saveDraft(session.id, d); };
      }
    }

    function intro() {
      const t = session.tip;
      view(`<section class="screen" id="session">
        <header class="bar"><button class="icon-btn" data-home aria-label="Back to home">🏠</button><div></div><span></span></header>
        <div class="intro">
          <div class="big-emoji">${esc(session.emoji || "🚀")}</div>
          <h1>${esc(session.title)}</h1>
          <p class="lead">${rich(session.intro || "")}</p>
          ${t ? `<div class="tip"><h3>💡 ${esc(t.title || "Tip")}</h3><p>${rich(t.text || "")}</p>${t.example ? `<p class="example">${rich(t.example)}</p>` : ""}</div>` : ""}
        </div>
        <footer class="nav"><span></span><button class="btn primary" data-next>Let's go</button></footer></section>`);
      $("[data-home]").onclick = () => { tick(); home(); };
      $("[data-next]").onclick = () => show(0);
    }

    function renderAnswer(it, box) {
      const a = d.answers[it.id] || {};
      const save = (v) => { d.answers[it.id] = v; saveDraft(session.id, d); };
      switch (it.type) {
        case "choice": {
          box.innerHTML = `<div class="choices">${(it.options || []).map((o, n) =>
            `<button class="choice ${a.choice === n ? "on" : ""}" data-n="${n}"><span class="letter">${"ABCDE"[n]}</span><span>${rich(o)}</span></button>`).join("")}</div>`;
          $$(".choice", box).forEach((b) => (b.onclick = () => {
            const n = +b.dataset.n;
            save({ choice: n, text: it.options[n] });
            $$(".choice", box).forEach((x) => x.classList.toggle("on", x === b));
          }));
          break;
        }
        case "text":
        case "number": {
          const num = it.type === "number";
          box.innerHTML = `<label class="field">${it.prefix ? `<span class="affix">${esc(it.prefix)}</span>` : ""}
            <input ${num ? 'inputmode="decimal"' : 'autocapitalize="off" autocorrect="off" spellcheck="false"'} class="${num ? "num" : ""}" placeholder="${esc(it.placeholder || (num ? "" : "Type or write here"))}" value="${esc(a.text || "")}">
            ${it.suffix ? `<span class="affix">${esc(it.suffix)}</span>` : ""}</label>`;
          const inp = $("input", box);
          inp.oninput = () => save({ text: inp.value });
          break;
        }
        case "fill": {
          const parts = String(it.template || "").split("[]");
          const vals = a.boxes || [];
          box.innerHTML = `<p class="fill">${parts.map((p, n) => rich(p) + (n < parts.length - 1 ? `<input class="box" inputmode="${it.numeric === false ? "text" : "decimal"}" autocapitalize="off" autocorrect="off" spellcheck="false" data-n="${n}" value="${esc(vals[n] || "")}">` : "")).join("")}</p>`;
          const inputs = $$("input", box);
          inputs.forEach((inp) => (inp.oninput = () => save({ boxes: inputs.map((x) => x.value) })));
          break;
        }
        case "facts": {
          const vals = a.facts || [];
          box.innerHTML = `<div class="facts">${(it.facts || []).map((f, n) =>
            `<label class="fact"><span>${esc(f)} =</span><input inputmode="numeric" data-n="${n}" value="${esc(vals[n] || "")}"></label>`).join("")}</div>`;
          const inputs = $$("input", box);
          inputs.forEach((inp) => (inp.oninput = () => save({ facts: inputs.map((x) => x.value) })));
          break;
        }
        case "write":
        case "draw": {
          const strokes = d.strokes[it.id] || (d.strokes[it.id] = []);
          const opts = padOpts(it);
          if (it.type === "write") box.insertAdjacentHTML("beforeend", `<p class="pencil-note">✏️ Use your Apple Pencil</p>`);
          pads.push(Pad.create(box, opts, strokes, () => saveDraft(session.id, d)));
          break;
        }
        default:
          break;
      }
    }

    function finish() {
      const missing = items.filter((it) => it.type !== "read" && !answered(it)).map((it, n) => items.indexOf(it) + 1);
      view(`<section class="screen center" id="session">
        <div class="big-emoji">🏁</div><h1>Mission complete!</h1>
        ${missing.length ? `<p class="warn">You haven't answered question${missing.length > 1 ? "s" : ""} ${missing.join(", ")} yet. You can go back, or send it anyway.</p>` : ""}
        <p class="lead">How did today feel?</p>
        <div class="rating">${[["easy", "😎", "Easy"], ["ok", "🙂", "Just right"], ["tricky", "🤔", "Tricky"]].map(([v, e, l]) =>
          `<button class="rate ${d.rating === v ? "on" : ""}" data-rate="${v}"><span>${e}</span>${l}</button>`).join("")}</div>
        <div class="row"><button class="btn ghost" data-back>Back</button><button class="btn primary big" data-send ${d.rating ? "" : "disabled"}>Send to Claude</button></div>
        <p class="error" hidden></p></section>`);
      $$("[data-rate]").forEach((b) => (b.onclick = () => {
        d.rating = b.dataset.rate; saveDraft(session.id, d);
        $$("[data-rate]").forEach((x) => x.classList.toggle("on", x === b));
        $("[data-send]").disabled = false;
      }));
      $("[data-back]").onclick = () => show(items.length - 1);
      $("[data-send]").onclick = () => submit();
    }

    function answered(it) {
      const a = d.answers[it.id];
      if (it.type === "write" || it.type === "draw") return (d.strokes[it.id] || []).length > 0;
      if (!a) return false;
      if (it.type === "choice") return a.choice != null;
      if (it.type === "fill") return (a.boxes || []).some((x) => x.trim());
      if (it.type === "facts") return (a.facts || []).some((x) => x.trim());
      return !!(a.text || "").trim();
    }

    async function submit() {
      tick();
      const btn = $("[data-send]");
      btn.disabled = true; btn.textContent = "Sending...";
      const answers = {};
      for (const it of items) {
        if (it.type === "read") continue;
        if (it.type === "write" || it.type === "draw") {
          const st = d.strokes[it.id] || [];
          answers[it.id] = st.length ? { image: Pad.toPNG(padOpts(it), st) } : { blank: true };
        } else answers[it.id] = d.answers[it.id] || { blank: true };
      }
      const sub = { session: session.id, kid: kid.id, submittedAt: new Date().toISOString(), seconds: d.seconds, rating: d.rating, answers, hints: d.hints };
      try {
        await writeText(`kids/${kid.id}/submissions/${session.id}.json`, JSON.stringify(sub), `${kid.name} finished ${session.id}`);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Send to Claude";
        const er = $(".error"); er.hidden = false; er.textContent = problem(e) + " Your work is saved on this iPad.";
        return;
      }
      localStorage.setItem(pendingKey(kid.id), session.id);
      localStorage.removeItem(draftKey(session.id));
      waiting(session.id);
    }

    show(d.i >= 0 ? Math.min(d.i, items.length) : -1);
  }

  function padOpts(it) {
    return it.type === "write"
      ? { kind: "lined", lines: Math.max(1, Math.min(6, it.lines || 2)), model: it.model }
      : { kind: "blank", size: it.size || "medium", grid: !!it.grid, colours: true };
  }

  /* ---------- waiting for Claude ---------- */
  let pollTimer = null;
  function waiting(id) {
    clearTimeout(pollTimer);
    const began = Date.now();
    view(`<section class="screen center">
      <div class="marking"><span>✏️</span></div>
      <h1>Sent! Claude is marking your work.</h1>
      <p class="lead">This takes a few minutes. You can wait here, or close the app and come back.</p>
      <p class="muted" data-status></p>
      <button class="btn ghost" data-home>Back to home</button></section>`);
    $("[data-home]").onclick = () => { clearTimeout(pollTimer); home(); };
    const poll = async () => {
      if (!document.body.contains($("[data-status]"))) return;
      try {
        const fb = await readJSON(`kids/${kid.id}/feedback/${id}.json`);
        if (fb) { localStorage.removeItem(pendingKey(kid.id)); return feedback(fb, true); }
      } catch { /* try again next time */ }
      if (Date.now() - began > POLL_LIMIT_MS) {
        $("[data-status]").textContent = "Still marking. Close the app and check again later.";
        return;
      }
      pollTimer = setTimeout(poll, POLL_MS);
    };
    pollTimer = setTimeout(poll, POLL_MS);
  }

  /* ---------- feedback ---------- */
  function feedback(fb, fresh) {
    if (fb.status === "error") {
      view(`<section class="screen center"><div class="big-emoji">📮</div><h1>Your work is safely in!</h1>
        <p class="lead">${esc(fb.kidMessage || "Claude couldn't mark this one, so Dad will check it.")}</p>
        <button class="btn primary" data-home>Back to home</button></section>`);
      $("[data-home]").onclick = home;
      return;
    }
    const icons = { correct: "✅", partly: "🟡", not_yet: "🔁", not_marked: "" };
    const items = Object.entries(fb.items || {}).filter(([, v]) => v && v.result !== "not_marked");
    view(`<section class="screen">
      <div class="result ${fresh ? "pop" : ""}">
        ${starRow(fb.stars || 0, "huge")}
        <h1>${fb.stars >= 3 ? "Brilliant!" : fb.stars === 2 ? "Great work!" : "Good effort!"}</h1>
        <p class="lead">${rich(fb.kidMessage || "")}</p>
      </div>
      ${items.length ? `<ul class="marks">${items.map(([id, v]) =>
        `<li><span class="mark-icon">${icons[v.result] || "•"}</span><div><b>Question ${esc(id.replace(/^q/, ""))}</b><p>${rich(v.comment || "")}</p></div></li>`).join("")}</ul>` : ""}
      ${fb.goal && fb.goal.next ? `<div class="tip"><h3>${fb.goal.status === "achieved" ? "🏆 Goal achieved!" : "🔭 Next time"}</h3><p>${rich(fb.goal.next)}</p></div>` : ""}
      <footer class="nav"><span></span><button class="btn primary" data-home>Back to home</button></footer>
    </section>`);
    $("[data-home]").onclick = home;
    if (fresh && fb.stars >= 3) confetti();
  }

  function confetti() {
    const box = document.createElement("div");
    box.className = "confetti";
    for (let i = 0; i < 60; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = ["#ff7a45", "#ffc53d", "#2f7cf6", "#21a366", "#ff5d9e"][i % 5];
      s.style.animationDelay = Math.random() * 0.8 + "s";
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.append(s);
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 3500);
  }

  /* ---------- settings ---------- */
  function settings(first) {
    const c = cfg();
    view(`<section class="screen narrow">
      <header class="top"><h1>${first ? "Set up this iPad" : "Settings"}</h1>${first ? "" : `<button class="icon-btn" data-close aria-label="Close">✖️</button>`}</header>
      <p class="muted">For grown ups. The key is saved on this iPad only.</p>
      <label class="setting">GitHub key<input type="password" data-token autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${c.token ? "Saved (paste a new one to replace it)" : "github_pat_..."}"></label>
      <label class="setting">Data repo<input data-repo autocapitalize="off" spellcheck="false" value="${esc(c.repo)}"></label>
      <label class="check"><input type="checkbox" data-finger ${c.finger ? "checked" : ""}> Let fingers write too (leave off if using an Apple Pencil, so a resting hand doesn't draw)</label>
      ${kids && kids.length ? `<label class="setting">Who uses this iPad<select data-kid>${kids.map((k) => `<option value="${esc(k.id)}" ${k.id === c.kid ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select></label>` : ""}
      <div class="row"><button class="btn primary" data-save>Save</button>${c.token ? `<button class="btn ghost" data-forget>Remove key</button>` : ""}</div>
      <p class="status" data-status></p></section>`);
    const close = $("[data-close]");
    if (close) close.onclick = () => start();
    $("[data-save]").onclick = async () => {
      const tok = $("[data-token]").value.trim();
      const patch = { repo: $("[data-repo]").value.trim() || c.repo, finger: $("[data-finger]").checked };
      if (tok) patch.token = tok;
      const k = $("[data-kid]");
      if (k) patch.kid = k.value;
      saveCfg(patch);
      const st = $("[data-status]");
      st.textContent = "Checking the key...";
      try {
        kids = null;
        const list = await readJSON("kids/index.json");
        if (!list) throw new ApiError(404);
        st.textContent = "Connected. ✅";
        setTimeout(start, 600);
      } catch (e) { st.textContent = problem(e); }
    };
    const forget = $("[data-forget]");
    if (forget) forget.onclick = () => { if (confirm("Remove the key from this iPad?")) { saveCfg({ token: "" }); settings(true); } };
  }

  start();
})();
