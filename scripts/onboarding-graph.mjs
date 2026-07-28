import { readFileSync, writeFileSync } from "node:fs";

const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const mermaidId = value => String(value).replaceAll(/[^a-zA-Z0-9_]/g, "_");

function readable(id) {
  return String(id).replaceAll(/[-_]+/g, " ").replaceAll(/\b\w/g, letter => letter.toUpperCase());
}

function normalize(input) {
  const rawOverview = input.overview ?? {};
  const nodes = input.nodes.map(node => ({ ...node, system: node.system ?? "components" }));
  const systems = [...(rawOverview.systems ?? [])];
  const known = new Set(systems.map(system => system.id));
  for (const node of nodes) if (!known.has(node.system)) {
    systems.push({ id: node.system, label: readable(node.system), purpose: "Components and evidence selected by artifact author." });
    known.add(node.system);
  }
  const primaryFlow = rawOverview.primaryFlow ?? {
    title: "Explore selected systems",
    summary: "Start with the selected system, then inspect components and evidence.",
    steps: systems.slice(0, Math.min(2, systems.length)).map(system => system.id),
  };
  return { ...input, nodes, overview: { thesis: rawOverview.thesis ?? "Explore repository systems and inspect evidence where detail is needed.", systems, primaryFlow } };
}

function validate(data) {
  if (!data?.title || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.recommendations)) throw new Error("Graph data requires title, nodes, edges, and recommendations.");
  const overview = data.overview;
  const systems = new Set();
  for (const system of overview.systems) {
    if (!system.id || !system.label || !system.purpose || systems.has(system.id)) throw new Error("Every overview system requires unique id, label, and purpose.");
    systems.add(system.id);
  }
  if (!overview.primaryFlow?.title || !overview.primaryFlow?.summary || !Array.isArray(overview.primaryFlow.steps) || overview.primaryFlow.steps.some(id => !systems.has(id))) throw new Error("Primary flow must reference known systems.");
  const nodes = new Set();
  for (const node of data.nodes) {
    if (!node.id || !node.label || !node.system || !systems.has(node.system) || !node.purpose || !Array.isArray(node.evidence) || node.evidence.length === 0 || nodes.has(node.id)) throw new Error(`Node '${node.id ?? "unknown"}' requires unique id, known system, purpose, and evidence.`);
    nodes.add(node.id);
  }
  for (const edge of data.edges) if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error("Every edge must reference known nodes.");
  for (const flow of data.flows ?? []) if (!flow.title || !flow.summary || !Array.isArray(flow.steps) || flow.steps.some(id => !nodes.has(id))) throw new Error("Every detail flow requires title, summary, and known node steps.");
  for (const item of data.recommendations) if (!item.title || !item.confidence || !item.why || !item.safeValidationCommand) throw new Error("Every recommendation requires title, confidence, why, and safeValidationCommand.");
}

