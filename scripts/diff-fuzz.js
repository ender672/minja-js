#!/usr/bin/env node
/**
 * Differential fuzzer: generates random template + context pairs,
 * renders them with both the C++ minja and JS minja implementations,
 * and reports any mismatches.
 *
 * Usage:
 *   node scripts/diff-fuzz.js [--cpp-bin PATH] [--iterations N] [--timeout MS] [--seed N]
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Worker mode: when spawned as a worker, render and post result back ──

if (!isMainThread) {
  const { Parser, Context, Value } = await import('../src/minja.js');
  parentPort.on('message', ({ template, context }) => {
    try {
      const root = Parser.parse(template, {});
      const ctx = Context.make(Value.fromJS(context));
      const result = root.render(ctx);
      parentPort.postMessage({ result, error: null });
    } catch (e) {
      parentPort.postMessage({ result: null, error: e.message || String(e) });
    }
  });
  // Signal ready
  parentPort.postMessage({ ready: true });
  // Block — worker stays alive until terminated
  await new Promise(() => {});
}

// ── CLI args ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    cppBin: null,
    iterations: 10000,
    timeout: 2000,
    seed: Date.now(),
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cpp-bin') opts.cppBin = resolve(args[++i]);
    else if (args[i] === '--iterations') opts.iterations = parseInt(args[++i], 10);
    else if (args[i] === '--timeout') opts.timeout = parseInt(args[++i], 10);
    else if (args[i] === '--seed') opts.seed = parseInt(args[++i], 10);
  }
  if (!opts.cppBin) {
    console.error('Usage: node scripts/diff-fuzz.js --cpp-bin /path/to/diff-fuzz-render [--iterations N] [--timeout MS] [--seed N]');
    process.exit(1);
  }
  return opts;
}

// ── PRNG (xorshift128+) ────────────────────────────────────────────────

class Rng {
  constructor(seed) {
    // Initialise two 64-bit states from a 32-bit seed using splitmix-like mixing.
    // We store as pairs of 32-bit values since JS has no native u64.
    let s = seed >>> 0;
    const mix = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s >>> 0; };
    this.s0h = mix(); this.s0l = mix();
    this.s1h = mix(); this.s1l = mix();
    // Ensure not all-zero
    if ((this.s0h | this.s0l | this.s1h | this.s1l) === 0) this.s0l = 1;
  }
  /** Returns a random uint32. */
  next() {
    // Simplified: we only need 32 bits, so use a basic xorshift32 on a single state.
    let s = (this.s0h ^ this.s1h) >>> 0;
    this.s0h ^= this.s0h << 13;
    this.s0h ^= this.s0h >>> 17;
    this.s0h ^= this.s0h << 5;
    this.s0h = (this.s0h >>> 0);
    [this.s0h, this.s1h] = [this.s1h, this.s0h];
    return s;
  }
  /** Returns a random float in [0, 1). */
  float() { return this.next() / 0x100000000; }
  /** Returns a random integer in [lo, hi). */
  int(lo, hi) { return lo + (this.next() % (hi - lo)); }
  /** Pick a random element from an array. */
  pick(arr) { return arr[this.int(0, arr.length)]; }
  /** Return true with probability p. */
  chance(p) { return this.float() < p; }
}

// ── Input generation ────────────────────────────────────────────────────

const IDENTS = ['x', 'y', 'z', 'items', 'name', 'val', 'loop', 'i', 'k', 'v', 'ns', 'obj', 'arr'];
const FILTERS = ['length', 'upper', 'lower', 'trim', 'string', 'int', 'float', 'abs', 'first', 'last',
  'reverse', 'sort', 'unique', 'list', 'title', 'capitalize', 'default', 'tojson',
  'e', 'escape', 'count', 'dictsort', 'join', 'indent', 'map', 'reject', 'select',
  'selectattr', 'rejectattr', 'batch', 'items', 'pprint'];
const TESTS = ['defined', 'undefined', 'none', 'true', 'false', 'string', 'number',
  'integer', 'iterable', 'mapping', 'equalto', 'even', 'odd'];
