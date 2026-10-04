# admission-decision-eval

A small, reproducible comparison of decision models on one production task: deciding whether an AI agent's write to a knowledge base can be admitted automatically or needs human review.

It runs TypeSafe's Jev, Cloudflare's Clef and Clef-flash, and the open-weights [Kev](https://github.com/jaredpalmer/kev) family through the same 85 labeled cases, with the same request, and grades the resulting admit/escalate decisions. One script, no dependencies.

These are first-look numbers from 2026-10-01, the day Clef and Kev 1.0 were released, with a re-run of the hosted models on 2026-10-04. Treat them as a snapshot.

## The task

At [Nicia](https://nicia.ai), agents write into a shared knowledge base. Most writes are routine and should land. A write that contradicts something already accepted, or that only restates it, should go to a person first.

Each write becomes one request to a decision model:

- **State:** the incoming record, the accepted records it could collide with (5 to 9 here), and, for an edit, the record's own prior version.
- **Questions:** one `choice` per accepted record (`contradicts` / `restates` / `compatible`), plus one about the edit (`corrects_errors` / `rewords` / `adds_information` / `changes_meaning`).

The decision takes the strongest evidence across all the answers. A probability of 0.5 or more is a yes, under 0.2 is a no, and anything between is treated as "unsure" and sent to review. The write is admitted only when both facts are a confident no.

The cases are synthetic: six fictional organizations (a support knowledge base, an HR handbook, an engineering runbook, CRM notes, clinic procedures, a marketing brain), covering plain and hard contradictions, paraphrases, compatible look-alikes, four kinds of self-edit, and three writes that try to instruct the classifier. `cases.json` holds every request and its label.

## Results

All runs are from one laptop on the US west coast, between 21:30 UTC on 2026-10-01 and 03:10 UTC the next day. Jev and Clef are called over each provider's public HTTPS API. Kev-27B is self-hosted on one Modal GPU container. Kev-9B and Kev-4B ran on the laptop itself, so they have quality numbers and no latency numbers.

Gates: recall ≥ 0.95, routine-admit ≥ 0.85, p95 ≤ 2500 ms, no failed calls.

### Quality

Each case is run with its accepted records in the original order and again reversed. The decision should not depend on the order.

| model | recall (original / reversed) | routine admit (original / reversed) | decisions changed by order | answers in the unsure band |
| --- | --- | --- | --- | --- |
| Jev 1.13.0 | 1.00 / 1.00 | 1.00 / 1.00 | 0 | 1 of 85 |
| Kev-27B | 1.00 / 1.00 | 1.00 / 1.00 | 0 | 3 of 85 |
| Clef (27B) | 0.98 / 1.00 | 0.97 / 0.97–1.00 | 2 | 4 of 85 |
| Kev-9B | 0.98 / 0.91 | 0.90 / 1.00 | 9 | 43 of 85 |
| Clef-flash (9B) | 0.98 / 1.00 | 0.66 / 0.62 | 4 | 19 of 85 |
| Kev-4B | 0.96 / 0.95 | 0.55 / 0.52 | 8 | 62 of 85 |

"Recall" is the share of writes that should go to review and did; a miss is a bad write admitted unreviewed. "Routine admit" is the share of harmless writes that were admitted; a miss is a needless review. The unsure band is evidence between 0.2 and 0.5, counted in the first original-order pass.

### Latency

Round-trip time as the caller sees it.

| model | one request at a time: p50 / p95 | six in flight: p50 / p95 | calls over 2.5 s |
| --- | --- | --- | --- |
| Jev 1.13.0 | 98–167 ms / 156–260 ms | 101–124 ms / 147–242 ms | 0 of 425 |
| Kev-27B (one Modal container) | 255–263 ms / 318–479 ms | 0.93–1.6 s / 1.4–2.6 s | 5 of 425 |
| Clef-flash | 429–533 ms / 677–732 ms | 546–714 ms / 0.8–1.9 s | 8 of 425 |
| Clef | 638–717 ms / 0.9–1.1 s | 809–930 ms / 1.1–1.7 s | 9 of 425 |

The "over 2.5 s" column is from the six-in-flight runs. Two of Clef's nine never returned within 60 seconds.

### Cost

Jev, Clef and Clef-flash bill input tokens: $0.042, $0.24 and $0.09 per million, which is $0.008, $0.040 and $0.015 per 85-case pass. Kev is billed as GPU time while a container is up, so its cost per request depends on how busy the container is.

## What we see

**Jev and Kev-27B both get every decision right, in both orders.** Kev-27B is the only other model that does. Its probabilities are also the steadiest: identical requests moved by at most 0.02, and reordering by at most 0.11. One of its correct escalations rests on a thin margin, with evidence of 0.22 against a 0.2 cut-off.

**Clef is close on quality, and its answers depend on the order of the records.** Clef misses one contradiction in the original order and none in the reversed order. It is deterministic: identical requests returned identical probabilities in every pass, so the change is the order alone. Two of its decisions changed, and the largest shift in evidence was 0.49. In its one miss, the colliding record scored 0.04 for `contradicts` in first position and 0.60 in last position.

**The 9B and 4B models are not usable for this task as released.** Clef-flash sends about a third of harmless writes to review in either order and reads every typo fix as a rewording. Kev-9B passes in the original order and admits five writes it should have escalated when reversed. Kev-4B admits about half of harmless writes, and it is the only model that admitted a write crafted to steer the classifier. The small Kev models leave half or more of their answers in the unsure band.

**Jev is not deterministic.** Identical requests to Jev moved by up to 0.12 between passes, and reordering moved it by up to 0.27. Neither changed a decision in these runs.

**Jev is the fastest as served, and the gap depends on load.** With one request at a time, Jev answers in about 100–170 ms, Kev-27B in about 260 ms, and Clef in about 650–700 ms. Kev's server reports 95 ms of model time for our request at the median, so most of its round trip is network and Modal's proxy. With six requests in flight, a single Kev container queues and slows to about 1 second or more, while Jev does not move.

**Clef's latency runs opposite to the launch claim.** Cloudflare's published figures are 209 ms for Clef and 524 ms for Jev. Their leaderboard data notes that the Jev number is a network round trip to the hosted API and the Clef number is measured on the GPU in one process, and that the two are not comparable.

**The hosted Clef endpoints have a slow tail.** Several calls took 9 to 26 seconds. Earlier the same day, a few hours after launch, about a fifth of Clef calls at six in flight returned 429 "Capacity temporarily exceeded"; by these runs there were none.

**Self-hosting has a cold start.** Kev-27B scales to zero when idle. Its first start took 6 minutes while it downloaded 51 GB of weights, and a later start from the cached weights took just under 3 minutes.

## Re-run, 2026-10-04

Cloudflare said Clef had been updated with fixes, mostly for images. We re-ran Jev, Clef and Clef-flash at 14:42 UTC with the same settings: three passes in the original order and two reversed at six in flight, then two passes one request at a time.

**Clef's answers did not change.** Clef and Clef-flash returned exactly the same probabilities as on 2026-10-01 for every case, in both orders, so every quality figure above still holds. Jev's scores again moved slightly between passes, by up to 0.08. That gave it one needless review in one reversed pass, on `saas-support-kb/hard-compatible-sibling`, the same case as before.

**The endpoints are faster, and the slow tail is gone.**

| model | one request at a time: p50 / p95 | six in flight: p50 / p95 | calls over 2.5 s |
| --- | --- | --- | --- |
| Jev 1.13.0 | 92–94 ms / 126–138 ms | 93–119 ms / 148–232 ms | 0 of 425 |
| Clef-flash | 229–281 ms / 526–543 ms | 258–408 ms / 535–874 ms | 1 of 425 |
| Clef | 628–668 ms / 927 ms–1.1 s | 665–742 ms / 1.0–1.7 s | 0 of 425 |

Against 2026-10-01, Clef-flash is about twice as fast, and Clef's median at six in flight dropped by about 150 ms. No call failed or hung. Kev was not re-run.

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
- The question wording and the 0.5 / 0.2 thresholds were tuned on Jev. Neither Clef nor Kev got tuning of its own.
- Measured over public REST from one location in the US. Calling Clef through the Workers AI binding from inside a Worker should be faster; we have not measured it. The REST overhead we measured was about 80 ms.
- All three Kev models are the [Kev 1.0](https://github.com/jaredpalmer/kev/releases/tag/kev-1.0) release: we loaded each Hub repo's `main` revision a few hours after the release, and its weight files are byte-identical to the `v1.0` tag (Kev-4B `139fdd94`, Kev-9B v2 `b5d8c18e`, Kev-27B v2 full weights). The local servers ran kev at `84847f0`; the Modal endpoint ran the deploy script's pinned `71d4829`. Neither differs from the `kev-1.0` tag in the `kev/` serving package except `kev/checkpoint.py`'s release-date metadata.
- Kev-27B ran on whichever GPU Modal allocated from the deploy script's list (B200, H200 or H100); we did not record which. Kev-9B and Kev-4B ran through MLX on an Apple M4 Pro, not on the CUDA path.
- Numbers from the day Clef and Kev 1.0 were released, plus one re-run of the hosted models three days later.

## Run it

Node 20 or newer.

```sh
export TYPESAFE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...   # Workers AI permission

node run.mjs                                  # jev, clef, clef-flash; 3 passes, 6 in flight
node run.mjs --backends clef --passes 1
node run.mjs --order reversed
node run.mjs --concurrency 1                  # one request at a time
```

For Kev, start a server pinned to the release, locally (`python -m kev.serve --run jaredpalmer/kev-27b@v1.0`, see [Run It Locally](https://github.com/jaredpalmer/kev#run-it-locally)) or [on Modal](https://github.com/jaredpalmer/kev#deploy-your-own-endpoint) (`KEV_MODEL=jaredpalmer/kev-27b@v1.0`), and point the script at it. A Kev server serves one model, so the backend name is a label for whichever one is running.

```sh
export KEV_URL=http://127.0.0.1:8009          # or your Modal URL
export KEV_API_KEY=...                        # only if the server requires one
node run.mjs --backends kev-27b
```

Each run prints one line per backend per pass and writes every case's probabilities, decision and latency to `results/`. The runs behind the tables above are in `results/`: `hosted-*` (Jev, Clef, Clef-flash at six in flight), `kev-*` (each Kev model), `sequential-given` (all four served models, one request at a time), and `rerun-2026-10-04-*` (the hosted models, three days later).

A three-pass run of the hosted models costs under $0.25.

## License

Apache-2.0, including the cases.
