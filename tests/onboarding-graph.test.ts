import assert from "node:assert/strict";
import test from "node:test";
import { renderGraph } from "../scripts/onboarding-graph.mjs";

test("renders standalone accessible graph with evidence and Mermaid fallback", () => {
  const output = renderGraph({
    title: "Example onboarding",
    nodes: [{ id: "api", label: "API", purpose: "Serves requests", evidence: ["src/api.ts"] }],
    edges: [],
    recommendations: [{ title: "Add smoke test", confidence: "medium", why: "No route coverage", validation: "npm test" }],
  });
  assert.match(output.html, /<main id="content" tabindex="-1">/);
  assert.match(output.html, /<button type="button" class="graph-node"/);
  assert.match(output.html, /src\/api\.ts/);
  assert.match(output.markdown, /```mermaid/);
  assert.match(output.markdown, /Add smoke test/);
});

test("rejects graph nodes without evidence", () => {
  assert.throws(() => renderGraph({ title: "Bad", nodes: [{ id: "api", label: "API", purpose: "Serves requests", evidence: [] }], edges: [], recommendations: [] }), /evidence/);
});