const OPS = ['+', '-', '*', '/', '//', '%', '~', '==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not ',
  'in', 'not in', 'is', 'is not'];

function genExpr(rng, depth = 0) {
  if (depth > 3) return rng.pick(IDENTS);
  const kind = rng.int(0, 12);
  switch (kind) {
    case 0: return rng.pick(IDENTS);
    case 1: return String(rng.int(-10, 100));
    case 2: return `"${rng.pick(['hello', '', 'a', 'test', ' '])}"`;
    case 3: return rng.pick(['true', 'false', 'none']);
    case 4: return `${genExpr(rng, depth + 1)} ${rng.pick(OPS)} ${genExpr(rng, depth + 1)}`;
    case 5: return `${genExpr(rng, depth + 1)} | ${rng.pick(FILTERS)}`;
    case 6: return `${genExpr(rng, depth + 1)} is ${rng.pick(TESTS)}`;
    case 7: return `[${genExpr(rng, depth + 1)}, ${genExpr(rng, depth + 1)}]`;
    case 8: return `{"k": ${genExpr(rng, depth + 1)}}`;
    case 9: return `${genExpr(rng, depth + 1)}[${rng.int(0, 3)}]`;
    case 10: return `${genExpr(rng, depth + 1)}.${rng.pick(IDENTS)}`;
    case 11: return `range(${rng.int(0, 5)})`;
    default: return rng.pick(IDENTS);
  }
}

function genTemplate(rng) {
  const parts = [];
  const nParts = rng.int(1, 8);
  for (let i = 0; i < nParts; i++) {
    const kind = rng.int(0, 10);
    switch (kind) {
      case 0: // literal text
        parts.push(rng.pick(['Hello', ' ', 'world', '\n', 'foo', 'bar', ',', '.', '']));
        break;
      case 1: // expression
        parts.push(`{{ ${genExpr(rng)} }}`);
        break;
      case 2: { // if/endif
        const expr = genExpr(rng);
        const body = rng.pick(['yes', `{{ ${rng.pick(IDENTS)} }}`, '']);
        if (rng.chance(0.3)) {
          parts.push(`{% if ${expr} %}${body}{% else %}no{% endif %}`);
        } else {
          parts.push(`{% if ${expr} %}${body}{% endif %}`);
        }
        break;
      }
      case 3: { // for/endfor
        const ident = rng.pick(['x', 'i', 'item', 'v']);
        const iter = rng.pick([`range(${rng.int(0, 5)})`, 'items', 'arr', `[1,2,3]`, `"abc"`]);
        const body = rng.pick([`{{ ${ident} }}`, `{{ loop.index }}`, ident]);
        parts.push(`{% for ${ident} in ${iter} %}${body}{% endfor %}`);
        break;
      }
      case 4: // set
        parts.push(`{% set ${rng.pick(IDENTS)} = ${genExpr(rng)} %}`);
        break;
      case 5: // comment
        parts.push(`{# ${rng.pick(['comment', 'TODO', ''])} #}`);
        break;
      case 6: // whitespace control variants
        parts.push(`{{- ${genExpr(rng)} -}}`);
        break;
      case 7: // nested expression with filter chain
        parts.push(`{{ ${genExpr(rng)} | ${rng.pick(FILTERS)} }}`);
        break;
      case 8: // macro
        if (rng.chance(0.3)) {
          const mname = rng.pick(['m', 'render', 'show']);
          parts.push(`{% macro ${mname}(a) %}{{ a }}{% endmacro %}{{ ${mname}("test") }}`);
        } else {
          parts.push(rng.pick(['Hello', ' ', '']));
        }
        break;
      case 9: // raw text with special chars
        parts.push(rng.pick(['<div>', '&amp;', '"quoted"', "'single'", '0', '  ']));
        break;
      default:
        parts.push(' ');
    }
  }
  return parts.join('');
}

