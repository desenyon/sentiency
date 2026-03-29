# Sentiency hackathon deck — presenter script (~1:30 total)

Open `deck.html` full screen. Target **~90 seconds** end-to-end (~6–7s average per slide; go faster on photos, breathe on title and demo).

| Slide | Topic                         | ~Sec | Cumulative |
|------:|-------------------------------|-----:|-----------:|
| 1     | Title                         | 10   | 0:10       |
| 2     | Inspiration photos            | 5    | 0:15       |
| 3     | Why we built it               | 6    | 0:21       |
| 4     | Six engines                   | 7    | 0:28       |
| 5     | Pipeline                      | 7    | 0:35       |
| 6     | Differentiation               | 6    | 0:41       |
| 7     | Activity UI                   | 5    | 0:46       |
| 8     | Threat detail UI              | 5    | 0:51       |
| 9     | Process part 1                | 4    | 0:55       |
| 10    | Process part 2                | 4    | 0:59       |
| 11    | Stack & algorithms            | 6    | 1:05       |
| 12    | Disclosure & team             | 5    | 1:10       |
| 13    | Challenges / learned / next   | 5    | 1:15       |
| 14    | Demo & close                  | 15   | 1:30       |

Row times sum to **90 seconds**. If you run long, shorten slide 14 first, then slides 1 and 5–6.

---

### Slide 1 — Title (~10s)

**Say:** “Hi — we’re **Group 10**. This is **Sentiency**: **real-time prompt-injection defense** in the browser. It blocks hidden and adversarial input **before it hits the model**. No our backend, no telemetry — **Chrome extension**, **local-first**, and you bring your own **Gemini** key for classification.”

---

### Slide 2 — Inspiration (~5s)

**Say:** “**Hackathon inspiration** — these are the posters and context that made prompt injection feel like a **user-safety** problem, not only a model problem.” *(Gesture at the two photos; don’t read them.)*

---

### Slide 3 — Why we built it (~6s)

**Say:** “**Problem:** instructions hide in pages, paste, screenshots, and live chats — people notice too late. **Goal:** protect users **before** bad instructions enter the model’s context.”

---

### Slide 4 — Six engines (~7s)

**Say:** “We run **six engines** — DOM, clipboard, copy, **session**, images, manual scan — but they all feed **one pipeline**, one shield. The diagram is **where we sit**: between normal web input and the **AI chat**.”

---

### Slide 5 — One pipeline (~7s)

**Say:** “**Flow:** capture inputs, **local heuristics**, **Gemini** with a **JSON schema**, confirm the threat, score and map spans, then **side panel** — warn, highlight, sanitize, or block. Same path every time.”

---

### Slide 6 — Differentiation (~6s)

**Say:** “**Browser-native**, no Sentiency servers, **no telemetry**, settings and log in **chrome.storage.local**. Honest line: the **only** outbound call is **Gemini** with **your** API key — local-first, not marketing ‘100% local.’”

---

### Slide 7 — Activity log (~5s)

**Say:** “**Product shot** — side panel **activity log**: what we flagged, how severe, at a glance.”

---

### Slide 8 — Threat detail (~5s)

**Say:** “**Drill-in** — taxonomy, reasoning, remediation context so the user isn’t guessing.”

---

### Slide 9 — Build iteration 1 (~4s)

**Say:** “**Same-day build** — early exploration, design, implementation.” *(Quick pass over the three snapshots.)*

---

### Slide 10 — Build iteration 2 (~4s)

**Say:** “**Validation, polish, ship** — still the same sprint.” *(Quick pass.)*

---

### Slide 11 — Stack & algorithms (~6s)

**Say:** “**Stack:** React, MV3, side panel, Shadow DOM, Webpack, **Generative Language API**. **Local side:** DOM visibility, Unicode, encoding, pattern heuristics, span merge for highlights and cleanup.”

---

### Slide 12 — AI disclosure & team (~5s)

**Say:** “**Disclosure:** we used AI to build; the **shipped** product calls **Gemini** for classification — architecture is ours. **No** Sentiency account. **Team:** Naitik Gupta, Julian Juan, Eric Hou, Ming Ying.”

---

### Slide 13 — Challenges / learned / next (~5s)

**Say:** “**Hard parts:** false positives, MV3 timing, obfuscated text, multi-turn and image attacks. **Learned:** it’s a **systems** problem — safety at the **interface**. **Next:** PDF/OCR is on the roadmap, not wired yet; explainability and enterprise controls.”

---

### Slide 14 — Demo & close (~15s)

**Say:** “**Live demo** — you’ll see **activity** and **threat detail** tabs: hidden text flagged, paste intercepted or cleaned, session threats in the panel. **Warn, highlight, sanitize, block.** Repo is **github.com/desenyon/sentiency** — happy to take questions.”

*(If short on time, cut to: “Demo on the extension — side panel, two screenshots here — thanks, we’re Group 10.” ~8s.)*

---

## One-page cheat sheet (read from phone)

1. **G10 · Sentiency** — browser shield before the model; local-first; BYO Gemini.  
2. **Inspiration** — posters / context.  
3. **Problem** — hidden instructions; protect early.  
4. **6 engines → 1 pipe** — diagram = placement.  
5. **Pipeline** — local → Gemini → UI/remediate.  
6. **Trust** — no our backend; one Gemini call, your key.  
7–8. **UI** — log + detail.  
9–10. **Process** — same-day snapshots.  
11. **Tech** — MV3 + React + local algorithms.  
12. **AI + team** — honest disclosure + names.  
13. **Reflect** — challenges, systems lesson, PDF/OCR later.  
14. **Demo + repo + thanks.**
