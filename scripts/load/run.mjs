import { performance } from "node:perf_hooks";
import process from "node:process";
import { z } from "zod";
import {
  InMemoryWorkQueue,
  MemoryStore,
  capability,
  capabilityViews,
  createRuntime,
  createWorker,
  defineApp,
} from "@captra-ai/core";
import { createCaptraHandler } from "@captra-ai/server";
import {
  PostgresRunStore,
  PostgresSemanticMemoryStore,
  migrateCaptra,
  migrateCaptraVectors,
} from "@captra-ai/postgres";
import { Pool } from "pg";

const profiles = {
  ci: { runs: 40, sse: 24, queued: 40, reconnects: 48, postgres: 24, vectors: 24 },
  baseline: { runs: 500, sse: 250, queued: 500, reconnects: 1_000, postgres: 250, vectors: 250 },
};
const targets = {
  errorRate: 0,
  direct: { p95Ms: 250, minThroughput: 30 },
  sse: { p95Ms: 500, minThroughput: 20 },
  queue: { p95Ms: 750, minThroughput: 20, recoveryMs: 250 },
  reconnect: { p95Ms: 250, minThroughput: 50 },
  postgres: { p95Ms: 750, minThroughput: 20, maxPoolWaiters: 64 },
  vector: { p95Ms: 750, minThroughput: 15 },
  maxHeapGrowthMb: 128,
  maxEventBacklog: 12,
};
const profileName = valueAfter("--profile") ?? "ci";
const config = profiles[profileName];
if (!config) throw new Error(`Unknown load profile: ${profileName}`);

const identity = { tenantId: "load", userId: "runner", projectId: "suite" };
const echo = capability({
  name: "load.echo",
  description: "Deterministic load probe",
  input: z.object({ value: z.number() }),
  output: z.object({ value: z.number() }),
  memory: ["user"],
  run: async (input) => input,
  view: { name: "LoadResult" },
});

function runtime() {
  const memory = new MemoryStore();
  memory.remember({ tenantId: identity.tenantId, scope: "user", ownerId: identity.userId, type: "fact", content: "load probe", confidence: 1 });
  return createRuntime(defineApp({ name: "Captra load", scopes: ["user"], capabilities: [echo], surface: capabilityViews() }), { memory });
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}
async function measured(name, count, operation) {
  const latencies = [], errors = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: count }, async (_, index) => {
    const itemStarted = performance.now();
    try { await operation(index); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
    latencies.push(performance.now() - itemStarted);
  }));
  const durationMs = performance.now() - started;
  return {
    name, count, errors: errors.length, errorRate: errors.length / count,
    durationMs: round(durationMs), throughput: round(count / (durationMs / 1_000)),
    latency: { p50Ms: round(percentile(latencies, .5)), p95Ms: round(percentile(latencies, .95)), p99Ms: round(percentile(latencies, .99)), maxMs: round(Math.max(...latencies)) },
    samples: errors.slice(0, 3),
  };
}
function round(value) { return Math.round(value * 100) / 100; }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function assertMetric(result, threshold) {
  const failures = [];
  if (result.errorRate > targets.errorRate) failures.push(`error rate ${result.errorRate} > ${targets.errorRate}`);
  if (threshold?.p95Ms !== undefined && result.latency.p95Ms > threshold.p95Ms) failures.push(`p95 ${result.latency.p95Ms}ms > ${threshold.p95Ms}ms`);
  if (threshold?.minThroughput !== undefined && result.throughput < threshold.minThroughput) failures.push(`throughput ${result.throughput}/s < ${threshold.minThroughput}/s`);
  return failures.map(message => `${result.name}: ${message}`);
}

async function inMemoryScenarios() {
  const appRuntime = runtime();
  let maxEventBacklog = 0;
  const direct = await measured("concurrent-runs", config.runs, async index => {
    const result = await appRuntime.execute({ capability: echo.name, input: { value: index }, identity });
    if (result.value.value !== index) throw new Error("incorrect output");
    maxEventBacklog = Math.max(maxEventBacklog, result.trace.length);
  });

  const handler = createCaptraHandler(appRuntime, { auth: async () => identity });
  const sse = await measured("sse-clients", config.sse, async index => {
    const response = await handler(new Request("http://load.test/runs/stream", { method: "POST", body: JSON.stringify({ capability: echo.name, input: { value: index } }) }));
    const body = await response.text();
    if (!body.includes("event: result") || !body.includes("run.completed")) throw new Error("incomplete SSE stream");
  });

  const queueRuntime = runtime(), queue = new InMemoryWorkQueue();
  await Promise.all(Array.from({ length: config.queued }, (_, index) => queueRuntime.enqueue({ capability: echo.name, input: { value: index }, identity }, queue)));
  const workers = Array.from({ length: Math.min(8, config.queued) }, (_, index) => createWorker({ runtime: queueRuntime, queue, workerId: `worker-${index}`, retryDelay: () => 0 }));
  const queued = await measured("queue-workers", config.queued, index => workers[index % workers.length].runOnce().then(result => { if (!result.worked || result.error) throw new Error(result.error ?? "queue empty"); }));

  const recoveryRun = await queueRuntime.enqueue({ capability: echo.name, input: { value: -1 }, identity }, queue);
  const crashedLease = await queue.claim("crashed-worker", 15);
  if (!crashedLease) throw new Error("recovery probe was not leased");
  const recoveryStarted = performance.now();
  await delay(20);
  const recovered = await createWorker({ runtime: queueRuntime, queue, workerId: "recovery-worker" }).runOnce();
  const recoveryMs = round(performance.now() - recoveryStarted);
  if (!recovered.worked || (await queueRuntime.runs.get(recoveryRun.id))?.status !== "completed") throw new Error("expired queue lease was not recovered");

  const seed = await appRuntime.execute({ capability: echo.name, input: { value: 99 }, identity });
  const reconnect = await measured("reconnect-storm", config.reconnects, async () => {
    const response = await handler(new Request(`http://load.test/runs/${seed.run.id}/events?after=0`));
    const events = await response.json();
    if (!Array.isArray(events) || !events.some(event => event.type === "run.completed")) throw new Error("reconnect missed terminal event");
  });
  return { results: [direct, sse, queued, reconnect], recoveryMs, maxEventBacklog };
}

