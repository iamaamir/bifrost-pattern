import assert from "node:assert/strict";
import test from "node:test";
import { renderGraph } from "../scripts/onboarding-graph.mjs";

const graph = {
  title: "Example onboarding",
  overview: {
    thesis: "Requests enter API and execute domain rules.",
    systems: [
      { id: "delivery", label: "Delivery", purpose: "Accepts requests" },
      { id: "domain", label: "Domain", purpose: "Owns rules" },
      { id: "quality", label: "Quality", purpose: "Verifies behavior" },
    ],
    primaryFlow: { title: "Request path", summary: "Request reaches domain", steps: ["delivery", "domain"] },
  },
  nodes: [
    { id: "api", label: "API", system: "delivery", kind: "entry point", purpose: "Serves requests", evidence: ["src/api.ts"] },
    { id: "rules", label: "Rules", system: "domain", kind: "service", purpose: "Applies rules", evidence: ["src/rules.ts"] },
  ],
  edges: [{ from: "api", to: "rules", label: "calls" }],
  flows: [{ title: "Request", summary: "Request reaches domain", steps: ["api", "rules"] }],
  recommendations: [{ title: "Add smoke test", confidence: "medium", why: "No route coverage", safeValidationCommand: "npm test" }],
};

test("renders system overview with primary flow and hidden component detail", () => {
  const output = renderGraph(graph);
  assert.match(output.html, /class="system-map"/);
  assert.match(output.html, /Requests enter API and execute domain rules/);
  assert.match(output.html, /Request path/);
  assert.match(output.html, /Components in selected system/);
  assert.match(output.html, /npm test/);
  assert.match(output.markdown, /```mermaid/);
  assert.match(output.markdown, /## System overview/);
});

test("allows model to omit overview structure and derives a safe detail view", () => {
  const output = renderGraph({ ...graph, overview: undefined, nodes: [{ ...graph.nodes[0], system: undefined }], edges: [], flows: [] });
  assert.match(output.html, /Components/);
});

test("rejects broken graph references", () => {
  assert.throws(() => renderGraph({ ...graph, edges: [{ from: "missing", to: "rules" }] }), /known nodes/);
});
