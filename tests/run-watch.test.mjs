import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createWatchSession, keyToCommand } from "../scripts/run-watch.mjs";

function mockTTY() {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.setRawModeCalls = [];
  stdin.setRawMode = value => stdin.setRawModeCalls.push(value);
  stdin.resume = () => { stdin.resumed = true; };
  stdin.pause = () => { stdin.paused = true; };
  stdin.off = stdin.removeListener.bind(stdin);
  const stdout = { isTTY: true, writes: [], write(chunk) { this.writes.push(String(chunk)); } };
  return { stdin, stdout };
}

test("decodes watch exit keys", () => {
  assert.equal(keyToCommand(Buffer.from("q")), "close");
  assert.equal(keyToCommand(Buffer.from("\u001b")), "close");
  assert.equal(keyToCommand(Buffer.from("\u0003")), "close");
  assert.equal(keyToCommand(Buffer.from("a")), undefined);
});

test("does not enable watch when selected run already settled", () => {
  const { stdin, stdout } = mockTTY();
  let interval = 0;
  const session = createWatchSession({
    project: "/tmp/project",
    selected: { id: "run-1", active: false, recipe: "demo", outcome: "completed", outerModel: "x", workers: [] },
    stdin,
    stdout,
    setIntervalFn: () => ++interval,
    clearIntervalFn: () => { interval = 0; },
  });
  assert.equal(session.active(), false);
  assert.equal(session.settled(), true);
  assert.equal(stdin.setRawModeCalls.length, 0);
  assert.match(stdout.writes.join(""), /Run settled\./);
  assert.equal(interval, 0);
});

test("closes watch on q key and restores tty", () => {
  const { stdin, stdout } = mockTTY();
  let interval = 0;
  const session = createWatchSession({
    project: "/tmp/project",
    selected: { id: "run-1", active: true, recipe: "demo", outcome: "running", outerModel: "x", workers: [] },
    stdin,
    stdout,
    setIntervalFn: fn => { interval = 1; return fn; },
    clearIntervalFn: () => { interval = 0; },
  });
  assert.equal(session.active(), true);
  assert.deepEqual(stdin.setRawModeCalls, [true]);
  stdin.emit("data", Buffer.from("q"));
  assert.deepEqual(stdin.setRawModeCalls, [true, false]);
  assert.equal(stdin.paused, true);
  assert.equal(interval, 0);
  assert.match(stdout.writes.join(""), /Press q/);
});

test("auto-exits when selected run settles", () => {
  const project = mkdtempSync(join(tmpdir(), "bifrost-watch-"));
  const runs = join(project, ".pi", "bifrost-patterns", "runs");
  mkdirSync(runs, { recursive: true });
  writeFileSync(join(runs, "run-1.json"), JSON.stringify({ runId: "run-1", recipe: "demo", startedAt: "2026-07-29T08:00:00.000Z", outcome: "running", outerModel: "x", workers: [] }));
  const { stdin, stdout } = mockTTY();
  let interval = 0;
  const session = createWatchSession({
    project,
    selected: { id: "run-1", active: true, recipe: "demo", outcome: "running", outerModel: "x", workers: [] },
    stdin,
    stdout,
    setIntervalFn: fn => {
      interval = 1;
      writeFileSync(join(runs, "run-1.json"), JSON.stringify({ runId: "run-1", recipe: "demo", startedAt: "2026-07-29T08:00:00.000Z", endedAt: "2026-07-29T08:01:00.000Z", outcome: "completed", outerModel: "x", workers: [] }));
      fn();
      return fn;
    },
    clearIntervalFn: () => { interval = 0; },
  });
  assert.equal(session.settled(), true);
  assert.equal(session.active(), false);
  assert.equal(interval, 0);
  assert.deepEqual(stdin.setRawModeCalls, [true, false]);
  assert.match(stdout.writes.join(""), /Run settled\./);
});
