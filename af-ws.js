"use strict";
/* ---------- ANAV Equity Fund: clean, app-style layer loaded after every other script ----------
   Overrides the shell, the chart and the investor's main screens. All fund logic stays in the shared files. */

const MARK = (s = 30, inv = false) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="${inv ? "#fff" : "#1d1c1a"}"/><path d="M10 22.5 16 9.5l6 13M12.4 17.6h7.2" fill="none" stroke="${inv ? "#1d1c1a" : "#fff"}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const WORD = (inv) => `<span class="wm${inv ? " inv" : ""}">${MARK(28, inv)}<b>ANAV</b><i>Equity Fund</i></span>`;

/* ---------- ranges ---------- */
const WSR = [["1W", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["YTD", "ytd"], ["1Y", 365], ["All", null]];
function cutTo(pts, k) {
  const r = (WSR.find((x) => x[0] === k) || WSR[WSR.length - 1])[1];
  if (r === null || pts.length < 3) return pts;
  const last = new Date(pts[pts.length - 1].d + "T12:00:00");
  const c = r === "ytd" ? last.getFullYear() + "-01-01" : new Date(last - r * 864e5).toISOString().slice(0, 10);
  const before = [...pts].reverse().find((p) => p.d < c), cut = pts.filter((p) => p.d >= c);
  const out = before ? [{ d: c, v: before.v }, ...cut.filter((p) => p.d !== c)] : cut;
  return out.length >= 2 ? out : pts.slice(-2);
}
const pills = (act, curK) => `<div class="rpills" role="tablist">${WSR.map(([k]) => `<button role="tab" aria-selected="${curK === k}" class="${curK === k ? "on" : ""}" data-a="${act}" data-k="${k}">${k === "All" ? "All" : k}</button>`).join("")}</div>`;

/* ---------- chart: no grid, one line, soft fill, dotted start line ---------- */
function lineChart(pts, fmt, emptyMsg, cmp) {
  if (pts.length < 2) return `<div class="ws-empty-chart"><svg viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true"><path d="M0 170 C120 165 200 150 300 140 S470 120 560 95 S720 70 800 60" fill="none" stroke="var(--line-2)" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/></svg><p>${esc(emptyMsg)}</p></div>`;
  const W = 800, H = 240, L = 4, R = 4, T = 18, B = 26, id = "c" + ++chId;
  const allv = pts.map((p) => p.v).concat(cmp ? cmp.map((p) => p.v) : []);
  let lo = Math.min(...allv), hi = Math.max(...allv);
  if (hi === lo) { hi += Math.abs(hi) * 0.01 || 1; lo -= Math.abs(lo) * 0.01 || 1; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const last = pts.length - 1, up = pts[last].v >= pts[0].v, col = up ? "var(--up)" : "var(--down)";
  CH[id] = { pts, fmt, L, R, W, H, x, y };
  return `<div class="chart ws" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Line chart from ${esc(day(pts[0].d))} to ${esc(day(pts[last].d))}, ${esc(fmt(pts[0].v))} to ${esc(fmt(pts[last].v))}">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".16"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${L}" x2="${W - R}" y1="${y(pts[0].v)}" y2="${y(pts[0].v)}" stroke="var(--faint)" stroke-width="1.4" stroke-dasharray="1.5 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <path d="${path} L${x(last)} ${H - B} L${x(0)} ${H - B} Z" fill="url(#${id}g)"/>
    ${cmp ? `<path d="${cmp.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ")}" fill="none" stroke="var(--faint)" stroke-width="1.6" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` : ""}
    <path d="${path}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <line class="hl" y1="${T}" y2="${H - B}" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/><circle class="hd" r="5" fill="${col}" stroke="#fff" stroke-width="2" visibility="hidden"/>
  </svg><div class="tip"></div><div class="axis"><span>${esc(day(pts[0].d))}</span><span>${esc(day(pts[last].d))}</span></div></div>`;
}

/* ---------- shell ---------- */
const MOBILE_TABS = [["portal", "Home", "home"], ["portal-performance", "Performance", "chart"], ["portal-move", "Invest", "swap"], ["portal-transactions", "Activity", "list"], ["portal-account", "Account", "user"]];
const TAB_OF = { portal: "portal", "portal-holdings": "portal-performance", "portal-performance": "portal-performance", "portal-fund": "portal-performance", "portal-move": "portal-move", "portal-invest": "portal-move", "portal-redeem": "portal-move", "portal-recurring": "portal-move", "portal-goals": "portal-move", "portal-transactions": "portal-transactions", "portal-confirmation": "portal-transactions" };
function appShell(o) {
  const inv = o.label !== "Manager console", back = o.back || BACK[o.slug];
  const flat = o.nav.flatMap((g) => g.items);
  const tab = TAB_OF[o.slug] || (o.slug.startsWith("portal") || o.slug === "apply" ? "portal-account" : "");
  const tabs = inv && isInv();
  const menuItems = (tabs ? MOBILE_TABS.map(([k, t]) => [k, t]) : []).concat([[ "home", "Fund website" ]]);
  const mmenu = `<details class="mmenu"><summary aria-label="Menu"><span></span><span></span><span></span></summary><div class="mmenu-p">${menuItems.map(([k, t]) => `<a href="#${k}" class="${tab === k ? "on" : ""}">${t}</a>`).join("")}${o.switchTo ? `<a href="#${o.switchTo[0]}">${o.switchTo[1]}</a>` : ""}<button data-a="signout">Log out</button></div></details>`;
  const toplinks = tabs ? `<nav class="tlinks" aria-label="Account">${MOBILE_TABS.map(([k, t]) => `<a href="#${k}" class="${tab === k ? "on" : ""}">${t}</a>`).join("")}</nav>` : `<nav class="tlinks"><span class="ctag">${inv ? "Your account" : "Manager console"}</span></nav>`;
  const chips = !tabs ? `<nav class="mchips" aria-label="${o.label}">${flat.map(([k, t, , badge]) => `<a href="#${k}" class="${k === o.slug ? "on" : ""}">${t}${badge ? ` <em>${badge}</em>` : ""}</a>`).join("")}</nav>` : "";
  const initials = (S.profile?.full_name || S.session.user.email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return `<div class="app ${inv ? "is-inv" : "is-con"}">
  <header class="sh"><div class="shw"><a class="shlogo" href="#${inv ? "portal" : "console"}" aria-label="Home">${WORD()}</a>${toplinks}
    <div class="shr">${o.switchTo ? `<a class="tl2" href="#${o.switchTo[0]}">${o.switchTo[1]}</a>` : ""}<a class="tl2 hide-m" href="#home">Fund website</a><a class="av" href="#${inv ? "portal-account" : "console-settings"}" title="${esc(S.session.user.email)}" aria-label="Account">${esc(initials)}</a><button class="tl2 hide-m" data-a="signout">Log out</button>${mmenu}</div></div></header>
  ${chips ? `<div class="chipbar"><div class="shw">${chips}</div></div>` : ""}
  <div class="amain"><header class="ahead"><div>${back ? `<a class="backlink" href="#${back[0]}">${I.back}${back[1]}</a>` : ""}<h1>${o.title}</h1>${o.sub ? `<p>${o.sub}</p>` : ""}</div>${o.actions ? `<div class="bar">${o.actions}</div>` : ""}</header>
    <div class="stack">${o.body}</div></div></div>`;
}
const BACK = { "portal-invest": ["portal-move", "Invest"], "portal-redeem": ["portal-move", "Invest"], "portal-recurring": ["portal-move", "Invest"], "portal-goals": ["portal-move", "Invest"], "portal-fund": ["portal-performance", "Performance"], "portal-holdings": ["portal-performance", "Performance"], "portal-confirmation": ["portal-transactions", "Activity"] };
["portal-documents", "portal-tax", "portal-notifications", "portal-messages", "portal-profile", "portal-security", "portal-help"].forEach((k) => (BACK[k] = ["portal-account", "Account"]));
function portalPage(slug, title, body, o = {}) {
  page(slug, typeof title === "function" ? "My account" : title, "portal", () => {
    if (!S.session) return authShell(authForm());
    if (!isInv() && !o.all) return appShell({ slug, label: "Investor account", title: "Almost there", nav: portalNav(), body: `<div class="card"><h3>Invitation only</h3><p class="mut" style="margin:6px 0 18px">${esc(S.session.user.email)} has not been invited.</p><div class="bar"><a class="btn pri" href="#portal-messages">Message the manager</a></div></div>` });
    return appShell({ slug, label: "Investor account", title: typeof title === "function" ? title() : o.h || title, sub: o.sub ? o.sub() : "", nav: portalNav(), actions: o.actions ? o.actions() : "", switchTo: isMgr() ? ["console", "Manager console"] : null, body: body(), back: BACK[slug], hideHead: o.hideHead });
  });
}
function portalNav() {
  const unread = S.msgs.filter((m) => m.from_manager && !m.read_at).length, pend = S.orders.filter((o) => o.status === "pending").length, un = unseen();
  if (!isInv()) return [{ h: "Account", items: [["portal-messages", "Messages", "chat", unread], ["portal-profile", "Profile", "user"], ["portal-security", "Security", "lock"], ["portal-help", "Help", "help"]] }];
  return [
    { h: "", items: [["portal", "Home", "home"], ["portal-performance", "Performance", "chart"], ["portal-move", "Invest", "swap"], ["portal-transactions", "Activity", "list", pend]] },
    { h: "More", items: [["portal-fund", "About the fund", "bank"], ["portal-goals", "Goals", "target"], ["portal-documents", "Documents", "file"], ["portal-notifications", "Notifications", "bell", un], ["portal-messages", "Messages", "chat", unread], ["portal-account", "Account", "user"]] },
  ];
}

/* ---------- sign in ---------- */
function authShell(inner, back = true) {
  return `<div class="wsauth"><header><a href="#home" aria-label="ANAV Equity Fund home">${WORD()}</a>${back ? `<a class="tl" href="#home">Back to site</a>` : ""}</header>
  <main><div class="authx-box">${inner}</div></main>
  <footer class="wsauth-f"><span>ANAV Equity Fund is a high-risk private fund for eligible investors. You can lose some or all of what you invest.</span><span><a href="#terms">Terms</a><a href="#privacy">Privacy</a><a href="#contact">Contact</a></span></footer></div>`;
}

/* ---------- investor screens ---------- */
const badge = (t) => { const s = String(t || "?").replace(/\..*$/, "").slice(0, 4); let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return `<span class="tb" style="--h:${h}">${esc(s.slice(0, s.length > 3 ? 4 : 3))}</span>`; };
const chgLine = (v, p, label) => `<div class="chg ${sign(v)}">${N(v) >= 0 ? "▲" : "▼"} ${money(Math.abs(N(v)))}${p === null || p === undefined ? "" : ` (${(Math.abs(p) * 100).toFixed(2)}%)`} <span>${label}</span></div>`;
const rangeLabel = (k) => ({ "1W": "past week", "1M": "past month", "3M": "past 3 months", "6M": "past 6 months", YTD: "year to date", "1Y": "past year", All: "all time" }[k]);

portalPage("portal", hello, () => {
  const m = myStats(), k = S.prange && WSR.some((x) => x[0] === S.prange) ? S.prange : "All", pts = cutTo(myValueSeries(), k);
  let gain = null, gp = null;
  if (pts.length >= 2) { const s0 = pts[0], flows = S.ledger.filter((r) => r.at.slice(0, 10) > s0.d).reduce((a, r) => a + N(r.amount), 0); gain = pts[pts.length - 1].v - s0.v - flows; const base = s0.v + Math.max(0, flows); gp = base > 0 ? gain / base : null; }
  const h = [...S.fundHoldings].sort((a, b) => N(b.qty) * N(b.last_price) - N(a.qty) * N(a.last_price)), aum = N(S.snap?.aum), share = N(S.snap?.units) > 0 ? m.units / N(S.snap.units) : 0;
  const pend = S.orders.filter((o) => o.status === "pending"), f = feed().slice(0, 5), b = bookStats(S.ledger), g = prefs().goal, plan = S.plan, F = { weekly: "every week", biweekly: "every two weeks", monthly: "every month" };
  const main = `<section class="bal">
    <div class="bal-top"><div><div class="k">Total value</div><div class="big num">${money(m.value)}</div>
      ${gain === null ? "" : chgLine(gain, gp, rangeLabel(k))}</div>
      <div class="bal-btns">${m.units > 0 || S.orders.some((o) => o.kind === "subscribe" && o.status === "pending") ? "" : `<a class="btn pri" href="#portal-invest">Buy your unit</a>`}<a class="btn" href="#portal-redeem">Withdraw</a></div></div>
    ${lineChart(pts, (v) => money(v), m.units > 0 ? "Chart fills in daily." : "No investment yet.")}
    ${pills("prange", k)}
  </section>
  <section class="card list">
    <div class="lh"><h3>Your investment</h3><a class="tl" href="#portal-performance">Performance</a></div>
    <a class="row" href="#portal-fund">${MARK(40)}<div class="rm"><b>${esc(S.settings.name)}</b><small>${num(m.units, 4)} units at ${money(liveNav(), 4)}</small></div><div class="rv"><b class="num">${money(m.value)}</b><small class="${sign(m.value - b.book)}">${b.book > 0 ? signed(m.value - b.book) + " (" + pct((m.value - b.book) / b.book) + ")" : "–"}</small></div></a>
  </section>`;
  const side = `${pend.length ? `<a class="card banner" href="#portal-transactions"><span class="dot"></span><div><b>${pend.length} request${pend.length > 1 ? "s" : ""} in progress</b><small>${pend.map((o) => o.kind === "subscribe" ? "Deposit of " + money(o.amount) : "Withdrawal").join(", ")}</small></div>${I.back}</a>` : ""}
  <section class="card list"><div class="lh"><h3>Requests</h3></div>
    <a class="row" href="#portal-invest"><span class="ib">${I.plus}</span><div class="rm"><b>Buy your unit</b><small>${money(baseAmt(), 0)}</small></div>${I.back}</a>
    <a class="row" href="#portal-redeem"><span class="ib">${I.minus}</span><div class="rm"><b>Withdraw</b><small>${m.units > 0 ? money(m.value) + " available" : "Nothing yet"}</small></div>${I.back}</a></section>
  <section class="card"><div class="lh0"><h3>Your goal</h3><a class="tl" href="#portal-goals">${g ? "Edit" : "Set one"}</a></div>${g && N(g.target) > 0 ? `<p class="mut" style="margin:6px 0 10px">${esc(g.name || "My goal")}: ${money(g.target, 0)}${g.date ? " by " + day(g.date) : ""}</p><div class="meter"><i style="width:${Math.min(100, (m.value / N(g.target)) * 100).toFixed(1)}%"></i></div><p class="hint">${Math.min(100, (m.value / N(g.target)) * 100).toFixed(0)}% of the way there</p>` : ""}</section>
  <section class="card list"><div class="lh"><h3>Recent activity</h3><a class="tl" href="#portal-transactions">See all</a></div>
    ${f.length ? f.map((x) => `<a class="row" href="#${x.href}"><div class="rm"><b>${esc(x.t)}</b><small>${day(x.at)}${x.d ? " · " + esc(x.d) : ""}</small></div></a>`).join("") : `<div class="empty">Nothing yet.</div>`}</section>`;
  return `<div class="hgrid"><div class="hmain">${main}</div><aside class="hside">${side}</aside></div>`;
}, { sub: () => "" });
ACT.prange = (b) => { S.prange = b.dataset.k; render(); };

portalPage("portal-holdings", "Holdings", () => {
  const m = myStats(), aum = N(S.snap?.aum), h = [...S.fundHoldings].sort((a, b) => N(b.qty) * N(b.last_price) - N(a.qty) * N(a.last_price)), share = N(S.snap?.units) > 0 ? m.units / N(S.snap.units) : 0, cashW = N(S.snap?.cash_weight);
  const sect = sectorRows().filter((s) => s.label !== "Cash"), view = S.hview || "holdings";
  const bar = sect.length ? `<div class="stackbar">${sect.map((s, i) => `<i style="width:${(s.w * 100).toFixed(2)}%;background:${PAL2[i % PAL2.length]}" title="${esc(s.label)} ${(s.w * 100).toFixed(1)}%"></i>`).join("")}${cashW > 0 ? `<i style="width:${(cashW * 100).toFixed(2)}%;background:var(--line-2)" title="Cash"></i>` : ""}</div><ul class="legend">${sect.map((s, i) => `<li><i style="background:${PAL2[i % PAL2.length]}"></i>${esc(s.label)} <b>${(s.w * 100).toFixed(1)}%</b></li>`).join("")}${cashW > 0 ? `<li><i style="background:var(--line-2)"></i>Cash <b>${(cashW * 100).toFixed(1)}%</b></li>` : ""}</ul>` : "";
  return `<section class="card"><div class="k mut">Your share of the fund</div><div class="big2 num">${money(m.value)}</div><p class="mut" style="margin-top:-4px">You own ${share > 0 ? (share * 100).toFixed(2) + "%" : "0%"} of every position below.</p>${bar ? `<div style="margin-top:18px">${bar}</div>` : ""}</section>
  <div class="bar">${seg("hview", view, [["holdings", "Holdings"], ["sectors", "Sectors"]])}</div>
  <section class="card list">${view === "sectors" ? (sect.length ? sect.map((s, i) => `<div class="row"><span class="tb" style="--h:${(i * 57) % 360}">${esc(s.label.slice(0, 2))}</span><div class="rm"><b>${esc(s.label)}</b><small>${(s.w * 100).toFixed(2)}% of the fund</small></div><div class="rv"><b class="num">${money(s.w * m.value)}</b></div></div>`).join("") : `<div class="empty">No holdings yet.</div>`)
    : h.length ? h.map((x) => { const mv = N(x.qty) * N(x.last_price), d = x.prev_close ? N(x.last_price) / N(x.prev_close) - 1 : null; return `<div class="row">${badge(x.ticker)}<div class="rm"><b>${esc(x.ticker)}</b><small>${esc(x.name || "")}${x.currency && x.currency !== cur() ? " · " + esc(x.currency) : ""}</small></div><div class="rv"><b class="num">${money(mv * share)}</b><small><span class="mut">${aum > 0 ? (mv / aum * 100).toFixed(1) + "%" : ""}</span>${d === null ? "" : ` <span class="${sign(d)}">${pct(d)}</span>`}</small></div></div>`; }).join("") + (cashW > 0 ? `<div class="row"><span class="ib">${I.cash}</span><div class="rm"><b>Cash</b><small>Held by the fund</small></div><div class="rv"><b class="num">${money(cashW * aum * share)}</b><small class="mut">${(cashW * 100).toFixed(1)}%</small></div></div>` : "") : `<div class="empty">The fund has not bought anything yet.</div>`}</section>
  <div class="bar"><a class="btn" href="#portal-performance">${I.chart} Performance</a><a class="btn" href="#portal-fund">${I.bank} About the fund</a></div>`;
}, { sub: () => "" });
const PAL2 = ["#1d1c1a", "#3f6f5a", "#8fb39c", "#d9b44a", "#b5654a", "#6d7fa6", "#c9c3b8", "#4e4a44", "#a7c4d6"];

portalPage("portal-move", "Invest and withdraw", () => {
  const m = myStats(), p = S.plan, F = { weekly: "every week", biweekly: "every two weeks", monthly: "every month" };
  const r = (href, icon, t, s) => `<a class="row" href="#${href}"><span class="ib">${I[icon]}</span><div class="rm"><b>${t}</b><small>${s}</small></div>${I.back}</a>`;
  return `<section class="card list">${r("portal-invest", "plus", "Buy your unit", money(baseAmt(), 0))}${r("portal-redeem", "minus", "Withdraw", m.units > 0 ? money(m.value) + " available" : "Nothing yet")}${r("portal-goals", "target", "Goal", prefs().goal ? money(prefs().goal.target, 0) : "None")}</section>
  ${pendingList()}
  `;
}, { sub: () => "" });

portalPage("portal-account", "Account", () => {
  const r = (href, icon, t, s, b) => `<a class="row" href="#${href}"><span class="ib">${I[icon]}</span><div class="rm"><b>${t}</b><small>${s}</small></div>${b ? `<em class="cnt">${b}</em>` : ""}${I.back}</a>`;
  const unread = S.msgs.filter((m) => m.from_manager && !m.read_at).length;
  return `<section class="card prof"><span class="av lg">${esc((S.profile?.full_name || S.session.user.email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""))}</span><div><b>${esc(S.profile?.full_name || "Your account")}</b><small>${esc(S.session.user.email)}</small></div></section>
  <section class="card list">${r("portal-documents", "file", "Statements", "")}${r("portal-tax", "receipt", "Tax centre", "")}${r("portal-messages", "chat", "Messages", "", unread)}${r("portal-notifications", "bell", "Notifications", "", unseen())}</section>
  <section class="card list">${r("portal-profile", "user", "Profile", "")}${r("portal-security", "lock", "Security", "")}${r("portal-help", "help", "Help", "")}${r("portal-fund", "bank", "About the fund", "")}</section>
  <button class="btn block ghost" data-a="signout">Log out</button>`;
}, { all: true, sub: () => "" });

portalPage("portal-transactions", "Activity", () => {
  const f = S.txFilter || "all";
  const items = [];
  S.orders.forEach((o) => {
    const ln = S.ledger.find((r) => r.order_id === o.id), when = o.status === "pending" ? o.created_at : o.processed_at || o.created_at;
    if (f !== "all" && ((f === "subscription") !== (o.kind === "subscribe"))) return;
    const amt = o.status === "processed" ? N(o.filled_amount) : o.kind === "subscribe" ? N(o.amount) : o.redeem_all ? null : N(o.units) * liveNav();
    items.push({ at: when, o, ln, amt });
  });
  S.ledger.filter((r) => !r.order_id && (f === "all" || r.kind === f)).forEach((r) => items.push({ at: r.at, ln: r, amt: Math.abs(N(r.amount)) }));
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  const groups = {}; items.forEach((x) => { const k = (x.at || "").slice(0, 7); (groups[k] = groups[k] || []).push(x); });
  const ST = { pending: ["wait", "In progress"], processed: ["", ""], declined: ["bad", "Declined"], cancelled: ["mut", "Cancelled"] };
  const row = (x) => { const sub = x.o ? x.o.kind === "subscribe" : x.ln.kind === "subscription", st = x.o ? ST[x.o.status] : ["", ""];
    return `<${x.ln ? `button type="button" data-a="confirmation" data-id="${x.ln.id}"` : "div"} class="row">${`<span class="ib ${sub ? "in" : "out"}">${sub ? I.plus : I.minus}</span>`}<div class="rm"><b>${sub ? "Deposit" : "Withdrawal"}</b><small>${day(x.at)}${x.o ? " · " + esc(x.o.reference) : ""}${st[1] ? ` · <span class="${st[0]}">${st[1]}</span>` : ""}</small></div><div class="rv"><b class="num ${x.o && x.o.status !== "processed" ? "mut" : sub ? "" : ""}">${x.amt === null ? "All units" : (sub ? "+" : "−") + money(x.amt)}</b>${x.ln ? `<small class="mut">${num(Math.abs(N(x.ln.units)), 2)} units<span class="hm"> @ ${money(x.ln.nav, 4)}</span></small>` : ""}</div></${x.ln ? "button" : "div"}>`; };
  return `${pendingList()}<div class="bar">${seg("txfilter", f, [["all", "All"], ["subscription", "Deposits"], ["redemption", "Withdrawals"]])}<button class="btn sm sp" data-a="txcsv">${I.down} Export</button></div>
  ${items.length ? Object.keys(groups).map((k) => `<section class="card list"><div class="lh"><h3>${new Date(k + "-15T12:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</h3></div>${groups[k].map(row).join("")}</section>`).join("") : `<section class="card"><div class="empty">No activity yet. Your first deposit will show up here.</div></section>`}`;
}, { sub: () => "" });

/* ---------- public home ---------- */
page("home", "Home", "home", () => {
  const st = S.settings, si = sinceInception(), g = growthSeries(), last = S.nav[S.nav.length - 1];
  return `<section class="wshero"><div class="wrap">
    <div class="wshero-t"><h1>Invest in North America's fastest growing companies.</h1>
      <p class="lead">${capTxt()}. One per investor. Invitation only.</p>
      <div class="act">${applyBtn("btn pri lg")}<a class="btn lg" href="#fund">The fund</a></div></div>
    <div class="fundcard" aria-label="Fund summary">
      <div class="fc-h">${MARK(34)}<div><b>${esc(st.name)}</b><small>${esc(st.ticker || "")} · ${esc(st.currency)}</small></div></div>
      <div class="k">Price per unit</div><div class="big num">${money(liveNav(), 2)}</div>
      ${si === null ? `<div class="chg mut">Launching soon</div>` : `<div class="chg ${sign(si)}">${si >= 0 ? "▲" : "▼"} ${(Math.abs(si) * 100).toFixed(2)}% <span>since launch</span></div>`}
      ${lineChart(g, (v) => money(v, 0), "Chart starts after two daily values.")}
      <div class="fc-rows"><div><span>Net assets</span><b>${S.snap && N(S.snap.aum) > 0 ? big(S.snap.aum) : "–"}</b></div><div><span>Units left</span><b>${S.unitsLeft == null ? "–" : num(S.unitsLeft, 0) + " of " + num(st.unit_cap, 0)}</b></div><div><span>Valued</span><b>${last ? day(last.d) : "–"}</b></div></div>
    </div></div></section>
  <section class="band line"><div class="wrap wsstep"><h2>How it works</h2><ol><li><b>Get invited</b><span>With a private link.</span></li><li><b>Buy 1 unit</b><span>${money(baseAmt(), 0)}, approved by the manager.</span></li><li><b>Follow it</b><span>Value updates daily.</span></li></ol></div></section>
  <section class="band line"><div class="wrap two" style="align-items:start"><h2>Questions</h2><div class="faq">${[["Who can join?", "Only people with an invite link. No applications."], ["How much?", `1 unit, ${money(baseAmt(), 0)}.`], ["Can I add more?", "No. One unit each, no recurring investments."], ["Can I see the holdings?", "No. They're private."], ["Can I withdraw?", "Yes, with manager approval."]].map(([q2, a2]) => `<details><summary>${q2}</summary><p>${a2}</p></details>`).join("")}</div></div></section>
  <section class="band line"><div class="wrap"><p class="mut">Investing involves risk. You can lose money. <a class="tl" href="#fund-risk">Risks</a></p></div></section>
  ${foot()}`;
});

/* ---------- header on public pages ---------- */
function renderNav() {
  const r = route(), g = GROUP[r];
  let h = MENU.filter((m) => !m.hidden).map((m) => `<div class="dd"><a href="#${m.items[0]}" class="${g === m.k ? "on" : ""}" aria-haspopup="true">${m.t}</a><div class="menu">${m.items.map((k) => `<a href="#${k}">${TITLES[k]}</a>`).join("")}</div></div>`).join("");
  h += `<a href="#contact" class="${r === "contact" ? "on" : ""}">Contact</a>`;
  $("#links").innerHTML = h;
  $("#cta").innerHTML = S.session ? `${isMgr() ? `<a class="btn" href="#console">Console</a>` : ""}<a class="btn pri" href="#portal">My account</a>` : `<a class="btn pri" href="#signin">Log in</a>`;
  $("#util").innerHTML = "";
}

/* ---------- program rules: fixed base investment, no recurring, private holdings ---------- */
function baseAmt() { const st = S.settings; return N(st.unit_cap) > 0 ? (N(st.initial_nav) || 10) * (N(st.units_per_investor) || 1) : N(st.max_subscription) || N(st.min_initial) || 10; }
const capTxt = () => N(S.settings.unit_cap) > 0 ? `${num(S.settings.unit_cap, 0)} units at ${money(S.settings.initial_nav, 0)} each` : "a limited number of units";
const _loadPublic = loadPublic;
loadPublic = async function () { await _loadPublic(); try { S.unitsLeft = await q(sb.rpc("units_left")); } catch (e) { S.unitsLeft = null; } };
MENU[0].items = MENU[0].items.filter((k) => k !== "fund-portfolio");
portalPage("portal-invest", "Buy your unit", () => {
  const st = S.settings, amt = baseAmt(), m = myStats(), mine = S.orders.find((o) => o.kind === "subscribe" && (o.status === "pending" || o.status === "processed")), left = S.unitsLeft;
  const state = m.units > 0 || (mine && mine.status === "processed") ? "have" : mine ? "pending" : left !== null && left !== undefined && N(left) < (N(st.units_per_investor) || 1) ? "gone" : st.accepting === false ? "closed" : "open";
  const msg = { have: "You already have your unit.", pending: "Waiting for approval.", gone: "All units are taken.", closed: "Not selling units right now.", open: "" }[state];
  return `<section class="card investbox"><div class="k mut">1 unit</div><div class="big2 num">${money(amt, 2)}</div>
    ${left !== null && left !== undefined ? `<p class="mut">${num(left, 0)} of ${num(st.unit_cap, 0)} left</p>` : ""}
    <form data-f="subscribe" novalidate style="margin-top:16px"><input type="hidden" name="amount" value="${amt}">
    <button class="btn pri lg" type="submit" ${state !== "open" ? "disabled" : ""}>Request my unit</button></form>
    ${msg ? `<p class="hint">${msg}</p>` : ""}</section>
  ${pendingList("subscribe")}`;
}, { sub: () => "" });
portalPage("portal-recurring", "Recurring investments", () => `<section class="card"><h3>Not offered</h3><p class="mut" style="margin:6px 0 16px">One unit per investor.</p><a class="btn pri" href="#portal-invest">Invest ${money(baseAmt(), 0)}</a></section>`, { sub: () => "" });
portalPage("portal-holdings", "Holdings", () => `<section class="card"><h3>Holdings are private</h3><p class="mut" style="margin:6px 0 16px">You can see the fund's value and your balance.</p><a class="btn pri" href="#portal-performance">See performance</a></section>`, { sub: () => "" });

/* ---------- invitation only ---------- */
page("apply", "Invitation only", "invest", () => `<div class="wsauth"><header><a href="#home" aria-label="${esc(S.settings.name)} home">${WORD()}</a><a class="tl" href="#home">Back to site</a></header><main><div class="authx-box"><h1>Invitation only</h1><p class="authx-sub">No applications. Join with your invite link.</p>${S.session ? `<a class="btn pri block" href="#portal">Go to my account</a>` : `<a class="btn pri block" href="#signin">Log in</a>`}</div></main><footer class="wsauth-f"><span></span></footer></div>`);
doc("eligibility", "Invitations", "invest", "Invitation only.", () => `<ol><li>Open your invite link.</li><li>Create your login.</li><li>Request your 1 unit (${money(baseAmt(), 0)}).</li><li>Send the money. The manager approves it.</li></ol>
<ul><li>${capTxt()}, one per investor.</li><li>No recurring investments.</li><li>Withdrawals need approval.</li><li>Holdings are private.</li></ul>`);
conPage("console-invites", "Invite links", () => {
  const list = S.con.codes || [], base = location.origin + location.pathname;
  return `<section class="card list"><div class="lh"><h3>${list.filter((c) => c.claimed_by).length} of ${list.length} used</h3></div>${list.map((c) => { const url = base + "?invite=" + c.code; return `<div class="row"><span class="ib">${c.claimed_by ? I.user : I.plus}</span><div class="rm"><b>Link ${c.slot}</b><small>${c.claimed_by ? esc(c.claimed_email || "Used") + " · " + day(c.claimed_at) : esc(url)}</small></div>${c.claimed_by ? `<div class="rv"><small class="up">Used</small></div>` : `<button class="btn sm pri" data-a="copylink" data-u="${esc(url)}">Copy</button><button class="btn sm ghost" data-a="newlink" data-s="${c.slot}">New link</button>`}</div>`; }).join("") || `<div class="empty">No links.</div>`}</section>
  <p class="hint">Each link works once. Whoever opens it sets an email and password and becomes an investor. No email is sent.</p>`;
});
CON_SUB["console-invites"] = "";
ACT.copylink = async (b) => { try { await navigator.clipboard.writeText(b.dataset.u); toast("Link copied."); } catch (e) { window.prompt("Copy this link:", b.dataset.u); } };
ACT.newlink = async (b) => { if (await ask("Replace this link?", "The old link will stop working.", "Replace")) { await q(sb.rpc("new_code", { p_slot: N(b.dataset.s) })); toast("New link made."); await refresh(); } };
const _loadConsole = loadConsole;
loadConsole = async function () { await _loadConsole(); try { S.con.codes = (await q(sb.from("invite_codes").select("*").order("slot"))) || []; } catch (e) { S.con.codes = []; } };

/* ---------- joining from an invite link ---------- */
page("join", "Join", "auth", () => {
  const st = S.joinState;
  const bad = st === "invalid" ? "This invite link is not valid." : st === "used" && !isInv() ? "This invite link has already been used." : "";
  let inner;
  if (!JOIN_CODE) inner = `<h1>Invitation only</h1><p class="authx-sub">Open the invite link you were sent.</p>`;
  else if (bad) inner = `<h1>Link not available</h1><p class="authx-sub">${bad}</p><a class="btn pri block" href="#signin">Log in</a>`;
  else if (S.session) inner = isInv() && st === "used" ? `<h1>You're in</h1><a class="btn pri block" href="#portal">Go to my account</a>` : `<h1>Join ${esc(S.settings.name)}</h1><p class="authx-sub">Use this invite with ${esc(S.session.user.email)}.</p><button class="btn pri block" data-a="claimcode">Join</button>`;
  else inner = `<h1>Join ${esc(S.settings.name)}</h1><p class="authx-sub">Create your login.</p>
    <form data-f="join" novalidate>
      <div class="obf"><label for="jn-n">Full name</label><input id="jn-n" name="name" autocomplete="name" required></div>
      <div class="obf"><label for="jn-e">Email</label><input id="jn-e" name="email" type="email" autocomplete="email" required></div>
      ${pwField("jn-p", "password", "Password", "new-password", "At least 8 characters.")}
      <button class="btn pri lg block" type="submit">Create account</button></form>
    <p class="authx-alt">Already have a login? <a class="tl" href="#signin">Log in</a></p>`;
  return authShell(inner);
});
const clearJoin = () => { try { history.replaceState(null, "", location.pathname + "#portal"); } catch (_) { location.hash = "#portal"; } };
FORMS.join = async (d) => {
  const { data, error } = await sbRaw.functions.invoke("w2-join", { body: { code: JOIN_CODE, email: d.email.trim(), password: d.password, name: d.name.trim() } });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch (_) {} throw new Error(m); }
  await q(sb.auth.signInWithPassword({ email: d.email.trim(), password: d.password }));
  toast("Welcome. Your account is ready."); clearJoin(); setTimeout(() => refresh(), 300);
};
ACT.claimcode = async () => { await q(sb.rpc("claim_code", { p_code: JOIN_CODE })); toast("You're in."); clearJoin(); await refresh(); };
if (JOIN_CODE && sb) {
  if (location.hash !== "#join") location.hash = "#join";
  sb.rpc("check_code", { p_code: JOIN_CODE }).then(({ data }) => { S.joinState = data || "invalid"; if (S.ready) render(); });
}