function genContext(rng) {
  const ctx = {};
  // Always include some common variables
  ctx.name = rng.pick(['Alice', 'Bob', '', 'World']);
  ctx.x = rng.pick([0, 1, -1, 42, 3.14, null, true, false, 'hello', '', []]);
  ctx.y = rng.pick([0, 1, 2, null, 'test', true, false]);
  ctx.z = rng.pick([0, 1, 'key', null]);
  ctx.items = [];
  const nItems = rng.int(0, 5);
  for (let i = 0; i < nItems; i++) {
    ctx.items.push(rng.pick([i, `item${i}`, null, { id: i }, [i, i + 1]]));
  }
  ctx.arr = ctx.items;
  ctx.val = rng.pick([0, 1, '', null, true, { a: 1 }]);
  ctx.obj = { a: 1, b: 'two', c: [3] };
  if (rng.chance(0.3)) ctx.i = rng.int(-5, 10);
  if (rng.chance(0.3)) ctx.k = rng.pick(['a', 'b', 'c', '']);
  if (rng.chance(0.3)) ctx.v = rng.pick([null, 0, '', false, []]);
  return ctx;
}

// ── Load real templates as seeds ────────────────────────────────────────

function loadTemplateSeeds() {
  const dir = resolve(__dirname, '../test-templates');
  const seeds = [];
  try {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.jinja')) {
        seeds.push(readFileSync(resolve(dir, f), 'utf-8'));
      }
    }
  } catch { /* no test-templates dir */ }
  return seeds;
}

// ── JS render (via worker thread) ───────────────────────────────────────

function createJSWorker() {
  const worker = new Worker(fileURLToPath(import.meta.url));
  let pending = null;
  let ready = false;
  const readyPromise = new Promise((res) => {
    worker.once('message', (msg) => {
      if (msg.ready) { ready = true; res(); }
    });
  });

  worker.on('message', (msg) => {
    if (msg.ready) return;
    if (pending) {
      const { resolve, _timer } = pending;
      pending = null;
      clearTimeout(_timer);
      resolve(msg);
    }
  });

  return {
    waitReady: () => readyPromise,
    render(template, context, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending = null;
          resolve({ result: null, error: 'JS_TIMEOUT' });
          // Kill the hung worker — a new one will be created
          worker.terminate();
        }, timeoutMs);
        pending = { resolve, _timer: timer };
        worker.postMessage({ template, context });
      });
    },
    get alive() { return ready; },
    terminate() { worker.terminate(); },
    onExit(fn) { worker.on('exit', fn); },
  };
}

/** Manages a JS worker, restarting it if it gets killed by a timeout. */
function createJSRenderer() {
  let w = null;
  let readyP = null;

  function spawn() {
    w = createJSWorker();
    readyP = w.waitReady();
    w.onExit(() => { w = null; });
  }

  spawn();

  return {
    async render(template, context, timeoutMs) {
      if (!w) { spawn(); }
      await readyP;
      const res = await w.render(template, context, timeoutMs);
      if (res.error === 'JS_TIMEOUT') {
        // Worker was terminated, will respawn on next call
      }
      return res;
    },
    close() { if (w) w.terminate(); },
  };
}

// ── C++ process management ──────────────────────────────────────────────

function spawnCppProcess(binPath) {
  const proc = spawn(binPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let pending = null;

  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    if (pending) {
      const { resolve, _timer } = pending;
      pending = null;
      clearTimeout(_timer);
      try {
        resolve(JSON.parse(line));
      } catch (e) {
        resolve({ result: null, error: `parse-error: ${line}` });
      }
    }
  });

  proc.on('error', () => {});
  proc.stderr.on('data', () => {}); // drain stderr

  return {
    render(input, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending = null;
          resolve({ result: null, error: 'CPP_TIMEOUT' });
          // Kill the hung process — a new one will be created
          proc.kill('SIGKILL');
        }, timeoutMs);
        pending = { resolve, _timer: timer };
        proc.stdin.write(JSON.stringify(input) + '\n');
      });
    },
    kill() { proc.kill('SIGKILL'); },
    onExit(fn) { proc.on('exit', fn); },
  };
}

