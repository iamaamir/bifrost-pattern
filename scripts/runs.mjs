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

function render(selected) {
  const report = loadRunReports(project).find(item => item.id === selected.id) ?? selected;
  return `${renderTerminal(report, dashboardView(project))}\nPress q, Esc, or Ctrl+C to exit watch.`;
}

function watchRun(selected) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(render(selected));
    return;
  }
  const stdin = process.stdin;
  const stdout = process.stdout;
  let closed = false;
  const draw = () => stdout.write(`\x1b[H\x1b[2J${render(selected)}`);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(interval);
    stdin.off("data", onKey);
    stdin.setRawMode(false);
    stdout.write("\x1b[?25h\x1b[?1049l");
  };
  const onKey = key => { if (["q", "Q", "\u001b", "\u0003"].includes(key)) close(); };
  stdout.write("\x1b[?1049h\x1b[?25l");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on("data", onKey);
  draw();
  const interval = setInterval(draw, 2_000);
}

async function main() {
  const selected = await select(loadRunReports(project));
  if (!selected) throw new Error("No run selected.");
  if (watch) watchRun(selected);
  else process.stdout.write(renderTerminal(selected, dashboardView(project)));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
