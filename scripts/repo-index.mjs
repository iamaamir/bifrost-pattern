import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { locateAstGrep } from "./bootstrap-ast-grep.mjs";
import { basename, dirname, extname, join, relative } from "node:path";

const EXCLUDED_DIRECTORIES = new Set([".git", ".pi", "node_modules", "dist", "build", "coverage", ".next", ".turbo"]);
const SOURCE_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php"]);
const MAX_CANDIDATES = 80;
const MAX_EDGES = 500;
const MAX_SYMBOLS = 250;

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function filesUnder(project, directory = project, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) filesUnder(project, path, result);
    else if (entry.isFile()) result.push(relative(project, path));
  }
  return result.sort();
}

function importEdges(path, content) {
  const edges = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) for (const match of content.matchAll(pattern)) edges.push({ from: path, to: match[1] });
  return edges;
}

function readPackage(project) {
  const path = join(project, "package.json");
  if (!existsSync(path)) return undefined;
  try {
    const source = JSON.parse(readFileSync(path, "utf8"));
    const subset = value => Object.fromEntries(Object.entries(value ?? {}).slice(0, 50));
    return { name: source.name, private: source.private, scripts: subset(source.scripts), dependencies: Object.keys(source.dependencies ?? {}).slice(0, 50), devDependencies: Object.keys(source.devDependencies ?? {}).slice(0, 50) };
  } catch { return { invalid: true }; }
}

function astGrepOutline(project, run, command) {
  const located = command
    ? (() => { const result = run(command, ["--version"], { cwd: project, encoding: "utf8" }); return result?.status === 0 ? { status: "available", command, version: String(result.stdout ?? "").trim() } : { status: "unavailable" }; })()
    : locateAstGrep({ project, run });
  if (located.status !== "available") return { status: "unavailable", symbols: [] };
  const outline = run(located.command, ["outline", ".", "--json=compact"], { cwd: project, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  if (outline?.status !== 0) return { status: "failed", command: located.command, version: located.version, symbols: [] };
  try {
    const parsed = JSON.parse(String(outline.stdout ?? "[]"));
    const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
    const symbols = items.slice(0, MAX_SYMBOLS).flatMap(item => {
      const file = item.file ?? item.path;
      const name = item.name;
      if (!file || !name) return [];
      return [{ file, name, kind: item.symbolType ?? item.kind ?? "symbol", line: item.range?.start?.line ?? item.start?.line ?? 0 }];
    });
    return { status: "available", command: located.command, version: located.version, symbols };
  } catch { return { status: "failed", command: located.command, version: located.version, symbols: [] }; }
}

function directoryCounts(paths) {
  const counts = new Map();
  for (const path of paths) {
    const segments = path.split("/").slice(0, -1);
    const key = segments.slice(0, 2).join("/") || ".";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([path, files]) => ({ path, files }));
}

export function buildRepoIndex({ project, cachePath, run = spawnSync, astGrepCommand }) {
  const paths = filesUnder(project);
  const languages = {};
  const fingerprints = [];
  const edges = [];
  for (const path of paths) {
    const extension = extname(path).toLowerCase() || "(none)";
    languages[extension] = (languages[extension] ?? 0) + 1;
    const content = readFileSync(join(project, path));
    fingerprints.push(`${path}:${hash(content)}`);
    if (SOURCE_EXTENSIONS.has(extension) && edges.length < MAX_EDGES) edges.push(...importEdges(path, content.toString("utf8")).slice(0, MAX_EDGES - edges.length));
  }
  const fingerprint = hash(fingerprints.join("\n"));
  const astGrep = astGrepOutline(project, run, astGrepCommand);
  const capabilityFingerprint = hash(JSON.stringify({ status: astGrep.status, version: astGrep.version }));
  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, "utf8"));
      if (cached.fingerprint === fingerprint && cached.capabilityFingerprint === capabilityFingerprint) return { ...cached, cacheHit: true };
    } catch { /* rebuild corrupt cache */ }
  }
  const name = path => basename(path).toLowerCase();
  const entryCandidates = paths.filter(path => /^(index|main|app|server|cli)\.(?:[cm]?[jt]sx?|py|go|rs|java|rb|php)$/.test(name(path))).slice(0, MAX_CANDIDATES);
  const testCandidates = paths.filter(path => /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[^/]+$/.test(path)).slice(0, MAX_CANDIDATES);
  const index = {
    version: 1,
    fingerprint,
    capabilityFingerprint,
    cacheHit: false,
    summary: { files: paths.length, languages, directories: directoryCounts(paths) },
    manifests: { package: readPackage(project), configFiles: paths.filter(path => /(?:^|\/)(?:package|tsconfig|vite\.config|next\.config|docker-compose|Makefile|README)/i.test(path)).slice(0, 40) },
    entryCandidates,
    testCandidates,
    capabilities: { astGrep },
    importEdges: edges.slice(0, MAX_EDGES),
  };
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
  return index;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [project, cachePath, outputPath] = process.argv.slice(2);
  if (!project || !cachePath || !outputPath) throw new Error("Usage: repo-index <project> <cache-path> <output-path>");
  const index = buildRepoIndex({ project, cachePath });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
}
