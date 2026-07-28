import { readFileSync, writeFileSync } from "node:fs";

const escapeHtml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const mermaidId = value => String(value).replaceAll(/[^a-zA-Z0-9_]/g, "_");

function validate(data) {
  if (!data?.title || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.recommendations)) throw new Error("Graph data requires title, nodes, edges, and recommendations.");
  for (const node of data.nodes) {
    if (!node.id || !node.label || !node.purpose || !Array.isArray(node.evidence) || node.evidence.length === 0) throw new Error(`Node '${node.id ?? "unknown"}' requires label, purpose, and evidence.`);
  }
}

export function renderGraph(data) {
  validate(data);
  const graphData = JSON.stringify(data).replaceAll("<", "\\u003c");
  const nodeButtons = data.nodes.map(node => `<button type="button" class="graph-node" data-node="${escapeHtml(node.id)}" aria-pressed="false"><strong>${escapeHtml(node.label)}</strong><span>${escapeHtml(node.purpose)}</span></button>`).join("\n");
  const edgeList = data.edges.map(edge => `<li>${escapeHtml(edge.from)} <span aria-hidden="true">→</span> ${escapeHtml(edge.to)}${edge.label ? ` · ${escapeHtml(edge.label)}` : ""}</li>`).join("") || "<li>No confirmed cross-boundary edges.</li>";
  const recommendationList = data.recommendations.map(item => `<li><strong>${escapeHtml(item.title)}</strong> <span class="confidence">${escapeHtml(item.confidence)}</span><br>${escapeHtml(item.why)}<br><code>${escapeHtml(item.validation)}</code></li>`).join("") || "<li>No recommendations recorded.</li>";
  const mermaid = ["flowchart LR", ...data.nodes.map(node => `  ${mermaidId(node.id)}[\"${String(node.label).replaceAll('"', "'")}\"]`), ...data.edges.map(edge => `  ${mermaidId(edge.from)} -->${edge.label ? `|${String(edge.label).replaceAll("|", "/")}|` : ""} ${mermaidId(edge.to)}`)].join("\n");
  const markdown = `# ${data.title}\n\n## Architecture graph\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n## Evidence\n\n${data.nodes.map(node => `- **${node.label}** — ${node.purpose} (${node.evidence.join(", ")})`).join("\n")}\n\n## Recommendations\n\n${data.recommendations.map(item => `- **${item.title}** (${item.confidence}): ${item.why}. Validate: \`${item.validation}\``).join("\n") || "- None."}\n`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)} | Architecture</title>
<style>
:root { color-scheme: light dark; --ink:#18211f; --paper:#f5f4ee; --panel:#fffefa; --line:#c8cec5; --accent:#075e54; --muted:#56615e; }
@media (prefers-color-scheme: dark) { :root { --ink:#e8eee9; --paper:#121714; --panel:#1b211d; --line:#3a4640; --accent:#65d5bc; --muted:#adbbb4; } }
* { box-sizing:border-box; } body { margin:0; background:var(--paper); color:var(--ink); font:1rem/1.5 ui-sans-serif, system-ui, sans-serif; } header, main, footer { max-width:76rem; margin:auto; padding:1.5rem; } header { border-bottom:1px solid var(--line); } h1 { max-width:24ch; margin:.25rem 0; font-size:clamp(2rem,5vw,4rem); line-height:1; } h2 { font-size:1rem; text-transform:uppercase; letter-spacing:.08em; } .skip-link { position:absolute; left:-999px; } .skip-link:focus { left:1rem; top:1rem; z-index:2; background:var(--panel); padding:.5rem; } .layout { display:grid; grid-template-columns:minmax(0,2fr) minmax(17rem,1fr); gap:1rem; } .panel { background:var(--panel); border:1px solid var(--line); border-radius:1rem; padding:1rem; } .graph { display:grid; gap:.75rem; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); } .graph-node { text-align:left; color:inherit; background:color-mix(in srgb,var(--accent) 8%,var(--panel)); border:1px solid var(--line); border-radius:.75rem; padding:1rem; cursor:pointer; min-height:7rem; } .graph-node strong,.graph-node span { display:block; } .graph-node span { color:var(--muted); font-size:.9rem; margin-top:.4rem; } .graph-node[aria-pressed="true"] { border:3px solid var(--accent); background:color-mix(in srgb,var(--accent) 18%,var(--panel)); } button:focus-visible,a:focus-visible { outline:3px solid var(--accent); outline-offset:3px; } code { overflow-wrap:anywhere; } ul { padding-left:1.2rem; } .confidence { color:var(--muted); font-size:.85rem; } .muted { color:var(--muted); } @media (max-width:44rem) { .layout { grid-template-columns:1fr; } }
</style>
</head>
<body>
<a class="skip-link" href="#content">Skip to graph</a>
<header><p class="muted">Evidence-backed onboarding artifact</p><h1>${escapeHtml(data.title)}</h1><p>Choose a component to inspect purpose and source evidence. Graph is local and static.</p></header>
<main id="content" tabindex="-1"><div class="layout"><section class="panel" aria-labelledby="graph-heading"><h2 id="graph-heading">Architecture map</h2><div class="graph">${nodeButtons}</div><h2>Confirmed relationships</h2><ul>${edgeList}</ul></section><aside class="panel" aria-labelledby="detail-heading"><h2 id="detail-heading">Selected component</h2><p id="detail" class="muted">Select component for evidence.</p></aside></div><section class="panel"><h2>Recommendations</h2><ul>${recommendationList}</ul></section></main>
<footer class="muted">Generated locally. Facts link to repository evidence; recommendations are separate.</footer>
<script type="application/json" id="graph-data">${graphData}</script>
<script>
const data = JSON.parse(document.getElementById('graph-data').textContent);
const detail = document.getElementById('detail');
document.querySelectorAll('.graph-node').forEach(button => button.addEventListener('click', () => {
  const node = data.nodes.find(item => item.id === button.dataset.node);
  document.querySelectorAll('.graph-node').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  detail.replaceChildren();
  const purpose = document.createElement('p'); purpose.textContent = node.purpose;
  const heading = document.createElement('h3'); heading.textContent = node.label;
  const list = document.createElement('ul'); node.evidence.forEach(path => { const item = document.createElement('li'); const code = document.createElement('code'); code.textContent = path; item.append(code); list.append(item); });
  detail.append(heading, purpose, document.createTextNode('Evidence:'), list);
}));
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
