# admission-decision-eval

A small, reproducible comparison of decision models on one production task: deciding whether an AI agent's write to a knowledge base can be admitted automatically or needs human review.

It runs TypeSafe's Jev and Cloudflare's Clef and Clef-flash through the same 85 labeled cases, with the same request, and grades the resulting admit/escalate decisions. One script, no dependencies.

These are first-look numbers from 2026-10-01, the day Clef launched. Treat them as a snapshot.

## The task

At [Nicia](https://nicia.ai), agents write into a shared knowledge base. Most writes are routine and should land. A write that contradicts something already accepted, or that only restates it, should go to a person first.

Each write becomes one request to a decision model:

- **State:** the incoming record, the accepted records it could collide with (5 to 9 here), and, for an edit, the record's own prior version.
- **Questions:** one `choice` per accepted record (`contradicts` / `restates` / `compatible`), plus one about the edit (`corrects_errors` / `rewords` / `adds_information` / `changes_meaning`).

The decision takes the strongest evidence across all the answers. A probability of 0.5 or more is a yes, under 0.2 is a no, and anything between is treated as "unsure" and sent to review. The write is admitted only when both facts are a confident no.

The cases are synthetic: six fictional organizations (a support knowledge base, an HR handbook, an engineering runbook, CRM notes, clinic procedures, a marketing brain), covering plain and hard contradictions, paraphrases, compatible look-alikes, four kinds of self-edit, and three writes that try to instruct the classifier. `cases.json` holds every request and its label.

## Results

Run on 2026-10-01 at 21:32 UTC, six requests in flight, from one laptop over each provider's public HTTPS API. Three passes in the original order and two reversed: 425 calls per model. Gates: recall ≥ 0.95, routine-admit ≥ 0.85, p95 ≤ 2500 ms, no failed calls.

**Accepted records in their original order**

| model | escalation recall | routine admit | p50 | p95 | cost per run | gates |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 1.13.0 | 1.00 | 1.00 | 107–114 ms | 176–242 ms | $0.008 | pass 3/3 |
| Clef | 0.98 | 0.97 | 809–913 ms | 1.1–1.7 s | $0.040 | pass 2/3 |
| Clef-flash | 0.98 | 0.66 | 577–619 ms | 0.8–1.6 s | $0.015 | fail 0/3 |

**The same records in reversed order**

| model | escalation recall | routine admit | p50 | p95 | gates |
| --- | --- | --- | --- | --- | --- |
| Jev 1.13.0 | 1.00 | 1.00 | 101–124 ms | 147–212 ms | pass 2/2 |
| Clef | 1.00 | 0.97–1.00 | 880–930 ms | 1.3–1.4 s | pass 1/2 |
| Clef-flash | 1.00 | 0.62 | 546–714 ms | 0.8–1.9 s | fail 0/2 |

"Escalation recall" is the share of writes that should go to review and did; a miss is a bad write admitted unreviewed. "Routine admit" is the share of harmless writes that were admitted; a miss is a needless review. Cost is input tokens at list price ($0.042, $0.24 and $0.09 per million). Clef's two failed passes each had one call that did not return within 60 seconds.

## What we see

**Jev and Clef are close on quality; Clef-flash is not usable for this task.** Clef misses one contradiction in the original order and none in the reversed order. Clef-flash sends about a third of harmless writes to review in either order. It reads every typo fix as a rewording, and 19 of its 85 answers land in the unsure band, against 4 for Clef and 1 for Jev.

**Clef's answers depend on the order of the records.** The decision should not change when the same accepted records are listed in a different order. Clef is deterministic: identical requests returned identical probabilities in every pass, so any change between the two tables is the order alone. Two of its decisions changed, and the largest shift in evidence was 0.49. In its one miss, the colliding record scored 0.04 for `contradicts` in first position and 0.60 in last position. Clef-flash, also deterministic, changed four decisions.

**Jev is not deterministic, and its decisions did not change with order.** Identical requests to Jev moved by up to 0.12 between passes, and reordering moved it by up to 0.27. Neither changed a decision in this run, and it never admitted a write it should have escalated.

**Latency is the large gap, and it runs opposite to the launch claim.** Jev answers in about 110 ms from here and Clef in about 850 ms. The fastest Clef call in this run took 383 ms and the fastest Clef-flash call 168 ms. Cloudflare's published figures are 209 ms for Clef and 524 ms for Jev. Their leaderboard data notes that the Jev number is a network round trip to the hosted API and the Clef number is measured on the GPU in one process, and that the two are not comparable.

**The hosted endpoints have a slow tail.** Of 425 calls each, 9 Clef calls and 8 Clef-flash calls took longer than 2.5 seconds, several of them 9 to 26 seconds, and 2 of the Clef calls never returned. Jev had none over 2.5 seconds. Earlier the same day, a few hours after launch, about a fifth of Clef calls at this concurrency returned 429 "Capacity temporarily exceeded"; by this run there were none.

## How this differs from the published benchmarks

Clef leads the [Decision Index leaderboard](https://clef-evals.workers-ai-mle.workers.dev/) overall. That lead comes mostly from tool use and intent classification. On the benchmarks closest to this task the picture is mixed, and matches what we measured:

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

## Caveats

- 85 synthetic cases is a small set. One case moves recall by 0.02.
- The question wording and the 0.5 / 0.2 thresholds were tuned on Jev. Clef got no tuning of its own.
- Measured over public REST from one location in the US. Calling Clef through the Workers AI binding from inside a Worker should be faster; we have not measured it. The REST overhead we measured was about 80 ms.
- Numbers from the day Clef launched. We will re-run.

## Run it

Node 20 or newer.

```sh
export TYPESAFE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...   # Workers AI permission

node run.mjs                                  # jev, clef, clef-flash; 3 passes
node run.mjs --backends clef --passes 1
node run.mjs --order reversed --concurrency 3
```

Each run prints one line per backend per pass and writes every case's probabilities, decision and latency to `results/`.

A full three-pass run costs under $0.25.

## License

Apache-2.0, including the cases.
