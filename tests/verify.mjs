// Content and integrity checks. Run: node tests/verify.mjs  (no dependencies)
// Loads everything above the UI marker in index.html (data and pure functions) and checks it.
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cut = script.indexOf("/* ===================== UI");
if (cut < 0) throw new Error("UI marker not found in index.html");
const X = new Function(script.slice(0, cut) + "; return {RANGES,CALLS,MODES,LESSONS,MATH,rangePct,allHands,combos,toolHTML,eq2,PMODES,pfTexture,pfRead,pfOuts,pfScore,pfVillain,cbGrade,vbClass,vbGrade,revAdd,revAnswer,revDue,LADDER,PF_TYPES};")();

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } };

// 1. Ranges: real hands, no duplicates, sizes as stated in the lessons
const hands = new Set(X.allHands());
ok(hands.size === 169, "169 distinct starting hands");
ok(X.allHands().reduce((a, h) => a + X.combos(h), 0) === 1326, "1326 combos in total");
for (const [k, set] of Object.entries({ ...X.RANGES, ...X.CALLS })) {
  set.forEach(h => ok(hands.has(h), `${k}: unknown hand ${h}`));
  ok(new Set(set).size === set.length, `${k}: duplicate hand`);
}
const SEATS = ["UTG", "HJ", "CO", "BU", "SB", "BB"];
for (const [k, m] of Object.entries(X.MODES)) {
  ok(["Open", "Flat", "BB defend", "3-bet", "vs 3-bet"].includes(m.grp), `${k}: group`);
  ok(m.set.length > 0 && m.label && m.info && m.act && SEATS.includes(m.seat), `${k}: complete mode`);
  ok(new Set(m.set).size === m.set.length, `${k}: a hand is listed twice`);
  ok(m.vill === undefined || m.vill === null || ["UTG", "HJ", "CO"].includes(m.vill), `${k}: raiser`);
  // answers: 2-3 options, fold last, every tier's key is one of them, every tier hand is real and in one tier only
  ok(m.opts.length >= 2 && m.opts.length <= 3 && m.opts[m.opts.length - 1][0] === "f", `${k}: options end with Fold`);
  const keys = m.opts.map(o => o[0]), seen = new Set();
  m.tiers.forEach(([key, css, lab, hs]) => {
    ok(keys.includes(key) && lab && ["in", "in2", "in3", "cl", "cl2", "cl3", "dyn", ""].includes(css), `${k}: tier ${lab}`);
    hs.forEach(h => { ok(hands.has(h), `${k}: unknown hand ${h}`); ok(!seen.has(h), `${k}: ${h} in two tiers`); seen.add(h); });
  });
  keys.filter(x => x !== "f").forEach(x => ok(m.tiers.some(t => t[0] === x && t[3].length), `${k}: no hand answers ${x}`));
  if (m.pool) ok(m.pool.length === seen.size && m.pool.every(h => m.ans[h]), `${k}: every dealt hand has an answer`);
  if (m.scene) {
    Object.keys(m.scene.bets).forEach(s => ok(SEATS.includes(s) && s !== m.seat, `${k}: bettor ${s}`));
    ok(!m.scene.after || m.scene.me > 0, `${k}: you opened, so you have chips in`);
  }
}
// the book's dynamic charts: hunting adds to the default open, a defensive range only removes from it
for (const [k, m] of Object.entries(X.MODES)) if (m.base) {
  const b = X.RANGES[m.base];
  if (m.add) ok(b.every(h => m.set.includes(h)) && m.add.every(h => !b.includes(h)), `${k}: hunting adds to the default range`);
  else ok(m.set.every(h => b.includes(h)) && m.drop.every(h => b.includes(h)), `${k}: a defensive range drops hands from the default`);
}
// cumulative calling charts: a wider spot keeps every call of the tighter one
for (const [a, b] of [["call-SBvUTG", "call-SBvHJ"], ["call-SBvCO-fish", "call-SBvBU-fish"], ["call-SBvCO-nit", "call-SBvBU-nit"], ["bb-BU3", "bb-BU25"], ["bb-BU25", "bb-BU2"], ["bb-SB3", "bb-SB25"], ["bb-SB25", "bb-SB2"]])
  ok(X.MODES[a].set.every(h => X.MODES[b].set.includes(h)), `${b} keeps every call of ${a}`);
// vs 3-bet spots deal exactly the opening range of that seat; combos the book prints for its charts
for (const [k, seat] of [["f3-COvSB", "CO"], ["f3-BUvBB", "BU"], ["f3-HJvSB", "HJ"], ["f3-COvBU40", "CO"]])
  ok(X.MODES[k].pool.length === X.RANGES[seat].length && X.MODES[k].pool.every(h => X.RANGES[seat].includes(h)), `${k}: deals the ${seat} opening range`);
