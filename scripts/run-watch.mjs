import { dashboardView, findRunReport, renderTerminal } from "./run-dashboard.mjs";

export function keyToCommand(chunk) {
  const key = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk ?? "");
  if (["q", "Q", "\u001b", "\u0003"].includes(key)) return "close";
  return undefined;
}

function footer(settled) {
  return settled ? "Run settled · press q, Esc, or Ctrl+C to exit." : "Press q, Esc, or Ctrl+C to exit watch.";
}

export function createWatchSession({ project, selected, stdin = process.stdin, stdout = process.stdout, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let closed = false;
  let settled = !selected.active;
  let interval;
  const tty = Boolean(stdin?.isTTY && stdin.setRawMode && stdout?.isTTY);
  const current = () => findRunReport(project, selected.id) ?? selected;
  const draw = () => {
    const report = current();
    if (!report.active) settled = true;
    const screen = `${renderTerminal(report, dashboardView(project))}\n${footer(settled)}`;
    if (tty) stdout.write(`\x1b[H\x1b[2J${screen}`);
    else stdout.write(`${screen}\n`);
    if (settled && interval) {
      clearIntervalFn(interval);
      interval = undefined;
    }
  };
  function close() {
    if (closed) return;
    closed = true;
    if (interval) clearIntervalFn(interval);
    if (tty) {
      stdin.off("data", onKey);
      stdin.off("SIGINT", close);
      stdin.pause();
      stdin.setRawMode(false);
      stdout.write("\x1b[?25h\x1b[?1049l");
    }
  }
  function onKey(chunk) {
    if (keyToCommand(chunk) === "close") close();
  }
  draw();
  if (!settled && tty) {
    stdout.write("\x1b[?1049h\x1b[?25l");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onKey);
    stdin.on("SIGINT", close);
    interval = setIntervalFn(draw, 2_000);
    if (typeof interval?.unref === "function") interval.unref();
  }
  return { close, settled: () => settled, active: tty && !settled };
}
