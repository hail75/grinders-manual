// Content and integrity checks. Run: node tests/verify.mjs  (no dependencies)
// Loads everything above the UI marker in index.html (data and pure functions) and checks it.
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cut = script.indexOf("/* ===================== UI");
if (cut < 0) throw new Error("UI marker not found in index.html");
const X = new Function(script.slice(0, cut) + "; return {RANGES,CALLS,MODES,LESSONS,CARDS,CARD_IDS,MATH,rangePct,allHands,combos,toolHTML,eq2};")();

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
for (const [k, m] of Object.entries(X.MODES)) {
  ok(["Open", "Flat", "BB defend"].includes(m.grp), `${k}: group`);
  ok(m.set.length > 0 && m.label && m.info && m.act && m.seat, `${k}: complete mode`);
  ok(new Set(m.set).size === m.set.length, `${k}: a hand is listed twice`);
  ok(m.vill === null || ["UTG", "HJ", "CO"].includes(m.vill), `${k}: raiser`);
}
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
  const txt = l.blocks.map(b => b[1]).join("");
  ok(!/undefined|NaN|\[object/.test(txt), `lesson ${l.id}: broken text`);
  (txt.match(/href="#([^"]+)"/g) || []).forEach(a => { const h = a.slice(7, -1), [v, arg] = h.split("/");
    ok(["home", "ranges", "math", "review", "progress", "settings"].includes(v) || v.startsWith("lesson-"), `lesson ${l.id}: link ${h}`);
    if (v === "ranges" && arg) ok(!!X.MODES[arg], `lesson ${l.id}: link to unknown spot ${arg}`); });
});
ok(X.LESSONS.length === 14, "14 chapters");

// 3. Flashcards
ok(X.CARDS.length === X.CARD_IDS.length && X.CARDS.every(c => c.length === 2 && c[0] && c[1]), "flashcards have a front and a back");
ok(new Set(X.CARDS.map(c => c[0])).size === X.CARDS.length, "flashcard fronts are unique");

// 4. Math drills: every generated question has its answer among 2-4 distinct options
for (const [k, m] of Object.entries(X.MATH)) for (let i = 0; i < 2000; i++) {
  const g = m.gen();
  ok(g.opts.length >= 2 && g.opts.length <= 4, `math ${k}: ${g.opts.length} options`);
  ok(g.a >= 0 && g.a < g.opts.length, `math ${k}: answer is one of the options`);
  ok(new Set(g.opts).size === g.opts.length, `math ${k}: duplicate options ${g.opts}`);
  ok(!/undefined|NaN/.test(g.q + g.why + g.opts.join()), `math ${k}: broken text`);
  if (fails > 20) break;
}
ok(Math.abs(X.eq2(9) - 0.35) < 0.01, "9 outs on the flop is about 35%");

// 5. App files: versions match, everything the service worker caches exists
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

// 6. CSS: a class with its own rule must not also be used as a modifier of another component
// (v2.0.1: a 5/6 quiz result had class "mid", the table's pot centring class, and floated over the page)
{ const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const own = new Set([...css.matchAll(/(?:^|[},])\s*\.([a-zA-Z][\w-]*)(?=[\s{:,.\[>])/gm)].map(m => m[1]));
  const mods = new Set([...css.matchAll(/[\w\])]\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const clash = [...mods].filter(n => own.has(n) && !["num"].includes(n));
  ok(clash.length === 0, "class names used both on their own and as a modifier: " + clash.join(", "));
  ok(own.size > 40, "found the stylesheet's classes"); }

console.log(fails ? `${fails} check(s) failed` : "All checks passed");
process.exit(fails ? 1 : 0);
