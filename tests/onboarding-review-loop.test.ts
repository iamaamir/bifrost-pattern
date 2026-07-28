import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;

test("repo onboarding declares bounded specialist and junior review loop", () => {
  const recipe = JSON.parse(readFileSync(join(root, "recipes/repo-onboarding/recipe.json"), "utf8"));
  assert.deepEqual(recipe.artifactReview, {
    author: "bifrost-frontend-specialist",
    reviewer: "bifrost-junior-onboarding-reviewer",
    maxRevisions: 3,
  });
  const frontend = readFileSync(join(root, "agents/bifrost-frontend-specialist.md"), "utf8");
  const reviewer = readFileSync(join(root, "agents/bifrost-junior-onboarding-reviewer.md"), "utf8");
  assert.match(frontend, /draft directory/i);
  assert.match(reviewer, /critical|warning/i);
});