MENU[0].items = ["fund", "fund-performance", "fund-fees", "fund-documents", "fund-risk"];
MENU[1].items = ["about", "manager"];
MENU[2].items = ["eligibility", "redemptions", "faq"];
MENU[3].hidden = true;
function foot() {
  const st = S.settings;
  return `<footer><div class="wrap fshort"><div><b>${esc(st.name)}</b><span>© ${new Date().getFullYear()}</span></div><nav>${[["fund", "Fund"], ["eligibility", "Invitations"], ["faq", "FAQ"], ["contact", "Contact"], ["terms", "Terms"], ["privacy", "Privacy"], ["risk-disclosure", "Risk"]].map(([k, t]) => `<a href="#${k}">${t}</a>`).join("")}</nav><p>Investing involves risk, including loss of money. Not investment advice.</p></div></footer>`;
}

/* ---------- daily fund value (confidential security) ---------- */
conPage("console-value", "Fund value", () => {
  const aum = N(S.snap?.aum), units = N(S.snap?.units), hist = [...S.nav].reverse().slice(0, 30), last = S.nav[S.nav.length - 1];
  const today = new Date().toLocaleDateString("en-CA");
  return `<form class="card" data-f="fundvalue" novalidate style="max-width:520px">
    <div class="field"><label for="fv-v">Total fund value today</label><input id="fv-v" name="value" class="xl" inputmode="decimal" placeholder="${aum ? aum.toFixed(2) : "0.00"}" required></div>
    <div class="field"><label for="fv-d">Date</label><input id="fv-d" name="date" type="date" value="${today}" max="${today}"></div>
    <button class="btn pri lg" type="submit">Save value</button>
    <p class="hint">Everything the fund owns, including cash. ${units > 0 ? `Price per unit = value ÷ ${num(units, 4)} units.` : ""}</p></form>
  <section class="card"><div class="facts">${[["Current value", money(aum)], ["Price per unit", money(liveNav(), 4)], ["Units", num(units, 4)], ["Last saved", last ? day(last.d) : "Never"]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div></section>
  <section class="card list"><div class="lh"><h3>History</h3></div>${hist.length ? hist.map((h) => `<div class="row"><div class="rm"><b>${day(h.d)}</b></div><div class="rv"><b class="num">${money(h.aum)}</b><small class="mut">${money(h.nav, 4)} per unit</small></div></div>`).join("") : `<div class="empty">No values yet.</div>`}</section>`;
});
CON_SUB["console-value"] = "";
FORMS.fundvalue = async (d) => {
  const v = N(String(d.value).replace(/[$,\s]/g, ""));
  if (!(v >= 0) || String(d.value).trim() === "") throw new Error("Enter the fund's total value.");
  await q(sb.rpc("set_fund_value", { p_value: v, p_date: d.date || null }));
  toast(`Saved ${money(v)}.`); await refresh();
};
