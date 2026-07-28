import assert from "node:assert/strict";
import test from "node:test";
import { renderGraph } from "../scripts/onboarding-graph.mjs";

const graph = {
  title: "Example onboarding",
  nodes: [{ id: "api", label: "API", group: "Runtime", kind: "entry point", purpose: "Serves requests", evidence: ["src/api.ts"] }],
  edges: [],
  flows: [{ title: "Request", summary: "Request reaches API", steps: ["api"] }],
  recommendations: [{ title: "Add smoke test", confidence: "medium", why: "No route coverage", safeValidationCommand: "npm test" }],
};

test("renders grouped accessible graph with evidence, flow, and Mermaid fallback", () => {
  const output = renderGraph(graph);
  assert.match(output.html, /<main id="content" tabindex="-1">/);
  assert.match(output.html, /class="map-canvas"/);
  assert.match(output.html, /Runtime/);
  assert.match(output.html, /src\/api\.ts/);
  assert.match(output.html, /npm test/);
  assert.match(output.markdown, /```mermaid/);
  assert.match(output.markdown, /Request/);
});

test("rejects nodes without group and recommendations without validation", () => {
  assert.throws(() => renderGraph({ ...graph, nodes: [{ ...graph.nodes[0], group: undefined }] }), /group/);
  assert.throws(() => renderGraph({ ...graph, recommendations: [{ ...graph.recommendations[0], safeValidationCommand: undefined }] }), /safeValidationCommand/);
});