function embedding(text) {
  const values = [0, 0, 0];
  for (let index = 0; index < text.length; index++) values[index % 3] += text.charCodeAt(index) / 255;
  const length = Math.hypot(...values) || 1;
  return values.map(value => value / length);
}
async function postgresScenarios(connectionString) {
  if (!connectionString) return { skipped: "CAPTRA_POSTGRES_URL is not configured", results: [], maxPoolWaiters: 0 };
  const schema = `captra_load_${process.pid}_${Date.now()}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` });
  const client = { query: async (text, values) => { const result = await pool.query(text, [...(values ?? [])]); return { rows: result.rows, rowCount: result.rowCount }; } };
  let maxPoolWaiters = 0;
  const sampler = setInterval(() => { maxPoolWaiters = Math.max(maxPoolWaiters, pool.waitingCount); }, 1);
  try {
    await migrateCaptra(client); await migrateCaptraVectors(client, 3);
    const runs = new PostgresRunStore(client);
    const postgres = await measured("postgres-runs", config.postgres, async index => {
      const run = await runs.create({ app: "Load", appVersion: "1", capability: echo.name, input: { index }, identity: { ...identity, userId: `runner-${index % 8}` } });
      await runs.update(run.id, { status: "running" });
      await runs.appendEvent(run.id, { type: "agent.step", capability: echo.name, detail: "load" });
      const completed = await runs.compareAndSet(run.id, ["running"], { status: "completed", output: { value: index } });
      if (!completed) throw new Error("terminal CAS failed");
    });
    const memory = new PostgresSemanticMemoryStore(client, { embed: async texts => texts.map(embedding) }, { dimensions: 3, minSimilarity: -1, deduplicateSimilarity: 1.1 });
    await Promise.all(Array.from({ length: config.vectors }, (_, index) => memory.remember({ tenantId: identity.tenantId, scope: "user", ownerId: identity.userId, type: "fact", content: `vector record ${index}`, confidence: 1 })));
    const vector = await measured("pgvector-search", config.vectors, async index => {
      const records = await memory.recall(["user"], identity, { query: `record ${index}`, limit: 5 });
      if (!records.length) throw new Error("vector search returned no records");
    });
    return { results: [postgres, vector], maxPoolWaiters };
  } finally {
    clearInterval(sampler); await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end();
  }
}

const heapBefore = process.memoryUsage().heapUsed;
const inMemory = await inMemoryScenarios();
const postgres = await postgresScenarios(process.env.CAPTRA_POSTGRES_URL);
const heapGrowthMb = round(Math.max(0, process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024);
const report = { schemaVersion: 1, profile: profileName, generatedAt: new Date().toISOString(), node: process.version, targets, metrics: [...inMemory.results, ...postgres.results], recoveryMs: inMemory.recoveryMs, maxEventBacklog: inMemory.maxEventBacklog, maxPoolWaiters: postgres.maxPoolWaiters, heapGrowthMb, postgresSkipped: postgres.skipped };
const failures = report.metrics.flatMap(result => assertMetric(result, targets[result.name === "concurrent-runs" ? "direct" : result.name === "sse-clients" ? "sse" : result.name === "queue-workers" ? "queue" : result.name === "reconnect-storm" ? "reconnect" : result.name === "postgres-runs" ? "postgres" : "vector"]));
if (report.recoveryMs > targets.queue.recoveryMs) failures.push(`queue-recovery: ${report.recoveryMs}ms > ${targets.queue.recoveryMs}ms`);
if (report.maxEventBacklog > targets.maxEventBacklog) failures.push(`event backlog ${report.maxEventBacklog} > ${targets.maxEventBacklog}`);
if (report.maxPoolWaiters > targets.postgres.maxPoolWaiters) failures.push(`database pool waiters ${report.maxPoolWaiters} > ${targets.postgres.maxPoolWaiters}`);
if (report.heapGrowthMb > targets.maxHeapGrowthMb) failures.push(`heap growth ${report.heapGrowthMb}MB > ${targets.maxHeapGrowthMb}MB`);
console.log(JSON.stringify({ ...report, passed: failures.length === 0, failures }, null, 2));
if (failures.length) process.exitCode = 1;
