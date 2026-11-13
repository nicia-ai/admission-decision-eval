# admission-decision-eval

A reproducible comparison of decision models on one production task: deciding whether an AI agent's write to a knowledge base can be admitted automatically or needs human review. One script, no dependencies, 85 labeled synthetic cases.

## Current status — 2026-11-13

**Perplexity Decider v1.3 is the strongest hosted result in the latest comparison: all 85 decisions correct in both record orders, every pass correct, and all seven passes meeting every gate. Flash v1.3 catches every review-required write and improves routine admission over v1.2, with one order-sensitive decision. Both new endpoints report zero cost and zero failed calls.** Jev, Clef, and Microsoft Decision 1 also meet every gate in their November 11 runs, although each admits some writes that require review.

The two v1.3 models were evaluated on November 13 with **1,190 scored calls**. The other nine rows retain their November 11 measurements (5,355 calls); those models were not re-run on November 13. Cases, prompts, criteria and thresholds are unchanged. One backend was active at a time, with backends interleaved within each pass. Calls used the cloud executor's HTTPS proxy; its region was not recorded. Kev has no configured server here, and its October 1 results remain in the [run history](#run-history).

### Decision quality

Gates: recall ≥ 0.95, routine admit ≥ 0.85, p95 ≤ 2500 ms, and no failed calls. Per backend: three original-order and two reversed-order passes at six requests in flight, then two original-order passes one request at a time (595 calls).

Recall is the fraction of review-required writes sent to review (56 per pass). Routine admit is the fraction of harmless writes admitted (29 per pass). Quality columns use the first failure-free concurrent pass per order: pass 1 except for Flash v1.2 reversed, which uses pass 2. The order-change count compares those selected passes. Gate totals include every pass and failure; failed calls go to review. No failed call was retried or removed. Passing the recall gate does not imply every decision was correct.

| model (last evaluated) | recall (original / reversed) | routine admit (original / reversed) | decisions changed by order | passes meeting every gate |
| --- | --- | --- | --- | --- |
| Pplx Decider v1.3 (free) (Nov 13) | 1.000 / 1.000 | 1.000 / 1.000 | 0 | 7 of 7 |
| Pplx Decider Flash v1.3 (free) (Nov 13) | 1.000 / 1.000 | 0.966 / 0.931 | 1 | 7 of 7 |
| Jev 1.14.0 (Nov 11) | 0.982 / 0.982 | 1.000 / 1.000 | 0 | 7 of 7 |
| Clef (Nov 11) | 0.964 / 1.000 | 1.000 / 0.931 | 4 | 7 of 7 |
| Clef-flash (Nov 11) | 0.964 / 0.982 | 0.655 / 0.621 | 6 | 0 of 7 |
| Clef-omni (Nov 11) | 0.946 / 0.946 | 0.621 / 0.655 | 1 | 0 of 7 |
| Microsoft Decision 1 (OpenRouter) (Nov 11) | 1.000 / 0.982 | 1.000 / 0.966 | 2 | 7 of 7 |
| Pplx Decider v1.2 (OpenRouter) (Nov 11) | 1.000 / 1.000 | 1.000 / 1.000 | 0 | 5 of 7 |
| Pplx Decider Flash v1.2 (OpenRouter) (Nov 11) | 1.000 / 1.000 | 0.897 / 0.897 | 0 | 4 of 7 |
| GPT-6 Luna (OpenAI Decisions) (Nov 11) | 1.000 / 0.946 | 0.828 / 0.828 | 9 | 0 of 7 |
| Gemini Decision 1 (OpenRouter) (Nov 11) | 1.000 / 0.982 | 0.897 / 0.828 | 3 | 5 of 7 |

### Perplexity v1.3 compared with v1.2

Decider v1.3 gets every decision right in all seven passes (595/595), including all three classifier-steering cases in every pass. Its decisions are unchanged by reversing the accepted records, although its evidence moves by up to 0.3326. Same-order evidence varies by at most 0.00000264 across the concurrent and sequential runs. Decider v1.2 also got every decision right in its November 11 clean quality passes, but had five HTTP 429 failures; v1.3 had none in this run.

Flash v1.3 admits 28/29 routine writes in the original order and 27/29 reversed, versus Flash v1.2's 26/29 in both orders on November 11. It catches all 56 review-required writes in every pass. `crm-account-notes/self-corrects-errors` still goes to needless review in both orders; reversing also sends `saas-support-kb/hard-compatible-sibling` to review. That sibling case's contradiction evidence moves from 0.0995 to 0.7652, giving the largest evidence shift of 0.6657 and one changed decision. Same-order evidence varies by up to 0.01145 across repeats without changing a decision. All classifier-steering cases go to review.