/** Manages a C++ process, restarting it if killed by a timeout. */
function createCppRenderer(binPath) {
  let p = null;

  function start() {
    p = spawnCppProcess(binPath);
    p.onExit(() => { p = null; });
  }

  start();

  return {
    async render(input, timeoutMs) {
      if (!p) { start(); }
      const res = await p.render(input, timeoutMs);
      return res;
    },
    close() { if (p) p.kill(); },
  };
}

// ── Normalise for comparison ────────────────────────────────────────────

function normaliseError(err) {
  if (!err) return null;
  // Both threw — that's agreement (error messages will differ between impls)
  return 'ERROR';
}

function resultsMatch(jsRes, cppRes) {
  const jsErr = normaliseError(jsRes.error);
  const cppErr = normaliseError(cppRes.error);

  // Both errored — that's a match
  if (jsErr && cppErr) return true;
  // One errored, the other didn't — mismatch
  if (jsErr !== cppErr) return false;
  // Both succeeded — compare output strings
  return jsRes.result === cppRes.result;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const rng = new Rng(opts.seed);
  const cpp = createCppRenderer(opts.cppBin);
  const js = createJSRenderer();
  const templateSeeds = loadTemplateSeeds();

  console.log(`Differential fuzzer starting (seed=${opts.seed}, iterations=${opts.iterations})`);
  console.log(`C++ binary: ${opts.cppBin}`);
  console.log(`Loaded ${templateSeeds.length} template seeds`);
  console.log();

  let passed = 0;
  let bothErrored = 0;
  let mismatches = 0;
  let timeouts = 0;

  for (let i = 0; i < opts.iterations; i++) {
    let template;
    // 20% of the time, use a real template seed (these are complex, so expect errors)
    if (templateSeeds.length > 0 && rng.chance(0.2)) {
      template = rng.pick(templateSeeds);
    } else {
      template = genTemplate(rng);
    }
    const context = genContext(rng);
    const input = { template, context };

    // Run both with timeouts — JS runs in a worker thread so it can be killed
    const [jsRes, cppRes] = await Promise.all([
      js.render(template, context, opts.timeout),
      cpp.render(input, opts.timeout),
    ]);

    if (cppRes.error === 'CPP_TIMEOUT' || jsRes.error === 'JS_TIMEOUT') {
      timeouts++;
      continue;
    }

    if (resultsMatch(jsRes, cppRes)) {
      if (jsRes.error) bothErrored++;
      else passed++;
    } else {
      mismatches++;
      const shortTmpl = template.length > 200 ? template.slice(0, 200) + '...' : template;
      console.log(`MISMATCH #${mismatches} (iteration ${i}):`);
      console.log(`  Template: ${JSON.stringify(shortTmpl)}`);
      console.log(`  Context:  ${JSON.stringify(context).slice(0, 200)}`);
      console.log(`  C++ => ${JSON.stringify(cppRes)}`);
      console.log(`  JS  => ${JSON.stringify(jsRes)}`);
      console.log();

      if (mismatches >= 50) {
        console.log('Stopping after 50 mismatches.');
        break;
      }
    }

    if ((i + 1) % 1000 === 0) {
      console.log(`... ${i + 1}/${opts.iterations} (${passed} passed, ${bothErrored} both-errored, ${mismatches} mismatches, ${timeouts} timeouts)`);
    }
  }

  cpp.close();
  js.close();

  console.log();
  console.log('=== Summary ===');
  console.log(`Total iterations: ${passed + bothErrored + mismatches + timeouts}`);
  console.log(`Passed (both agree on output): ${passed}`);
  console.log(`Both errored (agreement):      ${bothErrored}`);
  console.log(`Mismatches:                     ${mismatches}`);
  console.log(`Timeouts (C++ or JS):           ${timeouts}`);

  process.exit(mismatches > 0 ? 1 : 0);
}

main();
