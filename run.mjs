#!/usr/bin/env node
// Runs the admission cases against System One-compatible decision models and
// grades the resulting admit/escalate decisions. Node >= 20, no dependencies.
//
//   node run.mjs [--backends jev,clef,clef-flash] [--passes 3]
//                [--concurrency 6] [--order given|reversed] [--out results]
//
// --order reversed presents each write's accepted records in the opposite
// order. The decision takes the strongest evidence across all of them, so a
// backend that reads the state faithfully decides the same either way.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const TIMEOUT_MS = 2500; // production fails a write closed (to review) past this
const EVAL_CALL_TIMEOUT_MS = 60_000; // slow answers are still graded; latency is scored separately
const THRESHOLDS = { yesAtLeast: 0.5, noBelow: 0.2 };
const GATES = { minRecall: 0.95, minRoutineAdmit: 0.85, maxP95Ms: TIMEOUT_MS };

const RELATION_CRITERIA = {
  contradicts: {
    what:
      "The two cannot both be true: the incoming record denies, reverses, " +
      "or gives a different value for something the accepted record asserts.",
    examples: [
      "'No on-premise option' vs 'now supports on-premise deployment'",
      "'Standard plan is $49/mo' vs 'Standard plan is $79/mo'",
    ],
  },
  restates: {
    what:
      "The incoming record asserts the same facts or guidance as the " +
      "accepted record, possibly in different words, and adds nothing material.",
    not_for: "A record that repeats some of it but adds new facts.",
  },
  compatible: {
    what:
      "Both can be true together: they are about different things, or the " +
      "incoming record adds new information without denying anything the " +
      "accepted record says.",
  },
};

const SELF_EDIT_CRITERIA = {
  corrects_errors: {
    what:
      "Only fixes spelling, grammar, punctuation, or formatting mistakes; " +
      "every assertion stays exactly the same.",
  },
  rewords: {
    what:
      "Rephrases the same assertions in different words without fixing a " +
      "mistake and without adding, removing, or changing any fact.",
  },
  adds_information: {
    what: "Keeps every earlier assertion and adds new information.",
  },
  changes_meaning: {
    what:
      "Changes, removes, narrows, or reverses something the earlier version " +
      "asserted, such as a number, price, date, scope, audience, or a yes/no fact.",
  },
};

const renderRecord = ({ title, text }) =>
  title === undefined ? { text } : { title, text };

/** One request per write: one Choice per accepted candidate, plus one for a self-edit. */
export function requestBody(request, model) {
  const questions = {};
  for (const index of request.accepted.keys()) {
    questions[`accepted_${index}`] = {
      type: "choice",
      instructions:
        `Both records belong to one organization's knowledge base; ` +
        `\`incoming\` is a \`${request.entityKind}\` record. How does ` +
        `\`incoming\` relate to the accepted record ` +
        `\`accepted[${index}]\`? Judge only what they assert, not ` +
        `their tone or wording.`,
      criteria: RELATION_CRITERIA,
    };
  }
  if (request.prior !== undefined) {
    questions.prior = {
      type: "choice",
      instructions:
        "`incoming` is an edit of the record's own earlier accepted version " +
        "`prior`. What does the edit do to what the record asserts?",
      criteria: SELF_EDIT_CRITERIA,
    };
  }
  return {
    model,
    state: {
      incoming: renderRecord(request.incoming),
      ...(request.prior !== undefined && { prior: renderRecord(request.prior) }),
      accepted: request.accepted.map(renderRecord),
    },
    questions,
  };
}

const workersAi = (model) => ({
  model,
  needs: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
  url: (env) =>
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/cloudflare/${model}`,
  token: (env) => env.CLOUDFLARE_API_TOKEN,
  unwrap: (json) => json.result, // the REST envelope; the Workers binding returns the body bare
});

const typesafe = (model) => ({
  model,
  needs: ["TYPESAFE_API_KEY"],
  url: () => "https://api.typesafe.ai/v1/systemone",
  token: (env) => env.TYPESAFE_API_KEY,
  unwrap: (json) => json,
});

// A self-hosted Kev server (github.com/jaredpalmer/kev) serves one model, so
// the backend name is a label for whichever one KEV_URL points at.
const kev = () => ({
  model: "kev-latest",
  needs: ["KEV_URL"],
  url: (env) => `${env.KEV_URL.replace(/\/$/, "")}/v1/systemone`,
  token: (env) => env.KEV_API_KEY ?? "local",
  unwrap: (json) => json,
});

const BACKENDS = {
  jev: typesafe("jev-1.13.0"),
  "jev-preview": typesafe("jev-preview"),
  clef: workersAi("clef"),
  "clef-flash": workersAi("clef-flash"),
  "kev-4b": kev(),
  "kev-9b": kev(),
  "kev-27b": kev(),
};

/** The strongest evidence for each fact across every question, or undefined if any answer is missing. */
function evidenceFrom(request, answers) {
  const contradicts = [];
  const restates = [];
  for (const index of request.accepted.keys()) {
    const p = answers?.[`accepted_${index}`]?.probabilities;
    if (typeof p?.contradicts !== "number" || typeof p?.restates !== "number") {
      return undefined;
    }
    contradicts.push(p.contradicts);
    restates.push(p.restates);
  }
  if (request.prior !== undefined) {
    const p = answers?.prior?.probabilities;
    const complete = Object.keys(SELF_EDIT_CRITERIA).every(
      (label) => typeof p?.[label] === "number",
    );
    if (!complete) return undefined;
    contradicts.push(p.changes_meaning);
    restates.push(p.rewords);
  }
  return {
    contradicts: Math.max(0, ...contradicts),
    restates: Math.max(0, ...restates),
  };
}

function factOf(p, thresholds) {
  if (p >= thresholds.yesAtLeast) return "yes";
  if (p < thresholds.noBelow) return "no";
  return "unknown";
}

/** A write goes to human review unless both facts are a confident `no`. */
export function escalates(evidence, thresholds = THRESHOLDS) {
  if (evidence === undefined) return true;
  return (
    factOf(evidence.contradicts, thresholds) !== "no" ||
    factOf(evidence.restates, thresholds) !== "no"
  );
}

async function classify(backend, env, testCase) {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const response = await fetch(backend.url(env), {
      method: "POST",
      headers: {
        authorization: `Bearer ${backend.token(env)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody(testCase.request, backend.model)),
      signal: AbortSignal.timeout(EVAL_CALL_TIMEOUT_MS),
    });
    const text = await response.text();
    const latencyMs = elapsed();
    if (!response.ok) {
      return { latencyMs, error: `${response.status}: ${text.slice(0, 160)}` };
    }
    const body = backend.unwrap(JSON.parse(text));
    const evidence = evidenceFrom(testCase.request, body?.answers);
    return {
      latencyMs,
      evidence,
      inputTokens: body?.usage?.input_tokens ?? 0,
      // Kev reports its own model time; the others do not.
      ...(typeof body?.latency_ms === "number" && { modelMs: body.latency_ms }),
      ...(evidence === undefined && { error: "incomplete answer" }),
    };
  } catch (error) {
    return { latencyMs: elapsed(), error: String(error?.message ?? error) };
  }
}