export function renderGraph(input) {
  const data = normalize(input);
  validate(data);
  const { overview } = data;
  const graphData = JSON.stringify(data).replaceAll("<", "\\u003c");
  const primary = new Set(overview.primaryFlow.steps);
  const systemCards = overview.systems.map(system => `<button type="button" class="system-card${primary.has(system.id) ? " is-primary" : ""}" data-system="${escapeHtml(system.id)}" aria-pressed="false"><span class="system-mark">${primary.has(system.id) ? "Primary path" : "System"}</span><strong>${escapeHtml(system.label)}</strong><span>${escapeHtml(system.purpose)}</span></button>`).join("\n");
  const flowSteps = overview.primaryFlow.steps.map((id, index) => `<li>${index ? '<span aria-hidden="true">→</span>' : ""}<button type="button" data-system-jump="${escapeHtml(id)}">${escapeHtml(overview.systems.find(system => system.id === id).label)}</button></li>`).join("");
  const recommendations = data.recommendations.map(item => `<article class="recommendation"><div><span class="confidence">${escapeHtml(item.confidence)} confidence</span><h3>${escapeHtml(item.title)}</h3></div><p>${escapeHtml(item.why)}</p><code>${escapeHtml(item.safeValidationCommand)}</code></article>`).join("");
  const mermaid = ["flowchart LR", ...overview.systems.map(system => `  ${mermaidId(system.id)}[\"${String(system.label).replaceAll('"', "'")}\"]`), ...overview.primaryFlow.steps.slice(1).map((id, index) => `  ${mermaidId(overview.primaryFlow.steps[index])} --> ${mermaidId(id)}`)].join("\n");
  const markdown = `# ${data.title}\n\n## System overview\n\n${overview.thesis}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n## Primary flow: ${overview.primaryFlow.title}\n\n${overview.primaryFlow.summary}\n\n${overview.primaryFlow.steps.map(id => `- ${overview.systems.find(system => system.id === id).label}`).join("\n")}\n\n## System details\n\n${overview.systems.map(system => `### ${system.label}\n${system.purpose}\n${data.nodes.filter(node => node.system === system.id).map(node => `- **${node.label}** (${node.kind ?? "component"}) — ${node.purpose} (${node.evidence.join(", ")})`).join("\n") || "- No components recorded."}`).join("\n\n")}\n\n## Recommendations\n\n${data.recommendations.map(item => `- **${item.title}** (${item.confidence}): ${item.why}. Validate: \`${item.safeValidationCommand}\``).join("\n")}\n`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)} | Architecture</title>
<style>
:root { color-scheme:light dark; --ink:oklch(23% .018 185); --paper:oklch(97% .012 100); --surface:oklch(99% .005 100); --wash:oklch(93% .025 185); --line:oklch(78% .025 185); --accent:oklch(44% .11 185); --muted:oklch(46% .022 185); --signal:oklch(62% .13 70); }
@media (prefers-color-scheme:dark) { :root { --ink:oklch(92% .014 185); --paper:oklch(18% .014 185); --surface:oklch(22% .018 185); --wash:oklch(28% .03 185); --line:oklch(40% .026 185); --accent:oklch(77% .1 185); --muted:oklch(73% .022 185); --signal:oklch(78% .12 70); } }
* { box-sizing:border-box; } body { margin:0; background:var(--paper); color:var(--ink); font:1rem/1.55 ui-sans-serif,system-ui,sans-serif; } button { font:inherit; } :where(button,a):focus-visible { outline:3px solid var(--signal); outline-offset:3px; } .skip-link { position:absolute; left:-999px; } .skip-link:focus { left:1rem; top:1rem; z-index:2; padding:.5rem .8rem; background:var(--surface); border:1px solid var(--line); }
.hero,main,footer { max-width:80rem; margin:auto; padding-inline:clamp(1rem,4vw,3rem); } .hero { padding-block:clamp(2.5rem,8vw,6rem) 2rem; border-bottom:1px solid var(--line); } .eyebrow { margin:0; color:var(--accent); font-size:.72rem; font-weight:750; letter-spacing:.11em; text-transform:uppercase; } h1 { max-width:15ch; margin:.4rem 0 .8rem; font-size:clamp(2.6rem,7vw,5.4rem); letter-spacing:-.06em; line-height:.92; } h2 { margin:.25rem 0 1rem; font-size:clamp(1.6rem,3vw,2.2rem); letter-spacing:-.035em; } h3 { margin:.2rem 0; font-size:1.05rem; } .thesis { max-width:62ch; color:var(--muted); font-size:1.12rem; } main { padding-block:2.5rem 4rem; } .system-map { padding:clamp(1rem,3vw,2rem); background:var(--surface); border:1px solid var(--line); } .system-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); gap:.8rem; } .system-card { min-height:11rem; text-align:left; border:1px solid var(--line); background:transparent; color:var(--ink); padding:1rem; cursor:pointer; } .system-card:hover { background:var(--wash); } .system-card[aria-pressed="true"] { background:var(--wash); border-color:var(--accent); box-shadow:0 0 0 2px var(--accent); } .system-card.is-primary { border-top:4px solid var(--accent); } .system-card strong,.system-card span { display:block; } .system-card > span:last-child { margin-top:.5rem; color:var(--muted); font-size:.87rem; line-height:1.35; } .system-mark { color:var(--accent); font-size:.7rem; font-weight:750; letter-spacing:.09em; text-transform:uppercase; } .primary-flow { margin:1.5rem 0 0; padding-top:1rem; border-top:1px solid var(--line); } .primary-flow h3 { font-size:1.15rem; } .primary-flow p { color:var(--muted); } .primary-flow ol { display:flex; flex-wrap:wrap; gap:.4rem; padding:0; margin:0; list-style:none; } .primary-flow button { border:0; border-bottom:1px solid var(--accent); background:transparent; color:var(--ink); cursor:pointer; padding:0; } .detail { margin-top:1.4rem; padding:1.2rem; border:1px solid var(--line); background:var(--surface); } .detail-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(17rem,.8fr); gap:1.4rem; } .component-list { display:grid; gap:.6rem; } .component { padding:.8rem; background:var(--wash); } .component p { margin:.4rem 0 0; color:var(--muted); font-size:.9rem; } code { overflow-wrap:anywhere; white-space:pre-wrap; } .evidence { padding-left:1.2rem; } .evidence code { font-size:.82rem; } .relationship { color:var(--muted); font-size:.9rem; } .secondary { margin-top:1rem; } summary { cursor:pointer; font-weight:700; } .below { display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-top:3rem; } .recommendation { display:grid; grid-template-columns:minmax(11rem,.8fr) 1.5fr; gap:.75rem 1rem; border-top:1px solid var(--line); padding:1rem 0; } .recommendation p { margin:0; color:var(--muted); } .recommendation code { grid-column:1/-1; padding:.55rem; background:var(--wash); font-size:.8rem; } .confidence { color:var(--accent); font-size:.72rem; font-weight:750; letter-spacing:.08em; text-transform:uppercase; } footer { border-top:1px solid var(--line); padding-block:1.2rem 2rem; color:var(--muted); font-size:.85rem; }
@media (max-width:52rem) { .detail-grid,.below,.recommendation { grid-template-columns:1fr; } } @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto !important; } }
</style>
</head>
<body>
<a class="skip-link" href="#content">Skip to system overview</a>
<header class="hero"><p class="eyebrow">Architecture overview</p><h1>${escapeHtml(data.title)}</h1><p class="thesis">${escapeHtml(overview.thesis)}</p></header>
<main id="content" tabindex="-1"><section aria-labelledby="overview-title"><p class="eyebrow">Start here</p><h2 id="overview-title">How system works</h2><div class="system-map"><div class="system-cards">${systemCards}</div><div class="primary-flow"><p class="eyebrow">Primary flow</p><h3>${escapeHtml(overview.primaryFlow.title)}</h3><p>${escapeHtml(overview.primaryFlow.summary)}</p><ol>${flowSteps}</ol></div></div></section><section class="detail" aria-labelledby="detail-title"><p class="eyebrow">System detail</p><h2 id="detail-title">Components in selected system</h2><div id="detail" class="muted">Choose a system above to reveal its components and evidence.</div></section><section class="below"><div><p class="eyebrow">Secondary paths</p><h2>Supporting flows</h2><div id="secondary"></div></div><div><p class="eyebrow">Follow-up</p><h2>Recommendations</h2>${recommendations}</div></section></main>
<footer>Generated locally from verified repository evidence. System grouping and primary flow are selected for this repository.</footer>
<script type="application/json" id="graph-data">${graphData}</script>
<script>
const data=JSON.parse(document.getElementById('graph-data').textContent), detail=document.getElementById('detail'), secondary=document.getElementById('secondary');
function element(tag,text,className) { const node=document.createElement(tag); if(text) node.textContent=text; if(className) node.className=className; return node; }
function selectSystem(id) { const system=data.overview.systems.find(item=>item.id===id); const nodes=data.nodes.filter(node=>node.system===id); document.querySelectorAll('.system-card').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.system===id))); detail.replaceChildren(); const title=element('h3',system.label); const purpose=element('p',system.purpose,'relationship'); const list=element('div',null,'component-list'); nodes.forEach(node=>{ const row=element('article',null,'component'); row.append(element('strong',node.label),element('p',(node.kind||'component')+' · '+node.purpose)); const evidence=element('ul',null,'evidence'); node.evidence.forEach(path=>{const item=element('li'); item.append(element('code',path)); evidence.append(item);}); row.append(evidence); const related=data.edges.filter(edge=>edge.from===node.id||edge.to===node.id); if(related.length) row.append(element('p','Relationships: '+related.map(edge=>edge.from===node.id?'→ '+(data.nodes.find(n=>n.id===edge.to)?.label||edge.to):(data.nodes.find(n=>n.id===edge.from)?.label||edge.from)+' →').join(', '),'relationship')); list.append(row); }); detail.append(title,purpose,list); }
function renderSecondary() { secondary.replaceChildren(); const flows=data.flows||[]; if(!flows.length) { secondary.append(element('p','No secondary flow was established.','muted')); return; } flows.forEach(flow=>{const box=element('details'); const summary=element('summary',flow.title); const text=element('p',flow.summary); const steps=element('ol'); flow.steps.forEach(id=>steps.append(element('li',data.nodes.find(node=>node.id===id)?.label||id))); box.append(summary,text,steps); secondary.append(box);}); }
document.querySelectorAll('.system-card').forEach(card=>card.addEventListener('click',()=>selectSystem(card.dataset.system))); document.querySelectorAll('[data-system-jump]').forEach(button=>button.addEventListener('click',()=>{selectSystem(button.dataset.systemJump); document.querySelector('.detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});})); renderSecondary(); selectSystem(data.overview.primaryFlow.steps[0]);
</script>
</body></html>`;
  return { html, markdown };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [inputPath, htmlPath, markdownPath] = process.argv.slice(2);
  if (!inputPath || !htmlPath || !markdownPath) throw new Error("Usage: onboarding-graph <input.json> <architecture.html> <architecture.md>");
  const output = renderGraph(JSON.parse(readFileSync(inputPath, "utf8")));
  writeFileSync(htmlPath, output.html);
  writeFileSync(markdownPath, output.markdown);
}
