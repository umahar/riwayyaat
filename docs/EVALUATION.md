# Evaluation & Demo Workflow

Riwayyaat’s quantitative demo runs a small evaluation set end-to-end (retrieval ➜ KG enrichment ➜ answer generation) and surfaces the metrics cited in the IEEE paper.

## 1. Prepare the evaluation set

The runner expects `evaluation/eval-set.json` (override with `EVAL_DATASET_PATH`). Each entry looks like:

```json
[
  {
    "id": "niyyah-intentions",
    "question": "What does the hadith about intentions teach?",
    "relevantHadithIds": [1, 42],
    "filters": {
      "sourceId": 3,
      "tagIds": [7, 11]
    },
    "notes": "Sample: replace with your curated evaluation query."
  }
]
```

Notes:

- `relevantHadithIds` must contain the Postgres `hadith.id` values considered correct for the question.
- `filters` are optional and mirror the RAG filter object (`sourceId`, `bookId`, `chapterId`, `tagIds`, `gradeIds`, `scholarIds`).
- Feel free to keep multiple entries—the runner processes them sequentially so the professor can watch metrics converge.

## 2. Run from the terminal

```bash
# default: uses evaluation/eval-set.json, top-20 retrieval, generates answers
npm run eval:run

# optional flags
npm run eval:run -- --limit=5 --topK=15 --skip-answers
```

The CLI prints:

1. Dataset metadata + warnings (missing IDs, no ground truth, etc.).
2. Global metrics: KG completeness (overall + isnād level), Precision@5, Recall@20, MRR, citation faithfulness, answer-level faithfulness.
3. Per-query breakdown: retrieved ranking (with relevance markers), answer snippet + citations, per-query KG coverage.

## 3. Run from the admin dashboard

- Visit `/admin/eval` (link available in the Hadith Manager header).
- Choose query limit / top-K / whether to skip answer generation.
- Click **Run evaluation**. Results display inline with cards for each metric, KG slot breakdown, per-query accordions, and any warnings.
- Use this view during the live demo so your professor can watch each metric update after a run.

## 4. What each metric represents

| Metric | Notes |
| --- | --- |
| **KG completeness (overall)** | Percentage of populated KG slots (display number, book, chapter, location, primary chain, chain narrators, identifiers, grades, tags) for the hadith touched by this evaluation run. |
| **KG completeness — isnād level** | Portion of those hadith that have detailed chain narrators (proxy for isnād coverage). |
| **Precision@5** | Fraction of relevant narrations within the top-5 dense retrieval hits. |
| **Recall@20** | Fraction of relevant narrations recovered within the top-20 hits. |
| **MRR** | Mean reciprocal rank of the first relevant hit per query. |
| **Citation faithfulness** | Share of generated citations that map to the declared relevant hadith IDs. |
| **Answer-level faithfulness** | 1 if every citation in an answer is relevant (and at least one citation exists), else 0. |

Faithfulness metrics require answer generation (`OPENAI_API_KEY`). If the key is absent or you pass `--skip-answers`, the runner reports `null` for those metrics.

## 5. Troubleshooting

- **“Evaluation dataset not found”** → Create `evaluation/eval-set.json` or set `EVAL_DATASET_PATH`.
- **Low KG completeness** → Run the admin sync queue (`npm run sync:delta`) so Neo4j + embeddings reflect the latest Postgres edits, then re-run evaluation.
- **LLM errors** → Ensure `OPENAI_API_KEY` and `RAG_LLM_MODEL` are set. The runner disables answer generation after the first failure and records a warning.

Use this workflow whenever the dataset or model changes so your reported metrics stay reproducible. The CLI output doubles as a transcript you can paste into appendices or lab notebooks.
