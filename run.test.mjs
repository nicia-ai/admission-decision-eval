import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BACKENDS, classify, decisionsAnswers, decisionsRequestBody, escalates, openrouterAnswers, requestBody, requestPacer } from "./run.mjs";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url)));
const validAnswers = (body) => body.questions.map((question) => ({
  name: question.name,
  type: "choice",
  probabilities: question.choices.map(({ value }, index) => ({
    value, probability: index === question.choices.length - 1 ? 1 : 0,
  })),
}));

const validOpenrouterAnswers = (request) => Object.fromEntries(
  validAnswers(decisionsRequestBody(request, "microsoft/microsoft-decision-1"))
    .map(({ name, type, probabilities }) => [name, {
      type,
      probabilities: Object.fromEntries(probabilities.map(({ value, probability }) => [value, probability])),
    }]),
);

test("OpenRouter preserves the shared request and maps all cases in both orders", () => {
  for (const { request } of cases) {
    for (const accepted of [request.accepted, request.accepted.toReversed()]) {
      const input = { ...request, accepted };
      const answers = validOpenrouterAnswers(input);
      assert.deepEqual(
        openrouterAnswers(input, Object.fromEntries(Object.entries(answers).reverse())),
        decisionsAnswers(input, validAnswers(decisionsRequestBody(input, ""))),
      );
    }
  }
});

test("merged OpenRouter backends share validation and preserve both Microsoft names", () => {
  const request = cases[0].request;
  const answers = validOpenrouterAnswers(request);
  for (const name of ["microsoft-decision-1", "decision-1", "pplx-decider", "pplx-decider-flash", "gemini-decision-1", "pplx-decider-v1.3", "pplx-decider-flash-v1.3", "pplx-decider-v1.2", "pplx-decider-flash-v1.2", "liquid-d1.2", "liquid-d1.2-ultra"]) {
    const backend = BACKENDS[name];
    assert.deepEqual(backend.unwrap({ answers }, request).answers, openrouterAnswers(request, answers));
    assert.equal(backend.unwrap({ answers: {} }, request).answers, undefined);
  }
  assert.equal(BACKENDS["microsoft-decision-1"].model, BACKENDS["decision-1"].model);
  assert.equal(BACKENDS["pplx-decider-v1.3"].model, "perplexity/pplx-decider-v1.3:free");
  assert.equal(BACKENDS["pplx-decider-flash-v1.3"].model, "perplexity/pplx-decider-flash-v1.3:free");
  assert.equal(BACKENDS["pplx-decider"].model, BACKENDS["pplx-decider-v1.3"].model);
  assert.equal(BACKENDS["pplx-decider-flash"].model, BACKENDS["pplx-decider-flash-v1.3"].model);
  assert.equal(BACKENDS["pplx-decider-v1.2"].model, "perplexity/pplx-decider-v1.2");
  assert.equal(BACKENDS["pplx-decider-flash-v1.2"].model, "perplexity/pplx-decider-flash-v1.2");
  assert.equal(BACKENDS["liquid-d1.2"].model, "liquid/d1.2");
  assert.equal(BACKENDS["liquid-d1.2-ultra"].model, "liquid/d1.2-ultra");
});

test("OpenRouter incomplete, refused and malformed distributions fail closed", () => {
  const request = cases[0].request;
  for (const mutate of [
    (a) => { delete a.accepted_0; },
    (a) => { a.unexpected = a.accepted_0; },
    (a) => { a.accepted_0.type = "refusal"; },
    (a) => { delete a.accepted_0.probabilities; },
    (a) => { a.accepted_0.probabilities = []; },
    (a) => { delete a.accepted_0.probabilities.compatible; },
    (a) => { a.accepted_0.probabilities.unknown = 0; },
    ...[NaN, Infinity, -0.1, 1.1, "0"].map((p) =>
      (a) => { a.accepted_0.probabilities.contradicts = p; }),
  ]) {
    const answers = validOpenrouterAnswers(request);
    mutate(answers);
    assert.equal(openrouterAnswers(request, answers), undefined);
  }
});

