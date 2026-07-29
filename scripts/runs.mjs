import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { resolve } from "node:path";
import { dashboardView, loadRunReports, pickerRows, renderTerminal } from "./run-dashboard.mjs";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const projectFlag = args.indexOf("--project");
const project = resolve(projectFlag >= 0 ? args[projectFlag + 1] ?? "." : ".");
const target = args.find(arg => !arg.startsWith("-") && arg !== (projectFlag >= 0 ? args[projectFlag + 1] : undefined));

async function select(reports) {
  if (!reports.length) throw new Error("No Pattern runs found for this project.");
  if (target === "latest") return reports[0];
  if (target) return reports.find(report => report.id === target) ?? (() => { throw new Error(`Run '${target}' was not found.`); })();
  const rows = pickerRows(reports);
  const fzf = spawnSync("fzf", ["--height=60%", "--reverse", "--prompt=Run> "], { input: `${rows.join("\n")}\n`, encoding: "utf8" });
  if (fzf.status === 0) return reports.find(report => fzf.stdout.trim().endsWith(`  ${report.id}`));
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    rows.forEach((row, index) => console.log(`${index + 1}) ${row}`));
    const answer = Number(await prompt.question("Choose run: "));
    return reports[answer - 1];
  } finally { prompt.close(); }
}

async function main() {
  const selected = await select(loadRunReports(project));
  if (!selected) throw new Error("No run selected.");
  const draw = () => {
    if (watch) console.clear();
    const report = loadRunReports(project).find(item => item.id === selected.id) ?? selected;
    process.stdout.write(renderTerminal(report, dashboardView(project)));
  };
  draw();
  if (watch) setInterval(draw, 1_000);
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
