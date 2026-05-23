# Prompt Quality Filter Framework
**Role**: Prompt Quality Gate Designer  
**Context**: Filter vague, ambiguous, and off-topic prompts before they reach the model  
**Goal**: Reject low-quality input with precision — no false positives, no wasted tokens

---

## Problem Decomposition

> "Garbage in, garbage out" — the model isn't the bottleneck. The prompt is.

Three failure modes, three distinct root causes:

| Failure Mode | Root Cause | Signal |
|---|---|---|
| Vague / too short | User hasn't thought through the ask | < 8 words, no verb, no object |
| Ambiguous intent | Goal is unclear or self-contradictory | Multiple possible interpretations |
| Off-topic | Prompt outside the tool's defined scope | No overlap with domain vocabulary |

---

## The 3-Layer Quality Gate

```
USER PROMPT
     │
     ▼
┌─────────────────┐
│  LAYER 1        │  Structural Check
│  Is it a real   │  → Min length, has a verb, not gibberish
│  sentence?      │
└────────┬────────┘
         │ FAIL → Reject: "Too vague. Try: [example]"
         │ PASS ↓
┌─────────────────┐
│  LAYER 2        │  Intent Check
│  Can we infer   │  → Detect a clear goal (classify, summarize,
│  a single goal? │    explain, create, compare...)
└────────┬────────┘
         │ FAIL → Reject: "Unclear goal. What outcome do you need?"
         │ PASS ↓
┌─────────────────┐
│  LAYER 3        │  Scope Check
│  Is it within   │  → Match against allowed topic domains
│  scope?         │
└────────┬────────┘
         │ FAIL → Reject: "Out of scope. This tool covers [X, Y, Z]."
         │ PASS ↓
     MODEL
```

---

## Layer Specifications

### Layer 1 — Structural Check
- **Threshold**: ≥ 6 tokens, contains ≥ 1 verb, not a single word/emoji
- **Rule**: If prompt is purely a noun phrase (e.g. "marketing"), reject
- **Reject message**: _"Your prompt is too short to act on. Example: 'Summarize the key trends in [topic]'"_

### Layer 2 — Intent Check
- **Method**: Extract intent verb (explain / create / analyze / compare / fix...)
- **Threshold**: Confidence score ≥ 0.6 on dominant intent class
- **Rule**: If 2+ intents score equally, flag as ambiguous
- **Reject message**: _"I see multiple possible goals. Are you asking me to [A] or [B]?"_

### Layer 3 — Scope Check
- **Method**: Keyword/embedding match against allowed domain list
- **Threshold**: Cosine similarity ≥ 0.5 to nearest domain cluster
- **Rule**: Prompts with zero domain overlap are hard-rejected
- **Reject message**: _"This falls outside what I'm built for. I handle [domain A, B, C]."_

---

## Decision Matrix

| Layer 1 | Layer 2 | Layer 3 | Action |
|---|---|---|---|
| FAIL | — | — | Hard reject + example prompt |
| PASS | FAIL | — | Soft reject + clarifying question |
| PASS | PASS | FAIL | Hard reject + scope reminder |
| PASS | PASS | PASS | → Send to model |

---

## Implementation Priorities

**Quick wins (Week 1)**
- [ ] Define minimum token threshold
- [ ] Build allowed-topic domain list (10–20 keywords per domain)
- [ ] Write 3 standard rejection messages

**Mid-term (Month 1)**
- [ ] Train intent classifier on 500 labeled prompts
- [ ] Add embedding-based scope check
- [ ] A/B test rejection messages for user drop-off rate

**KPIs to track**
- Filter rejection rate (target: < 15% of real user traffic)
- False positive rate (good prompts incorrectly rejected, target: < 2%)
- Post-filter model output quality score

---

## The One Principle

> Reject early, reject clearly, and always tell the user what a good prompt looks like.

A filter that blocks without guiding just creates friction. A filter that rejects with an example teaches the user to improve — and reduces repeat garbage.
