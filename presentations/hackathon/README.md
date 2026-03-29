# Hackathon judge deck (14 slides)

## Slide order

1. **Title** — positioning and tags  
2. **Inspiration** — two photos only, no body copy (`media/inspiration-1.jpg`, `inspiration-2.jpg`)  
3. **Context** — why we built it (text: inspiration + problem)  
4. **Six engines** — one shield (no screenshot on this slide)  
5. **Pipeline** — six steps, callouts  
6. **Differentiation** — privacy + honest Gemini line  
7. **Product** — activity / threat log (`media/ui-activity.png`)  
8. **Product** — threat detail (`media/ui-threat-detail.png`)  
9. **Process** — build snapshots 1–3 (`media/process-01.png` … `process-03.png`)  
10. **Process** — build snapshots 4–6 (`media/process-04.png` … `process-06.png`)  
11. **Implementation** — stack + local algorithms (two columns in HTML)  
12. **Integrity** — AI disclosure + team  
13. **Reflection** — challenges, learned, next (PDF/OCR **only** here)  
14. **Demo** — dual screenshots, beats, repo  

**Team:** Naitik Gupta, Julian Juan, Eric Hou, Ming Ying  

## Screenshots (`photos/` → `media/`)

The HTML deck and PowerPoint load images from **`presentations/hackathon/media/`**.

| File | Typical source |
|------|----------------|
| `ui-activity.png` | `photos/image.png` |
| `ui-threat-detail.png` | `photos/image copy.png` |
| `process-01.png` … `process-06.png` | `photos/Screenshot 2026-03-28 *.png` (chronological) |
| `inspiration-1.jpg` | `photos/gobaht.jpg` |
| `inspiration-2.jpg` | `photos/goabth2.jpg` |

One-shot sync (from repo root):

```bash
M=presentations/hackathon/media && mkdir -p "$M"
cp photos/gobaht.jpg "$M/inspiration-1.jpg"
cp photos/goabth2.jpg "$M/inspiration-2.jpg"
cp photos/image.png "$M/ui-activity.png"
cp "photos/image copy.png" "$M/ui-threat-detail.png"
cp "photos/Screenshot 2026-03-28 111838.png" "$M/process-01.png"
cp "photos/Screenshot 2026-03-28 115620.png" "$M/process-02.png"
cp "photos/Screenshot 2026-03-28 123634.png" "$M/process-03.png"
cp "photos/Screenshot 2026-03-28 132242.png" "$M/process-04.png"
cp "photos/Screenshot 2026-03-28 135858.png" "$M/process-05.png"
cp "photos/Screenshot 2026-03-28 140534.png" "$M/process-06.png"
```

Legacy names `screenshot-activity.png` and `screenshot-threat-detail.png` still work for **PowerPoint** if the `ui-*.png` files are missing.

## Interactive HTML deck

- **Layout:** fixed slide shell — header (brand + slide number), main body fits the viewport (no scroll). **Inspiration** slide has no header or copy — only the two photos (progress + dots still show slide position).  
- **Demo slide:** tabs — **Both** | Activity only | Threat only (grid reflows).  
- **Images:** click any `data-lightbox` photo for fullscreen zoom (Escape or backdrop to close).  
- **R** replays the current slide entrance animation (when not in an input).  
- **Figures:** three static SVG diagrams — where the extension sits in the browser (six engines slide), pipeline overview (architecture slide), trust boundary (differentiation slide). Product screenshots remain the primary UI proof.

## HTML deck

Open **`deck.html`** in Chrome, full screen. Arrows, Space (next), Shift+Space (previous), Home / End, dots, swipe. Requires network for fonts + GSAP.

## PowerPoint

```bash
npm run deck:pptx
```

Embeds UI and process images when present under `media/`.

## Messaging guardrails

- Do not claim **100% local** analysis; use **local-first** + user’s **Gemini** key.  
- Do not claim **PDF/OCR** as shipped (slide 13 only).  
- Avoid **steganography** claims; use **visible text in images**.