const cmb = hs => hs.reduce((a, h) => a + X.combos(h), 0), tierH = (k, lab) => X.MODES[k].tiers.find(t => t[2] === lab)[3];
ok(cmb(tierH("sq-BB", "Squeeze for value")) === 102 && cmb(tierH("sq-BB", "Squeeze bluff")) === 204, "squeeze range: 102 value and 204 bluff combos, as the book says");
ok(cmb(tierH("3b-BUvHJ", "3-bet for value")) === 34 && cmb(tierH("3b-BUvHJ", "3-bet bluff")) === 44, "BU vs HJ: 34 value and 44 bluff combos, as the book says");
ok(cmb(tierH("f3-BUvBB", "4-bet, call a shove")) === 40 && cmb(tierH("f3-BUvBB", "4-bet, fold to a shove")) === 88 && cmb(tierH("f3-BUvBB", "Call")) === 224, "BU vs BB defence: 40 / 88 / 224 combos, as the book says");
// opening ranges widen from UTG to the button
const pc = s => X.rangePct(X.RANGES[s]) * 100;
ok(pc("UTG") < pc("HJ") && pc("HJ") < pc("CO") && pc("CO") < pc("BU"), "opening ranges widen towards the button");
ok(Math.abs(pc("UTG") - 11) < 1 && Math.abs(pc("HJ") - 15.5) < 1 && Math.abs(pc("CO") - 26) < 1.5 && Math.abs(pc("BU") - 48) < 1.5 && Math.abs(pc("SB") - 42) < 1.5, "opening ranges match the book’s rough sizes");
// every UTG open is also a HJ open, every HJ open a CO open, every CO open a button open
for (const [a, b] of [["UTG", "HJ"], ["HJ", "CO"], ["CO", "BU"]]) X.RANGES[a].forEach(h => ok(X.RANGES[b].includes(h), `${h} opens from ${a} but not from ${b}`));

// 2. Lessons and quizzes
const ids = new Set();
X.LESSONS.forEach((l, i) => {
  ok(!ids.has(l.id), `lesson id ${l.id} repeated`); ids.add(l.id);
  ok(l.ch === String(i + 1), `lesson ${l.id}: chapter number ${l.ch}`);
  ok(l.title && l.sum && l.mins > 0 && l.blocks.length >= 2, `lesson ${l.id}: has a title, summary, time and parts`);
  l.blocks.forEach(b => ok(b.length === 2 && b[0] && b[1].length > 40, `lesson ${l.id}: part ${b[0]}`));
  ok(l.quiz.length >= 2, `lesson ${l.id}: has a quiz`);
  l.quiz.forEach((q, j) => {
    ok(q.length === 4 && q[1].length >= 2 && q[1].length <= 4, `lesson ${l.id} q${j + 1}: 2 to 4 options (keys 1-4)`);
    ok(Number.isInteger(q[2]) && q[2] >= 0 && q[2] < q[1].length, `lesson ${l.id} q${j + 1}: answer index`);
    ok(new Set(q[1]).size === q[1].length, `lesson ${l.id} q${j + 1}: duplicate option`);
    ok(q[3] && q[3].length > 10, `lesson ${l.id} q${j + 1}: explanation`);
  });
  if (l.tool) ok(X.toolHTML(l.tool).length > 50, `lesson ${l.id}: tool ${l.tool} renders`);
  if (l.toolAt) ok(l.blocks.some(b => b[0] === l.toolAt), `lesson ${l.id}: toolAt names a part`);
  const txt = l.blocks.map(b => b[1]).join("");
  ok(!/undefined|NaN|\[object/.test(txt), `lesson ${l.id}: broken text`);
  (txt.match(/href="#([^"]+)"/g) || []).forEach(a => { const h = a.slice(7, -1), [v, arg] = h.split("/");
    ok(["home", "ranges", "math", "progress", "settings"].includes(v) || v.startsWith("lesson-"), `lesson ${l.id}: link ${h}`);
    if (v === "ranges" && arg) { const g = decodeURIComponent(arg); const all = { ...X.MODES, ...X.PMODES };
      ok(!!all[g] || (g.startsWith("mix-") && Object.values(all).some(m => m.grp === g.slice(4))), `lesson ${l.id}: link to unknown spot ${arg}`); } });
});
ok(X.LESSONS.length === 14, "14 chapters");


// 3. Math drills: every generated question has its answer among 2-4 distinct options
for (const [k, m] of Object.entries(X.MATH)) for (let i = 0; i < 2000; i++) {
  const g = m.gen();
  ok(g.opts.length >= 2 && g.opts.length <= 4, `math ${k}: ${g.opts.length} options`);
  ok(g.a >= 0 && g.a < g.opts.length, `math ${k}: answer is one of the options`);
  ok(new Set(g.opts).size === g.opts.length, `math ${k}: duplicate options ${g.opts}`);
  ok(!/undefined|NaN/.test(g.q + g.why + g.opts.join()), `math ${k}: broken text`);
  if (fails > 20) break;
}
ok(Math.abs(X.eq2(9) - 0.35) < 0.01, "9 outs on the flop is about 35%");