test("Decision 1 uses OpenRouter's endpoint, model and probabilities with the shared policy", async (t) => {
  const backend = BACKENDS["microsoft-decision-1"];
  const request = cases[0].request;
  let contradiction = 0.19;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(options.headers.authorization, "Bearer test-openrouter-key");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "microsoft/microsoft-decision-1");
    assert.deepEqual(body, requestBody(request, backend.model));
    const answers = validOpenrouterAnswers(request);
    answers.accepted_0.probabilities.contradicts = contradiction;
    answers.accepted_0.probabilities.compatible = 1 - contradiction;
    return new Response(JSON.stringify({ answers, model: body.model, provider: "Azure",
      usage: { input_tokens: 123, cost: 0.000005166 } }));
  });
  for (const probability of [0.19, 0.2, 0.5]) {
    contradiction = probability;
    const result = await classify(backend, { OPENROUTER_API_KEY: "test-openrouter-key" }, { request });
    assert.equal(result.error, undefined);
    assert.equal(escalates(result.evidence), probability >= 0.2);
    assert.equal(result.inputTokens, 123);
    assert.equal(result.responseModel, backend.model);
    assert.equal(result.provider, "Azure");
    assert.equal(result.costUsd, 0.000005166);
  }
});

test("all cases preserve evidence and criteria in both record orders", () => {
  for (const { request } of cases) {
    for (const accepted of [request.accepted, request.accepted.toReversed()]) {
      const input = { ...request, accepted };
      const original = requestBody(input, "gpt-6-luna");
      const body = decisionsRequestBody(input, "gpt-6-luna");
      assert.deepEqual(JSON.parse(body.input), original.state);
      assert.deepEqual(body.questions.map((q) => q.name), Object.keys(original.questions));
      for (const q of body.questions) {
        assert.equal(q.instructions, original.questions[q.name].instructions);
        assert.deepEqual(q.choices.map((c) => c.value), Object.keys(original.questions[q.name].criteria));
        for (const c of q.choices) {
          const criterion = original.questions[q.name].criteria[c.value];
          assert.ok(c.description.includes(criterion.what));
          if (criterion.not_for) assert.ok(c.description.includes(criterion.not_for));
          for (const example of criterion.examples ?? []) assert.ok(c.description.includes(example));
        }
      }
    }
  }
});

test("answers map by name and value, independent of response order", () => {
  const request = cases.find((c) => c.request.prior !== undefined).request;
  const answers = validAnswers(decisionsRequestBody(request, "gpt-6-luna")).toReversed();
  for (const a of answers) a.probabilities.reverse();
  const normalized = decisionsAnswers(request, answers);
  assert.equal(normalized.accepted_0.probabilities.compatible, 1);
  assert.equal(normalized.prior.probabilities.changes_meaning, 1);
});

test("incomplete, refused and malformed distributions fail closed", () => {
  const request = cases[0].request;
  const valid = validAnswers(decisionsRequestBody(request, "gpt-6-luna"));
  const mutations = [
    (a) => a.pop(),
    (a) => { a[0].type = "refusal"; },
    (a) => { a[0].name = "unexpected"; },
    (a) => { a[1].name = a[0].name; },
    (a) => { a[0].probabilities.pop(); },
    (a) => { a[0].probabilities[0].value = "unknown"; },
    (a) => { a[0].probabilities[1].value = a[0].probabilities[0].value; },
    ...[NaN, Infinity, -0.1, 1.1, "0"].map((p) =>
      (a) => { a[0].probabilities[0].probability = p; }),
  ];
  for (const mutate of mutations) {
    const answers = structuredClone(valid);
    mutate(answers);
    assert.equal(decisionsAnswers(request, answers), undefined);
    assert.equal(escalates(decisionsAnswers(request, answers)), true);
  }
});

test("HTTP classification uses the adapter and existing threshold policy", async (t) => {
  const request = cases[0].request;
  const backend = {
    model: "gpt-6-luna", url: () => "https://api.openai.com/v1/decisions",
    token: () => "test-key", requestBody: decisionsRequestBody,
    unwrap: (json, req) => ({ ...json, answers: decisionsAnswers(req, json.answers) }),
  };
  let probability = 0.19;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, backend.url());
    assert.equal(options.headers.authorization, "Bearer test-key");
    const body = JSON.parse(options.body);
    assert.deepEqual(body, decisionsRequestBody(request, backend.model));
    const answers = validAnswers(body);
    answers[0].probabilities[0].probability = probability;
    answers[0].probabilities.at(-1).probability = 1 - probability;
    return new Response(JSON.stringify({ answers, usage: { input_tokens: 123 } }));
  });
  let result = await classify(backend, {}, { request });
  assert.equal(result.inputTokens, 123);
  assert.equal(result.error, undefined);
  assert.equal(escalates(result.evidence), false);
  probability = 0.2;
  result = await classify(backend, {}, { request });
  assert.equal(escalates(result.evidence), true);
  probability = 0.5;
  result = await classify(backend, {}, { request });
  assert.equal(escalates(result.evidence), true);
});

