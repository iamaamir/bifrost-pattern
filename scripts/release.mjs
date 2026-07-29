#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function run(command, commandArgs, capture = false) {
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  })?.trim();
}

function usage() {
  console.log("Usage: npm run release -- --patch|--minor|--major --publish");
}

function nextVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid package version: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "major") return `${major + 1}.0.0`;
  throw new Error("Choose exactly one of --patch, --minor, or --major.");
}

function requireCleanTree() {
  const status = run("git", ["status", "--porcelain"], true);
  if (status) throw new Error(`Working tree is not clean:\n${status}`);
}

function confirmPublished(name, version) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      if (JSON.parse(run("npm", ["view", `${name}@${version}`, "version", "--json"], true)) === version) return;
    } catch {
      // npm registry propagation is eventually consistent after publish.
    }
    if (attempt < 6) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
  }
  throw new Error(`npm registry did not confirm ${name}@${version} after 30 seconds.`);
}

function main() {
  if (args.includes("--help") || args.includes("-h")) return usage();
  const bumps = args.filter(arg => ["--patch", "--minor", "--major"].includes(arg));
  if (bumps.length !== 1 || !args.includes("--publish")) {
    usage();
    throw new Error("Release requires one bump flag and explicit --publish.");
  }

  requireCleanTree();
  run("npm", ["test"]);
  run("npm", ["run", "recipe:validate"]);
  run("npm", ["run", "delegation:validate"]);

  const packagePath = resolve(root, "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const version = nextVersion(pkg.version, bumps[0].slice(2));
  pkg.version = version;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  const tag = `v${version}`;
  run("git", ["add", "package.json"]);
  run("git", ["commit", "-m", `chore: release ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
  run("git", ["push", "origin", "main"]);
  run("git", ["push", "origin", tag]);
  run("npm", ["publish", "--access", "public"]);
  run("gh", ["release", "create", tag, "--title", tag, "--generate-notes"]);
  confirmPublished(pkg.name, version);
  console.log(`Released ${pkg.name}@${version}.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