// 4. App files: versions match, everything the service worker caches exists
const sw = readFileSync(new URL("sw.js", root), "utf8");
const v1 = (sw.match(/grinders-manual-(\d+\.\d+\.\d+)/) || [])[1], v2 = (html.match(/BUILD=\{v:"(\d+\.\d+\.\d+)"/) || [])[1];
ok(v1 && v1 === v2, `version in sw.js (${v1}) matches BUILD in index.html (${v2})`);
ok(/BUILD=\{v:"[\d.]+",at:"\d{4}-\d\d-\d\dT\d\d:\d\dZ"\}/.test(html), "BUILD.at is a UTC time");
const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/\n/g, ""));
files.filter(f => f !== "./").forEach(f => ok(existsSync(new URL(f, root)), `sw.js caches a missing file: ${f}`));
const man = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
man.icons.forEach(i => ok(existsSync(new URL(i.src, root)), `manifest icon missing: ${i.src}`));
ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), "no fonts from Google: they are bundled in fonts/");
const idsInHtml = [...html.matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]);
ok(idsInHtml.length === new Set(idsInHtml).size, "no duplicate ids in the page shell: " + idsInHtml.filter((x, i) => idsInHtml.indexOf(x) !== i));

// 5. CSS: a class with its own rule must not also be used as a modifier of another component
// (v2.0.1: a 5/6 quiz result had class "mid", the table's pot centring class, and floated over the page)
{ const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const own = new Set([...css.matchAll(/(?:^|[},])\s*\.([a-zA-Z][\w-]*)(?=[\s{:,.\[>])/gm)].map(m => m[1]));
  const mods = new Set([...css.matchAll(/[\w\])]\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const clash = [...mods].filter(n => own.has(n) && !["num"].includes(n));
  ok(clash.length === 0, "class names used both on their own and as a modifier: " + clash.join(", "));
  ok(own.size > 40, "found the stylesheet's classes"); }


// 9. Chart colours mean the same action in every chart: navy family = raise, teal = call, grey = fold
for (const [k, m] of Object.entries(X.MODES)) m.tiers.forEach(([key, css, lab]) => {
  const label = (m.opts.find(o => o[0] === key) || ["", ""])[1];
  const fam = key === "f" ? ["", "dyn"] : /^call/i.test(label) ? ["cl", "cl2", "cl3"] : ["in", "in2", "in3"];
  ok(fam.includes(css), `${k}: “${lab}” (${label || "fold"}) is coloured ${css || "grey"}`);
});

// 10. Post-flop engine (Ch. 4 and 5): texture types match the lesson's examples, outs match the book's
const C = s => s.split(" ").map(c => c.replace("10", "T").replace("♠", "s").replace("♥", "h").replace("♦", "d").replace("♣", "c"));
const tblock = X.LESSONS.find(l => l.id === "cbet").blocks.find(b => b[0] === "Factor 1: board texture")[1];
let texN = 0;
tblock.split("<div><b>").slice(1).forEach(part => {
  const t = +part[0];
  [...part.matchAll(/aria-label="([^"]+)"/g)].forEach(m => { texN++; ok(X.pfTexture(C(m[1])) === t, `texture of ${m[1]} should be type ${t}, got ${X.pfTexture(C(m[1]))}`); });
});
ok(texN === 10, "the c-bet lesson shows ten example flops");
const outs = (h, b) => { const rd = X.pfRead(C(h), C(b)); return X.pfOuts(C(h), C(b), rd).outs; };
ok(outs("K♠ J♦", "Q♦ T♣ 4♥") === 11, "KJ on Q-T-4: 11 outs (Ch. 4)");
ok(outs("7♠ 7♦", "J♥ T♣ 4♦") === 2, "77 on J-T-4: 2 outs (Ch. 4)");
ok(outs("A♠ Q♦", "J♥ T♣ 4♦") === 10, "AQ on J-T-4: 10 outs (Ch. 4)");
ok(outs("9♥ 8♥", "T♥ 7♥ 2♣") === 15, "flush draw + open-ender: 15 outs");
ok(X.pfScore(C("A♠ 2♦ 3♣ 4♥ 5♠"))[0] === 4 && X.pfScore(C("A♠ K♠ 9♠ 4♠ 2♠ 2♥ 3♦"))[0] === 5 && X.pfScore(C("7♠ 7♦ 7♣ 2♥ 2♠"))[0] === 6, "hand evaluator");
// the book's worked c-bet spots
const V = (type, seat, extra) => Object.assign(X.pfVillain(type, seat), extra);
const cb = (seat, vill, hole, board) => X.cbGrade({ seat, vill, hole: C(hole), board: C(board), tex: X.pfTexture(C(board)), pot: 5 });
ok(cb("BU", [V("reg", "BB", { fcb: 58 })], "3♠ 2♠", "K♠ 8♦ 2♣").ans === "s", "BU vs BB Reg, bottom pair + backdoor flush, very dry: c-bet small");
ok(cb("BU", [V("ff", "BB", { fcb: 65 })], "5♠ 5♦", "K♣ 7♦ 2♥").ans === "s", "passive fit-or-fold Fish, bone dry, underpair: bet small");
ok(cb("CO", [V("ag", "BU", { fcb: 32, rcb: 25 }), V("reg", "BB", { fcb: 50 })], "A♣ 5♣", "9♥ 8♥ 6♦").ans === "x", "multiway, wet, Aggro Fish, a gutshot: check");
ok(cb("BU", [V("reg", "BB", { fcb: 50 })], "K♠ 9♦", "K♣ 7♦ 2♥").ans === "s", "aware Reg, dry board, BU range: value bets use the small balanced size");
ok(cb("UTG", [V("st", "BB", { fcb: 30 })], "K♠ K♦", "Q♥ 8♥ 4♣").ans === "l", "Station Fish: bet big with value");
ok(cb("BU", [V("reg", "BB", { fcb: 50 })], "9♠ 9♦", "K♣ 7♦ 2♥").ans === "x", "stable SDV on a dry board: check");
// Ch. 5: an overpair when a flush card comes on the turn: bet into the Fish, check against the Reg
const vb = type => { const hole = C("K♠ K♣"), board = C("Q♥ 8♥ 4♣ 2♥"), sp = { vill: [V(type, "BB")], cl: X.vbClass(hole, board), river: false, ip: true, stack: 90, pot: 17, tex: 2, board, hole }; return X.vbGrade(sp); };
ok(vb("st").ans === "l" && vb("reg").ans === "x", "Ch. 5: overpair on a flush turn: bet the Fish, check the Reg");
// every generated spot: plain JSON, one right answer, a why-not note on every other option, and a spread of answers
for (const [k, m] of Object.entries(X.PMODES)) {
  const tally = {}; let bad = 0;
  for (let i = 0; i < 400; i++) {
    const sp = m.gen();
    if (!sp || !sp.opts.some(o => o[0] === sp.ans) || sp.opts.some(o => o[0] !== sp.ans && !sp.notes[o[0]]) || !sp.why || !sp.verdict || !sp.info
      || JSON.stringify(JSON.parse(JSON.stringify(sp))) !== JSON.stringify(sp) || sp.hole.concat(sp.board).length !== new Set(sp.hole.concat(sp.board)).size) bad++;
    else tally[sp.ans] = (tally[sp.ans] || 0) + 1;
  }
  ok(!bad, `${k}: ${bad} broken spots`);
  ok((tally.x || 0) >= 40 && Object.keys(tally).length >= 3, `${k}: answers spread ${JSON.stringify(tally)}`);
}

// 11. Spaced repetition: a miss comes back 3-4 spots later, climbs the ladder on right answers, resets on a miss
{
  const L = [], now = 1e12; X.revAdd(L, "cb-ip", { a: 1 }, now, 10);
  ok(!X.revDue(L, ["cb-ip"], now, 12).length && X.revDue(L, ["cb-ip"], now, 14).length === 1 && !X.revDue(L, ["vb-turn"], now, 14).length, "review due 3-4 spots later, only in its topic");
  X.revAnswer(L, L[0].id, true, now, 14); ok(L[0].step === 1 && L[0].n >= 29, "a right answer moves it to the next step");
  X.revAnswer(L, L[0].id, false, now, 30); ok(L[0].step === 0, "a miss sends it back to the start");
  for (let i = 0; i < X.LADDER.length; i++) X.revAnswer(L, L[0].id, true, now, 40);
  ok(L.length === 0, "after the last step the spot is learnt and leaves");
}

// 12. The table names the players a spot depends on, the same way on every table ("type · action")
for (const [k, m] of Object.entries(X.MODES)) {
  if (/\b(Fish|Nit|Reg|3-bettor|40bb)\b/.test(m.info)) ok(m.who && Object.keys(m.who).length, `${k}: the info names a player type but the table doesn't show it`);
  Object.keys(m.who || {}).forEach(s => ok(SEATS.includes(s) && s !== m.seat, `${k}: player type on seat ${s}`));
}

console.log(fails ? `${fails} check(s) failed` : "All checks passed");
process.exit(fails ? 1 : 0);