async function mapLimit(items, limit, run) {
  const results = new Array(items.length);
  const next = { index: 0 };
  const worker = async () => {
    while (next.index < items.length) {
      const index = next.index++;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function percentile(values, p) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

function score(cases, results) {
  const rows = cases.map((testCase, index) => ({
    id: testCase.id,
    shouldEscalate: testCase.truth.contradicts || testCase.truth.restates,
    escalated: escalates(results[index].evidence),
    ...results[index],
  }));
  const mustEscalate = rows.filter((row) => row.shouldEscalate);
  const routine = rows.filter((row) => !row.shouldEscalate);
  const falseAdmits = mustEscalate.filter((row) => !row.escalated);
  const needlessReviews = routine.filter((row) => row.escalated);
  const latencies = rows.map((row) => row.latencyMs);
  const summary = {
    recall: 1 - falseAdmits.length / mustEscalate.length,
    routineAdmit: 1 - needlessReviews.length / routine.length,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    overTimeout: latencies.filter((ms) => ms > TIMEOUT_MS).length,
    transportFailures: rows.filter((row) => row.error !== undefined).length,
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
    falseAdmits: falseAdmits.map((row) => row.id),
    needlessReviews: needlessReviews.map((row) => row.id),
  };
  const pass =
    summary.recall >= GATES.minRecall &&
    summary.routineAdmit >= GATES.minRoutineAdmit &&
    summary.p95Ms <= GATES.maxP95Ms &&
    summary.transportFailures === 0;
  return { summary: { pass, ...summary }, rows };
}

async function main() {
  const { values } = parseArgs({
    options: {
      backends: { type: "string", default: "jev,clef,clef-flash" },
      passes: { type: "string", default: "3" },
      concurrency: { type: "string", default: "6" },
      order: { type: "string", default: "given" },
      out: { type: "string", default: "results" },
    },
  });
  if (!["given", "reversed"].includes(values.order)) {
    throw new Error(`unknown order '${values.order}'`);
  }
  const cases = JSON.parse(
    readFileSync(new URL("./cases.json", import.meta.url), "utf8"),
  ).map((testCase) =>
    values.order === "given" ? testCase : (
      {
        ...testCase,
        request: {
          ...testCase.request,
          accepted: testCase.request.accepted.toReversed(),
        },
      }
    ),
  );
  const names = values.backends.split(",");
  for (const name of names) {
    const backend = BACKENDS[name];
    if (backend === undefined) throw new Error(`unknown backend '${name}'`);
    const missing = backend.needs.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`${name} needs ${missing.join(" and ")}`);
    }
  }
  mkdirSync(values.out, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const report = [];
  // Passes interleave backends so each sees the same time of day.
  for (let pass = 1; pass <= Number(values.passes); pass++) {
    for (const name of names) {
      const results = await mapLimit(cases, Number(values.concurrency), (c) =>
        classify(BACKENDS[name], process.env, c),
      );
      const { summary, rows } = score(cases, results);
      report.push({ backend: name, model: BACKENDS[name].model, pass, summary, rows });
      console.log(
        [
          summary.pass ? "PASS" : "FAIL",
          name.padEnd(11),
          `pass ${pass}`,
          `recall=${summary.recall.toFixed(3)}`,
          `routineAdmit=${summary.routineAdmit.toFixed(3)}`,
          `p50=${summary.p50Ms}ms`,
          `p95=${summary.p95Ms}ms`,
          `over${TIMEOUT_MS}ms=${summary.overTimeout}`,
          `transportFailures=${summary.transportFailures}`,
          `falseAdmits=[${summary.falseAdmits.join(", ")}]`,
        ].join("  "),
      );
    }
  }
  const path = `${values.out}/${stamp}-${values.order}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      { ranAt: new Date().toISOString(), order: values.order, thresholds: THRESHOLDS, gates: GATES, report },
      undefined,
      2,
    ) + "\n",
  );
  console.log(`\nper-case probabilities and latencies → ${path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
