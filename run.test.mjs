import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classify, decisionsAnswers, decisionsRequestBody, escalates, requestBody } from "./run.mjs";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url)));
const validAnswers = (body) => body.questions.map((question) => ({
  name: question.name,
  type: "choice",
  probabilities: question.choices.map(({ value }, index) => ({
    value, probability: index === question.choices.length - 1 ? 1 : 0,
  })),
}));

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