test("Drex preserves every case and pins each active served model", async (t) => {
  const models = ["drex-v2.0", "drex-max-v1.1", "drex-max-finance"];
  let expected;
  let sent = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://console.nace.ai/v1/systemone");
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.authorization, "Bearer test-nace-key");
    const body = JSON.parse(options.body);
    assert.deepEqual(body, requestBody(expected.request, expected.model));
    sent++;
    return Response.json({ model: expected.model, answers: validOpenrouterAnswers(expected.request), usage: { input_tokens: 123 } });
  });
  for (const model of models) {
    const backend = BACKENDS[model];
    assert.equal(backend.model, model);
    assert.deepEqual(backend.needs, ["NACE_API_KEY"]);
    for (const { request } of cases) {
      for (const accepted of [request.accepted, request.accepted.toReversed()]) {
        expected = { model, request: { ...request, accepted } };
        const result = await classify(backend, { NACE_API_KEY: "test-nace-key" }, expected);
        assert.equal(result.error, undefined);
        assert.equal(result.responseModel, model);
        assert.equal(result.inputTokens, 123);
        assert.deepEqual(result.evidence, { contradicts: request.prior ? 1 : 0, restates: 0 });
      }
    }
  }
  assert.equal(sent, models.length * cases.length * 2);
});

test("Drex rejects forwards, missing identities, malformed answers and HTTP redirects", async (t) => {
  const request = cases[0].request;
  const backend = BACKENDS["drex-max-v1.1"];
  let body = { model: backend.model, answers: validOpenrouterAnswers(request) };
  let status = 200;
  t.mock.method(globalThis, "fetch", async () => Response.json(body, { status }));
  for (const model of [undefined, "drex-latest", "drex-max", "drex-max-finance"]) {
    body = { model, answers: validOpenrouterAnswers(request) };
    const result = await classify(backend, { NACE_API_KEY: "test" }, { request });
    assert.equal(result.error, "expected served model drex-max-v1.1");
    assert.equal(escalates(result.evidence), true);
  }
  for (const mutate of [
    (a) => { delete a.accepted_0; },
    (a) => { a.unexpected = a.accepted_0; },
    (a) => { a.accepted_0.type = "refusal"; },
    (a) => { a.accepted_0.probabilities.contradicts = -0.1; },
  ]) {
    body = { model: backend.model, answers: validOpenrouterAnswers(request) };
    mutate(body.answers);
    const result = await classify(backend, { NACE_API_KEY: "test" }, { request });
    assert.equal(result.error, "incomplete answer");
    assert.equal(escalates(result.evidence), true);
  }
  status = 302;
  const result = await classify(backend, { NACE_API_KEY: "test" }, { request });
  assert.match(result.error, /^302:/);
  assert.equal(escalates(result.evidence), true);
});

test("rate pacing preserves concurrent bursts and honors shared server cooldowns", async () => {
  let clock = 0;
  const waits = [];
  const pacer = requestPacer(100, 6, { now: () => clock, wait: async (ms) => { waits.push(ms); clock += ms; } });
  const starts = [];
  for (let i = 0; i < 13; i++) { await pacer.wait(); starts.push(clock); }
  assert.deepEqual(starts, [...Array(6).fill(0), ...Array(6).fill(3600), 7200]);
  pacer.defer(10_000);
  await pacer.wait();
  assert.equal(clock, 17200);
  assert.deepEqual(waits, [3600, 3600, 10_000]);
  for (const [rpm, burst] of [[-1, 6], [NaN, 6], [100, 0], [100, 1.5]]) {
    assert.throws(() => requestPacer(rpm, burst));
  }
});

test("429s retain retry guidance without retrying or inflating response latency", async (t) => {
  let sends = 0;
  let headers = { "retry-after-ms": "1500" };
  t.mock.method(globalThis, "fetch", async () => { sends++; return new Response("limited", { status: 429, headers }); });
  for (const [input, expected] of [[{ "retry-after-ms": "1500" }, 1500], [{ "retry-after": "2" }, 2000]]) {
    headers = input;
    const result = await classify(BACKENDS["drex-v2.0"], { NACE_API_KEY: "test" }, cases[0]);
    assert.equal(result.retryAfterMs, expected);
    assert.match(result.error, /^429:/);
    assert.equal(escalates(result.evidence), true);
    assert.ok(result.latencyMs < 1000);
  }
  assert.equal(sends, 2);
});