This is an across-date comparison with the saved v1.2 results. The [release announcement](https://www.perplexity.ai/hub/blog/perplexity-decider) describes isolated-question attention and stability tests that reorder or rename answer labels. Our test reverses accepted records in shared state, which is a different perturbation. This evaluation covers text admission decisions; it does not assess vision or the new `locate` extraction feature.

### Served latency and reliability

Ranges cover each backend's latest seven passes, including failures. These are caller-observed round trips, not isolated model inference time. Evaluation dates differ, so these rows are not a controlled same-day speed comparison; provider routing, queueing and network paths also differ.

| model (last evaluated) | one request at a time: p50 / p95 (ms) | six in flight: p50 / p95 (ms) | calls over 2.5 s / 595 | failed calls / 595 |
| --- | --- | --- | --- | --- |
| Pplx Decider v1.3 (free) (Nov 13) | 306–307 / 854–859 | 311–322 / 619–1069 | 0 | 0 |
| Pplx Decider Flash v1.3 (free) (Nov 13) | 134–136 / 178–197 | 134–152 / 191–323 | 0 | 0 |
| Jev 1.14.0 (Nov 11) | 97–100 / 126–144 | 101–110 / 142–225 | 0 | 0 |
| Clef (Nov 11) | 342–383 / 586–879 | 363–403 / 537–671 | 0 | 0 |
| Clef-flash (Nov 11) | 170–197 / 334–536 | 211–255 / 391–645 | 0 | 0 |
| Clef-omni (Nov 11) | 139–151 / 182–196 | 169–179 / 257–1414 | 3 | 0 |
| Microsoft Decision 1 (OpenRouter) (Nov 11) | 307–319 / 397–497 | 301–313 / 387–569 | 0 | 0 |
| Pplx Decider v1.2 (OpenRouter) (Nov 11) | 271–282 / 492–698 | 277–302 / 479–700 | 0 | 5 |
| Pplx Decider Flash v1.2 (OpenRouter) (Nov 11) | 169–177 / 209–218 | 173–185 / 208–239 | 0 | 5 |
| GPT-6 Luna (OpenAI Decisions) (Nov 11) | 202–216 / 446–518 | 208–227 / 414–1294 | 0 | 0 |
| Gemini Decision 1 (OpenRouter) (Nov 11) | 289–329 / 385–450 | 295–329 / 367–499 | 1 | 0 |

Both v1.3 endpoints have **zero failed calls and zero calls over 2.5 seconds across 1,190 calls**. The November 11 results retain their ten HTTP 429 failures (five per v1.2 Perplexity endpoint) and four calls over 2.5 seconds. These counts describe access under the tested account and load, not just model inference. No live retry or failure was removed from the reports.

### Reported model identities and cost

The new rows resolve to `perplexity/pplx-decider-v1.3-20261112` and `perplexity/pplx-decider-flash-v1.3-20261112`, both served by Perplexity. Each reports 147,190 input tokens per complete pass and zero cost on all 595 calls. OpenRouter lists zero prompt and completion prices for the explicit `:free` IDs in the [November 13 catalog snapshot](results/perplexity-v1.3-2026-11-13-catalog.json); this records the offer at evaluation time.

| backend with reported cost | calls reporting cost / 595 | sum of reported cost (USD) |
| --- | --- | --- |
| Pplx Decider v1.3 (Nov 13) | 595 | $0.000000 |
| Pplx Decider Flash v1.3 (Nov 13) | 595 | $0.000000 |
| Microsoft Decision 1 (OpenRouter) | 595 | $0.039881 |
| Pplx Decider v1.2 (OpenRouter) | 590 | $0.020839 |
| Pplx Decider Flash v1.2 (OpenRouter) | 590 | $0.010427 |
| Gemini Decision 1 (OpenRouter) | 595 | $0.107682 |

The other cost rows retain November 11 values. These are sums returned on successful OpenRouter calls, not an invoice or a total for all providers. Other backends and failed calls do not return a cost field.

Raw v1.3 results: [original order](results/perplexity-v1.3-2026-11-13-hosted/2026-11-13T19-02-40-given.json), [reversed order](results/perplexity-v1.3-2026-11-13-reversed/2026-11-13T19-03-03-reversed.json), [sequential](results/perplexity-v1.3-2026-11-13-sequential/2026-11-13T19-03-21-given.json). [Derived v1.3 comparison](results/perplexity-v1.3-2026-11-13-comparison.json).

November 11 results: [original order](results/rerun-2026-11-11-hosted/2026-11-11T22-59-05-given.json), [reversed order](results/rerun-2026-11-11-reversed/2026-11-11T23-01-15-reversed.json), [sequential](results/rerun-2026-11-11-sequential/2026-11-11T23-02-23-given.json). [Derived comparison and drift details](results/rerun-2026-11-11-comparison.json).

## Limits of this evaluation

- This is one text-only task with 85 synthetic cases. One missed review-required write moves recall by about 0.018. Results do not establish general decision or multimodal performance.
- The prompts and 0.5 / 0.2 thresholds were tuned on Jev; other backends use them without model-specific tuning.
- The evidence is a maximum across per-record probabilities. It is not a calibrated probability of the final admission decision; this eval does not establish probability calibration.
- Dates, provider serving conditions and caller locations differ across runs. Latest measured results are snapshots, not guarantees of current endpoint behavior.

## The task

At [Nicia](https://nicia.ai), agents write into a shared knowledge base. Most writes are routine and should land. A write that contradicts something already accepted, or that only restates it, should go to a person first.

Each write becomes one request to a decision model:

- **State:** the incoming record, the accepted records it could collide with (5 to 9 here), and, for an edit, the record's own prior version.
- **Questions:** one `choice` per accepted record (`contradicts` / `restates` / `compatible`), plus one about the edit (`corrects_errors` / `rewords` / `adds_information` / `changes_meaning`).

The decision takes the strongest evidence across all the answers. A probability of 0.5 or more is a yes, under 0.2 is a no, and anything between is treated as "unsure" and sent to review. The write is admitted only when both facts are a confident no.

The cases are synthetic: six fictional organizations (a support knowledge base, an HR handbook, an engineering runbook, CRM notes, clinic procedures, a marketing brain), covering plain and hard contradictions, paraphrases, compatible look-alikes, four kinds of self-edit, and three writes that try to instruct the classifier. `cases.json` holds every request and its label.

## Run it

Node 20 or newer.

```sh
export TYPESAFE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...   # Workers AI permission

node run.mjs                                  # jev, clef, clef-flash; 3 passes, 6 in flight
node run.mjs --backends clef --passes 1
node run.mjs --backends clef-omni --passes 1
node run.mjs --order reversed
node run.mjs --concurrency 1                  # one request at a time
```

For [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions), configure an API key and select the backend explicitly:

```sh
export OPENAI_API_KEY=...
node run.mjs --backends openai-decisions --passes 3
node run.mjs --backends openai-decisions --passes 2 --order reversed
node run.mjs --backends openai-decisions --passes 2 --concurrency 1
```

The backend calls `POST /v1/decisions` with `gpt-6-luna`. It serializes the shared state as JSON text in `input`, translates each named question's criteria into choice values and descriptions, and maps the returned probability distributions back to the existing evidence calculation. It uses the same thresholds and gates as the other backends. Missing, refused, or malformed answers count as failed calls and go to review.

At the October 6 evaluation, the published OpenAI Decisions rate was $0.10 per million input tokens, with regional and long-context premiums where applicable. Latest results are in the current-status tables above; the October 6 run is retained in the history below. In a Node 24 environment that requires an HTTP proxy, prefix the commands with `NODE_USE_ENV_PROXY=1`.

Run the adapter checks without API credentials with `npm test`.

For OpenRouter Decisions, configure an API key and select the backends explicitly:

```sh
export OPENROUTER_API_KEY=...
node run.mjs --backends gemini-decision-1,decision-1,pplx-decider,pplx-decider-flash --passes 3
node run.mjs --backends gemini-decision-1,decision-1,pplx-decider,pplx-decider-flash --passes 2 --order reversed
node run.mjs --backends gemini-decision-1,decision-1,pplx-decider,pplx-decider-flash --passes 2 --concurrency 1
```

These backends call `POST /api/alpha/decisions` with the existing System One request and response format. `gemini-decision-1` selects `google/gemini-decision-1`; `decision-1` and its compatibility alias `microsoft-decision-1` select `microsoft/microsoft-decision-1`; `pplx-decider` and `pplx-decider-flash` select Perplexity's `v1.2` models. The `jev` backend now selects `jev-1.14.0`. All OpenRouter backends validate each choice distribution; missing, refused or malformed answers fail closed to review. Result rows retain the returned model, provider and cost when available, and new reports record concurrency. Historical results retain their original model versions. In a Node 24 environment that requires an HTTP proxy, prefix these commands with `NODE_USE_ENV_PROXY=1`.

For the free v1.3 endpoints, configure `OPENROUTER_API_KEY` and run:

```sh
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 3
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 2 --order reversed
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 2 --concurrency 1
```

`pplx-decider-v1.3` selects `perplexity/pplx-decider-v1.3:free`; `pplx-decider-flash-v1.3` selects `perplexity/pplx-decider-flash-v1.3:free`. The existing `pplx-decider` and `pplx-decider-flash` names stay pinned to v1.2 for reproducibility. All four use the same state, questions and answer validation.

For Kev, start a server pinned to the release, locally (`python -m kev.serve --run jaredpalmer/kev-27b@v1.0`, see [Run It Locally](https://github.com/jaredpalmer/kev#run-it-locally)) or [on Modal](https://github.com/jaredpalmer/kev#deploy-your-own-endpoint) (`KEV_MODEL=jaredpalmer/kev-27b@v1.0`), and point the script at it. A Kev server serves one model, so the backend name is a label for whichever one is running.

```sh
export KEV_URL=http://127.0.0.1:8009          # or your Modal URL
export KEV_API_KEY=...                        # only if the server requires one
node run.mjs --backends kev-27b
```

Each run prints one line per backend per pass and writes every case's evidence probabilities, decision and latency to `results/`. The runs behind the tables above are in `results/`: `hosted-*` (Jev, Clef, Clef-flash at six in flight), `kev-*` (each Kev model), `sequential-given` (all four served models, one request at a time), `rerun-2026-10-04-*` (the hosted models, three days later), `openai-decisions-2026-10-06-*` (GPT-6 Luna), `rerun-2026-10-12-clef-*` (updated Clef), `rerun-2026-10-31-*` (eight hosted backends), `gemini-decision-1-2026-11-11-*` (Gemini, including separately labeled exploratory runs), and `perplexity-v1.3-2026-11-13-*` (the two free v1.3 endpoints).

The historical three-pass Jev, Clef and Clef-flash run cost under $0.25 at the rates recorded below.

## Run history

The dated sections below describe their own runs. Their rankings, prices, endpoint behavior and launch claims are historical observations; use the current-status tables above for the latest measured comparison.

### Perplexity Decider and Flash v1.3, 2026-11-13

Evaluated the two explicit free OpenRouter endpoints with the unchanged 85 cases, prompts, criteria, thresholds and gates. Three original-order and two reversed-order passes at six in flight were followed by two original-order sequential passes: 595 calls per backend, 1,190 total. All fourteen passes meet every gate, with no failed calls or calls over 2.5 seconds. All 1,190 calls report zero cost.

| model | recall (original / reversed) | routine admit (original / reversed) | decisions changed by order | gates |
| --- | --- | --- | --- | --- |
| Decider v1.3 | 1.000 / 1.000 | 1.000 / 1.000 | 0 | 7 of 7 |
| Decider Flash v1.3 | 1.000 / 1.000 | 0.966 / 0.931 | 1 | 7 of 7 |

Decider's concurrent p50 is 311–322 ms and p95 is 619–1069 ms; sequential p50 is 306–307 ms and p95 is 854–859 ms. Flash's concurrent p50 is 134–152 ms and p95 is 191–323 ms; sequential p50 is 134–136 ms and p95 is 178–197 ms. The cloud executor used its HTTPS proxy; region was not recorded. Earlier model measurements are from different dates.

Decider gets every decision right in every pass. Flash needlessly reviews the CRM typo fix in both orders and the support-KB sibling record reversed. Repeated same-order evidence varies slightly, but decisions are identical within each order. All three classifier-steering cases go to review in every pass. Maximum order-induced evidence shifts are 0.3326 (Decider) and 0.6657 (Flash).

Raw v1.3 results: [original order](results/perplexity-v1.3-2026-11-13-hosted/2026-11-13T19-02-40-given.json), [reversed order](results/perplexity-v1.3-2026-11-13-reversed/2026-11-13T19-03-03-reversed.json), [sequential](results/perplexity-v1.3-2026-11-13-sequential/2026-11-13T19-03-21-given.json). [Derived v1.3 comparison](results/perplexity-v1.3-2026-11-13-comparison.json).

[Catalog and price snapshot](results/perplexity-v1.3-2026-11-13-catalog.json). The returned model IDs end in `v1.3-20261112`; both report 147,190 input tokens per pass. The text-only task does not evaluate vision or locate.

Reproduce with `OPENROUTER_API_KEY` configured, running commands sequentially:

```sh
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 3
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 2 --order reversed
NODE_USE_ENV_PROXY=1 node run.mjs --backends pplx-decider-v1.3,pplx-decider-flash-v1.3 --passes 2 --concurrency 1
```

### Full hosted re-run, 2026-11-11

Re-ran nine unique hosted backends with the unchanged 85-case admission protocol: three original-order and two reversed-order passes at six in flight, followed by two original-order passes one request at a time. There are 595 scored calls per backend, 5,355 in total. Commands were run sequentially, with one backend active at a time. The cloud executor's region was not recorded. Kev was unavailable because no server was configured; `jev-preview` is an optional backend outside the nine-model published comparison and was not included.

Raw per-case results: [original order](results/rerun-2026-11-11-hosted/2026-11-11T22-59-05-given.json), [reversed order](results/rerun-2026-11-11-reversed/2026-11-11T23-01-15-reversed.json), [sequential](results/rerun-2026-11-11-sequential/2026-11-11T23-02-23-given.json). [Derived comparison and drift details](results/rerun-2026-11-11-comparison.json).

Compared with October 31, Clef-flash's evidence changes on every case in both orders. Perplexity Flash also changes probabilities and reported token counts. Clef, Clef-omni and GPT-6 Luna match their previous stored evidence, and Gemini matches its earlier launch run. Jev, Microsoft Decision 1 and Perplexity Decider vary across identical calls, limiting what a two-snapshot difference establishes. Full quality, latency, drift and reliability figures are in the current-status section above; the raw reports preserve every failed call.

Reproduce with all provider credentials configured, running each command sequentially:

```sh
EVAL_BACKENDS=jev,clef,clef-flash,clef-omni,decision-1,pplx-decider,pplx-decider-flash,openai-decisions,gemini-decision-1
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 3
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 2 --order reversed
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 2 --concurrency 1
```

#### Behavior changes observed November 11

The baseline is October 31 for eight backends and the earlier November 11 Gemini launch run. Each comparison uses the first failure-free concurrent pass for the same backend and record order on each date; all 85 cases are paired successfully in each comparison. Evidence means the stored maxima for contradiction and restatement, not the full per-question distributions. Changes smaller than or equal to 0.000001 are excluded from the evidence-change counts to avoid emphasizing floating-point noise.

| model | cases with evidence change > 0.000001 (original / reversed) | decisions changed vs baseline (original / reversed) | largest evidence shift |
| --- | --- | --- | --- |
| Jev 1.14.0 | 37 / 39 | 0 / 0 | 0.2900 |
| Clef | 0 / 0 | 0 / 0 | 0.0000 |
| Clef-flash | 85 / 85 | 2 / 4 | 0.2475 |
| Clef-omni | 0 / 0 | 0 / 0 | 0.0000 |
| Microsoft Decision 1 (OpenRouter) | 76 / 74 | 0 / 0 | 0.1159 |
| Pplx Decider v1.2 (OpenRouter) | 76 / 82 | 0 / 0 | 0.0766 |
| Pplx Decider Flash v1.2 (OpenRouter) | 76 / 84 | 0 / 0 | 0.1185 |
| GPT-6 Luna (OpenAI Decisions) | 0 / 0 | 0 / 0 | 0.0000 |
| Gemini Decision 1 (OpenRouter) | 0 / 0 | 0 / 0 | 0.0000 |

**Clef-flash shows a reproducible behavior change under the same model name.** Its evidence changes on all 85 cases in both orders, and new repeated passes return identical evidence. Original-order routine admission falls from 21/29 to 19/29: `saas-support-kb/hard-compatible-sibling` and `crm-account-notes/self-adds-information` now go to needless review. Reversed-order recall falls from 56/56 to 55/56, while routine admission rises from 17/29 to 18/29. It now misses `saas-support-kb/hard-contradicts-buried` reversed. These observations establish changed endpoint behavior, not the cause or an announced weight update.

**Perplexity Flash changes probabilities and token accounting without changing selected quality decisions.** Its input tokens for the failure-free original-order pass fall from 297,762 to 150,139 for the same request bodies. Its new repeated successful answers have identical stored evidence. Perplexity Decider and Microsoft Decision 1 also change probabilities without changing decisions in the selected baseline comparisons; both vary across identical repeats today. Jev varies in both the previous and current runs, so a difference between two selected passes cannot establish a model update.

**Clef, Clef-omni, GPT-6 Luna and Gemini return identical stored evidence to their baselines in both record orders.** This applies to these text-only cases and recorded evidence; it does not prove the endpoints or model weights were unchanged.

### Gemini Decision 1 launch run, 2026-11-11

**Gemini meets the existing gates in the original order and fails the routine-admission gate when records are reversed.** We evaluated `google/gemini-decision-1` through OpenRouter's Decisions API with the same 85 cases, question criteria and thresholds, without model-specific tuning. There are three original-order and two reversed-order passes at six requests in flight, followed by two original-order passes one request at a time: 595 scored calls. The resolved model in a separate API probe was `google/gemini-decision-1-20261111`, served by Google AI Studio.

| order | recall | routine admit | false admits / needless reviews | gates |
| --- | --- | --- | --- | --- |
| Original | 1.000 (56/56) | 0.897 (26/29) | 0 / 3 | PASS in all five passes, including sequential |
| Reversed | 0.982 (55/56) | 0.828 (24/29) | 1 / 5 | FAIL in both passes: routine admit below 0.85 |

Three of 85 decisions change with record order. Reversing admits `hr-handbook/hard-restates-combined`, an incoming record that combines existing PTO and introductory-period facts. Its restatement evidence falls from 0.2022, barely above the 0.2 review cut-off, to 0.0664. Reversing also sends two harmless typo fixes (`eng-runbook/self-corrects-errors` and `crm-account-notes/self-corrects-errors`) to review. The three original-order needless reviews are `eng-runbook/hard-compatible-sibling`, `clinic-procedures/compatible-overlap`, and `t0/routine-typo-fix`.

The largest evidence shift under reversal is 0.3217. In the first pass, 3 original-order cases and 6 reversed-order cases have evidence in the unsure band. Repeated passes in the same order return identical stored evidence and decisions; this observation does not establish a determinism guarantee. All three classifier-steering cases go to review in both orders.

| setting | p50 across passes | p95 across passes | calls over 2.5 s | failed calls |
| --- | --- | --- | --- | --- |
| Six in flight, both orders | 286–335 ms | 388–520 ms | 0 of 425 | 0 of 425 |
| One request at a time, original order | 303–307 ms | 411–463 ms | 0 of 170 | 0 of 170 |

The API reports 153,832 input tokens per pass. A separate probe reports zero output tokens and a cost equivalent to $0.10 per million input tokens; see the [probe response](results/gemini-decision-1-2026-11-11-model.json). Applying that rate gives approximately $0.0154 per 85-case pass and $0.1077 for the 595 scored calls, excluding exploratory and probe calls. This is a token-based estimate, not an invoice.

These results support further testing, but do not support replacing the current admission gate without addressing record-order sensitivity and unnecessary reviews. The October 31 Pplx Decider clean passes were perfect in both orders, and Jev 1.14.0 admitted every routine write; those are historical comparisons, not same-day measurements. This eval covers one text-only task with 85 synthetic cases, and thresholds originally tuned on Jev. It does not establish general multimodal performance or probability calibration: the stored evidence is a maximum across questions, not a calibrated probability of the final admission decision.

Raw per-case results: [original order](results/gemini-decision-1-2026-11-11-hosted/2026-11-11T21-32-12-given.json), [reversed order](results/gemini-decision-1-2026-11-11-reversed/2026-11-11T21-32-27-reversed.json), [sequential](results/gemini-decision-1-2026-11-11-sequential/2026-11-11T21-32-37-given.json).

Reproduce with `OPENROUTER_API_KEY` configured, running the commands sequentially:

```sh
NODE_USE_ENV_PROXY=1 node run.mjs --backends gemini-decision-1 --passes 3
NODE_USE_ENV_PROXY=1 node run.mjs --backends gemini-decision-1 --passes 2 --order reversed
NODE_USE_ENV_PROXY=1 node run.mjs --backends gemini-decision-1 --passes 2 --concurrency 1
```

The `gemini-decision-1-2026-11-11-exploratory/` directory retains two preliminary runs that overlapped in time. They are excluded from every table and scored-call total in this section. The seven reported passes were run sequentially, with one backend active at a time. Calls ran from a cloud executor through its HTTPS proxy; region was not recorded. Latency is caller-observed round-trip time, not isolated model inference time.

### Expanded hosted re-run, 2026-10-31

We ran eight hosted backends on the same 85 cases, questions, thresholds and gates: three original-order passes and two reversed at six requests in flight, then two original-order passes one request at a time. This is 595 scored calls per backend and 4,760 in total. Calls ran from a cloud executor through its HTTPS proxy; its region was not recorded. Kev and Jev-preview were not re-run. Latency comparisons with the earlier laptop runs are not controlled comparisons.

The quality columns below use the first pass without failed calls in each order, at six in flight. This is pass 1 except for the two Perplexity models' reversed order, which uses pass 2. The gate column includes all seven passes, including failed calls and sequential runs. No failed call was retried or removed from the raw reports. Failed calls go to review and can affect recall and routine-admit figures in those reports.

| model | recall (original / reversed) | routine admit (original / reversed) | decisions changed by order | passes meeting every gate |
| --- | --- | --- | --- | --- |
| Jev 1.14.0 | 0.982 / 0.982 | 1.000 / 1.000 | 0 | 6 of 7 |
| Clef | 0.964 / 1.000 | 1.000 / 0.931 | 4 | 7 of 7 |
| Clef-flash | 0.964 / 1.000 | 0.724 / 0.586 | 6 | 0 of 7 |
| Clef-omni | 0.946 / 0.946 | 0.621 / 0.655 | 1 | 0 of 7 |
| Decision-1 (OpenRouter) | 1.000 / 0.982 | 1.000 / 0.966 | 2 | 5 of 7 |
| Pplx Decider v1.2 (OpenRouter) | 1.000 / 1.000 | 1.000 / 1.000 | 0 | 5 of 7 |
| Pplx Decider Flash v1.2 (OpenRouter) | 1.000 / 1.000 | 0.897 / 0.897 | 0 | 5 of 7 |
| GPT-6 Luna (OpenAI Decisions) | 1.000 / 0.946 | 0.828 / 0.828 | 9 | 0 of 7 |

**Pplx Decider gets all 85 decisions right in both orders in its clean passes.** Pplx Decider Flash also catches every write requiring review in both orders, with three needless reviews per clean pass. Decision-1 is perfect in the three original-order concurrent passes; reversing the records admits `crm-account-notes/hard-restates-combined` and needlessly reviews `saas-support-kb/hard-compatible-sibling`. Clef-omni misses three writes requiring review in either order and admits only 18–19 of the 29 routine writes.

**Clef is the only backend to meet every gate in all seven passes.** Jev 1.14.0 admits `t0/redundant-rephrase-brand-voice` in every pass, giving it recall of 55/56, and one authentication failure makes its third original-order pass fail the gates. Passing the configured recall gate does not imply every decision was correct.

Latency ranges below include every scored call, including failures, across the two sequential passes or five concurrent passes. The last two columns cover all seven passes.

| model | one request at a time: p50 / p95 (ms) | six in flight: p50 / p95 (ms) | calls over 2.5 s / 595 | failed calls / 595 |
| --- | --- | --- | --- | --- |
| Jev 1.14.0 | 136–142 / 391–447 | 120–177 / 242–580 | 0 | 1 |
| Clef | 404–439 / 859–915 | 395–435 / 615–781 | 0 | 0 |
| Clef-flash | 474–487 / 636–1080 | 485–501 / 619–740 | 1 | 2 |
| Clef-omni | 159–166 / 182–353 | 170–198 / 250–457 | 0 | 0 |
| Decision-1 (OpenRouter) | 372–443 / 831–2760 | 356–417 / 489–601 | 7 | 6 |
| Pplx Decider v1.2 (OpenRouter) | 342–580 / 852–1703 | 343–604 / 453–8903 | 19 | 13 |
| Pplx Decider Flash v1.2 (OpenRouter) | 297–332 / 371–849 | 307–410 / 374–2184 | 4 | 5 |
| GPT-6 Luna (OpenAI Decisions) | 221–229 / 404–757 | 216–629 / 381–3975 | 6 | 6 |

There were 33 HTTP 401 responses: one from Jev, two from Clef-flash, six from Decision-1, thirteen from Pplx Decider, five from Pplx Decider Flash, and six from OpenAI Decisions. The OpenRouter responses said "Missing Authentication header"; the other providers reported authentication errors. A runtime readiness check still reported all configured credentials ready. These runs do not establish the cause of the intermittent errors. They remain in the latency and gate totals; Pplx Decider's first reversed pass has a p95 of 8,903 ms, and Decision-1's first sequential pass has a p95 of 2,760 ms.

Raw per-case results: [original order](results/rerun-2026-10-31-hosted-given.json), [reversed order](results/rerun-2026-10-31-hosted-reversed.json), and [sequential](results/rerun-2026-10-31-sequential-given.json).

Reproduce the settings with the configured provider credentials:

```sh
EVAL_BACKENDS=jev,clef,clef-flash,clef-omni,decision-1,pplx-decider,pplx-decider-flash,openai-decisions
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 3
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 2 --order reversed
NODE_USE_ENV_PROXY=1 node run.mjs --backends "$EVAL_BACKENDS" --passes 2 --concurrency 1
```

### Clef re-run, 2026-10-12

After Cloudflare reported another update, we re-ran the public `@cf/cloudflare/clef` endpoint with the same 85 cases, criteria, thresholds and gates: three original-order passes and two reversed at six in flight, then two original-order passes one request at a time. The calls ran from the cloud executor through its HTTPS proxy. Clef-flash was not re-run.

**Clef's evidence changed on all 85 cases compared with October 4.** Original-order recall is now 54/56 (0.964), with false admits on `hr-handbook/contradicts-negation` and `clinic-procedures/hard-contradicts-buried`. Reversed recall is 56/56 (1.000). Routine admission is 29/29 (1.000) original and 27/29 (0.931) reversed; the two needless reviews reversed are `saas-support-kb/hard-compatible-sibling` and `crm-account-notes/self-corrects-errors`. All seven passes meet the gates, despite the two original-order false admits.

Four of 85 decisions change with record order. The largest evidence shift is 0.6741, and three cases have evidence in the unsure band in the first original-order pass. Stored evidence and decisions are identical across repeated passes with the same order, including sequential calls. All three classifier-steering cases go to review in every pass.

Sequential p50 is 343–349 ms and p95 is 441–485 ms. At six in flight across both orders, p50 is 359–408 ms and p95 is 546–692 ms. None of the 595 calls failed or exceeded 2.5 seconds. These numbers use a different caller environment from October 4, so the latency change does not isolate a server-side improvement.

Each pass reports 167,962 input tokens, about $0.040 at the existing $0.24 per million input-token rate (about $0.282 for seven passes). Raw results: [original order](results/rerun-2026-10-12-clef-hosted-given.json), [reversed order](results/rerun-2026-10-12-clef-hosted-reversed.json), and [sequential](results/rerun-2026-10-12-clef-sequential-given.json).

Reproduce the Clef run with:

```sh
node run.mjs --backends clef --passes 3
node run.mjs --backends clef --passes 2 --order reversed
node run.mjs --backends clef --passes 2 --concurrency 1
```

### OpenAI Decisions, 2026-10-06

We ran `gpt-6-luna` through `POST /v1/decisions` at 23:37–23:38 UTC: three original-order passes and two reversed at six in flight, then two original-order passes one request at a time. Each pass contains the same 85 cases (56 requiring review, 29 routine), with the existing questions, criteria, thresholds and gates. These calls ran from a cloud executor through its HTTPS proxy; its region was not recorded. The latency figures therefore describe this environment and are not a controlled speed comparison with the earlier laptop runs. No other backend was re-run on this date.

| order | recall | routine admit | false admits / needless reviews | gates |
| --- | --- | --- | --- | --- |
| Original | 1.000 (56/56) | 0.897 (26/29) | 0 / 3 | PASS in all five passes, including sequential |
| Reversed | 0.964 (54/56) | 0.828 (24/29) | 2 / 5 | FAIL in both passes: routine admit below 0.85 |

**GPT-6 Luna passes in the original order, but is sensitive to record order.** Eight of 85 decisions change when reversed, and the largest change in evidence is 0.63. The reversed order admits `crm-account-notes/restates-paraphrase` and `clinic-procedures/hard-contradicts-buried`, both of which require review. The first case's restatement evidence falls from 0.68 to 0.05; the second's contradiction evidence falls from 0.37 to 0.10. All three classifier-steering cases go to review in every pass.

The original order sends three routine writes to review: `eng-runbook/self-corrects-errors`, `crm-account-notes/self-adds-information`, and `t0/routine-customer-story`. Their contradiction evidence is 0.22, 0.22 and 0.23, just above the 0.2 admission cut-off. In the first original-order pass, 22 of 85 cases have at least one evidence value in the unsure band. Repeated passes with the same order return identical stored evidence probabilities and decisions, including the sequential runs; this is an observation of these runs, not a determinism guarantee.

| setting | p50 across passes | p95 across passes | calls over 2.5 s | failed calls |
| --- | --- | --- | --- | --- |
| Six in flight, both orders | 171–177 ms | 240–303 ms | 0 of 425 | 0 of 425 |
| One request at a time, original order | 168–171 ms | 277–284 ms | 0 of 170 | 0 of 170 |

Every pass reports 170,494 input tokens. At the published base rate of $0.10 per million input tokens, that is about $0.017 per 85-case pass and $0.119 for all seven passes, excluding any premiums. This is a token-based estimate, not an invoice.

Raw per-case evidence, decisions, token counts and latencies: [original order](results/openai-decisions-2026-10-06-hosted-given.json), [reversed order](results/openai-decisions-2026-10-06-hosted-reversed.json), and [sequential](results/openai-decisions-2026-10-06-sequential-given.json). The commands in the OpenAI run instructions above reproduce the pass counts, orders and concurrency settings.

### Re-run, 2026-10-04

Cloudflare said Clef had been updated with fixes, mostly for images. We re-ran Jev, Clef and Clef-flash at 14:42 UTC with the same settings: three passes in the original order and two reversed at six in flight, then two passes one request at a time.

**Clef's answers did not change.** Clef and Clef-flash returned exactly the same probabilities as on 2026-10-01 for every case, in both orders, so the October 1 Clef quality figures still hold. Jev's scores again moved slightly between passes, by up to 0.08. That gave it one needless review in one reversed pass, on `saas-support-kb/hard-compatible-sibling`, the same case as before.

**The endpoints are faster, and the slow tail is gone.**

| model | one request at a time: p50 / p95 | six in flight: p50 / p95 | calls over 2.5 s |
| --- | --- | --- | --- |
| Jev 1.13.0 | 92–94 ms / 126–138 ms | 93–119 ms / 148–232 ms | 0 of 425 |
| Clef-flash | 229–281 ms / 526–543 ms | 258–408 ms / 535–874 ms | 1 of 425 |
| Clef | 628–668 ms / 927 ms–1.1 s | 665–742 ms / 1.0–1.7 s | 0 of 425 |

Against 2026-10-01, Clef-flash is about twice as fast, and Clef's median at six in flight dropped by about 150 ms. No call failed or hung. Kev was not re-run.

### Initial evaluation, 2026-10-01 (plus OpenAI on October 6)

Jev, Clef and Kev results in these tables are from one laptop on the US west coast, between 21:30 UTC on 2026-10-01 and 03:10 UTC the next day. Jev and Clef are called over each provider's public HTTPS API. Kev-27B is self-hosted on one Modal GPU container. Kev-9B and Kev-4B ran on the laptop itself, so they have quality numbers and no latency numbers. GPT-6 Luna results are from 2026-10-06, using OpenAI Decisions from a cloud executor through an HTTPS proxy; its region was not recorded. The later hosted re-run and detailed OpenAI Decisions results are in their dated sections above.

Gates: recall ≥ 0.95, routine-admit ≥ 0.85, p95 ≤ 2500 ms, no failed calls.

#### Quality

Each case is run with its accepted records in the original order and again reversed. The decision should not depend on the order.

| model | recall (original / reversed) | routine admit (original / reversed) | decisions changed by order | answers in the unsure band |
| --- | --- | --- | --- | --- |
| Jev 1.13.0 | 1.00 / 1.00 | 1.00 / 1.00 | 0 | 1 of 85 |
| Kev-27B | 1.00 / 1.00 | 1.00 / 1.00 | 0 | 3 of 85 |
| Clef (27B) | 0.98 / 1.00 | 0.97 / 0.97–1.00 | 2 | 4 of 85 |
| GPT-6 Luna (OpenAI Decisions) | 1.00 / 0.96 | 0.90 / 0.83 | 8 | 22 of 85 |
| Kev-9B | 0.98 / 0.91 | 0.90 / 1.00 | 9 | 43 of 85 |
| Clef-flash (9B) | 0.98 / 1.00 | 0.66 / 0.62 | 4 | 19 of 85 |
| Kev-4B | 0.96 / 0.95 | 0.55 / 0.52 | 8 | 62 of 85 |

"Recall" is the share of writes that should go to review and did; a miss is a bad write admitted unreviewed. "Routine admit" is the share of harmless writes that were admitted; a miss is a needless review. The unsure band is evidence between 0.2 and 0.5, counted in the first original-order pass.

#### Latency

Round-trip time as the caller sees it. GPT-6 Luna was measured on a different date and from a different environment, so its latency is not a controlled speed comparison with the laptop runs.

| model | one request at a time: p50 / p95 | six in flight: p50 / p95 | calls over 2.5 s |
| --- | --- | --- | --- |
| Jev 1.13.0 | 98–167 ms / 156–260 ms | 101–124 ms / 147–242 ms | 0 of 425 |
| GPT-6 Luna (OpenAI Decisions) | 168–171 ms / 277–284 ms | 171–177 ms / 240–303 ms | 0 of 425 |
| Kev-27B (one Modal container) | 255–263 ms / 318–479 ms | 0.93–1.6 s / 1.4–2.6 s | 5 of 425 |
| Clef-flash | 429–533 ms / 677–732 ms | 546–714 ms / 0.8–1.9 s | 8 of 425 |
| Clef | 638–717 ms / 0.9–1.1 s | 809–930 ms / 1.1–1.7 s | 9 of 425 |

The "over 2.5 s" column is from the six-in-flight runs. Two of Clef's nine never returned within 60 seconds.

#### Cost

Jev, Clef, Clef-flash and OpenAI Decisions bill input tokens: $0.042, $0.24, $0.09 and $0.10 per million, which is about $0.008, $0.040, $0.015 and $0.017 per 85-case pass, respectively. The OpenAI figure uses the published base rate, excluding any premiums. Kev is billed as GPU time while a container is up, so its cost per request depends on how busy the container is.

#### Interpretation at the time

**Jev and Kev-27B both get every decision right, in both orders.** Kev-27B is the only other model that does. Its probabilities are also the steadiest: identical requests moved by at most 0.02, and reordering by at most 0.11. One of its correct escalations rests on a thin margin, with evidence of 0.22 against a 0.2 cut-off.

**Clef is close on quality, and its answers depend on the order of the records.** Clef misses one contradiction in the original order and none in the reversed order. It is deterministic: identical requests returned identical probabilities in every pass, so the change is the order alone. Two of its decisions changed, and the largest shift in evidence was 0.49. In its one miss, the colliding record scored 0.04 for `contradicts` in first position and 0.60 in last position.

**The 9B and 4B models are not usable for this task as released.** Clef-flash sends about a third of harmless writes to review in either order and reads every typo fix as a rewording. Kev-9B passes in the original order and admits five writes it should have escalated when reversed. Kev-4B admits about half of harmless writes, and it is the only model that admitted a write crafted to steer the classifier. The small Kev models leave half or more of their answers in the unsure band.

**Jev is not deterministic.** Identical requests to Jev moved by up to 0.12 between passes, and reordering moved it by up to 0.27. Neither changed a decision in these runs.

**Jev is the fastest as served, and the gap depends on load.** With one request at a time, Jev answers in about 100–170 ms, Kev-27B in about 260 ms, and Clef in about 650–700 ms. Kev's server reports 95 ms of model time for our request at the median, so most of its round trip is network and Modal's proxy. With six requests in flight, a single Kev container queues and slows to about 1 second or more, while Jev does not move.

**Clef's latency runs opposite to the launch claim.** Cloudflare's published figures are 209 ms for Clef and 524 ms for Jev. Their leaderboard data notes that the Jev number is a network round trip to the hosted API and the Clef number is measured on the GPU in one process, and that the two are not comparable.

**The hosted Clef endpoints have a slow tail.** Several calls took 9 to 26 seconds. Earlier the same day, a few hours after launch, about a fifth of Clef calls at six in flight returned 429 "Capacity temporarily exceeded"; by these runs there were none.

**Self-hosting has a cold start.** Kev-27B scales to zero when idle. Its first start took 6 minutes while it downloaded 51 GB of weights, and a later start from the cached weights took just under 3 minutes.

### Published benchmark comparison recorded October 1

At the time of the initial evaluation, Clef led the [Decision Index leaderboard](https://clef-evals.workers-ai-mle.workers.dev/) overall. That lead comes mostly from tool use and intent classification. On the benchmarks closest to this task the picture is mixed, and matches what we measured:

| benchmark | Jev | Clef | Clef-flash |
| --- | --- | --- | --- |
| ANLI (adversarial contradiction) | 0.75 | 0.70 | 0.59 |
| NLI4CT (clinical contradiction) | 0.84 | 0.83 | 0.79 |
| HoVer (multi-document claims) | 0.73 | 0.65 | 0.61 |
| ContractNLI | 0.72 | 0.81 | 0.84 |
| RAGTruth | 0.77 | 0.79 | 0.36 |

Three properties of this task are not covered by those benchmarks:

- **Many questions over one shared state.** Benchmarks ask one question about one premise. Here each request asks 5 to 10 questions, each pointing at a different record in the same state by position. That is where the order sensitivity shows.
- **Thresholded probabilities.** Benchmarks score the top answer. This task acts on the probability itself, with an unsure band, so a model that is right but spreads its probability is penalized. The leaderboard lists calibration figures for Jev and none for either Clef model.
- **Served latency.** The published latency is model speed on a GPU. What an application sees is the hosted endpoint, including queueing.

### Initial-run environment and model details

- 85 synthetic cases is a small set. One case moves recall by 0.02.
- The question wording and the 0.5 / 0.2 thresholds were tuned on Jev. Neither Clef nor Kev got tuning of its own.
- Measured over public REST from one location in the US. Calling Clef through the Workers AI binding from inside a Worker should be faster; we have not measured it. The REST overhead we measured was about 80 ms.
- All three Kev models are the [Kev 1.0](https://github.com/jaredpalmer/kev/releases/tag/kev-1.0) release: we loaded each Hub repo's `main` revision a few hours after the release, and its weight files are byte-identical to the `v1.0` tag (Kev-4B `139fdd94`, Kev-9B v2 `b5d8c18e`, Kev-27B v2 full weights). The local servers ran kev at `84847f0`; the Modal endpoint ran the deploy script's pinned `71d4829`. Neither differs from the `kev-1.0` tag in the `kev/` serving package except `kev/checkpoint.py`'s release-date metadata.
- Kev-27B ran on whichever GPU Modal allocated from the deploy script's list (B200, H200 or H100); we did not record which. Kev-9B and Kev-4B ran through MLX on an Apple M4 Pro, not on the CUDA path.
- These details describe the initial October 1 and October 4 runs; later cloud runs document their own environments above.

## License

Apache-2.0, including the cases.
