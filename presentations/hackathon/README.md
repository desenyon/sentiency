# Hackathon judge deck (8 slides)

## Slide order

1. Title — browser-native positioning  
2. Inspiration + problem  
3. Six engines + **screenshot** (`media/screenshot-activity.png`)  
4. One threat pipeline (full wording, no abbreviations)  
5. Differentiation + honest Gemini / Generative Language API line  
6. Implementation — full stack names, local algorithm list, AI disclosure, **team**  
7. Challenges · learned · next (PDF/OCR **only** here)  
8. **Demo last** — large screenshot, three beats, caption, thank you + repo  

**Team:** Naitik Gupta, Julian Juan, Eric Hou, Ming Ying  

## Screenshots (`photos/` → `media/`)

The HTML deck and PowerPoint load images from **`presentations/hackathon/media/`**.

| File | Typical source |
|------|----------------|
| `screenshot-activity.png` | `photos/image.png` |
| `screenshot-threat-detail.png` | `photos/image copy.png` |

```bash
cp photos/image.png presentations/hackathon/media/screenshot-activity.png
cp "photos/image copy.png" presentations/hackathon/media/screenshot-threat-detail.png
```

Add more PNGs under `media/` and wire them in `deck.html` if you want extra slides.

## Interactive HTML deck

- **Pipeline slide:** animated SVG flow lines; **click stages** (1–6) to highlight the matching step in the list.
- **Engines slide:** **click** an engine card to spotlight it (presentation emphasis).
- **Demo slide:** **tabs** switch between activity log and threat-detail screenshots.
- **Any deck photo:** **click** to open a **fullscreen lightbox** (Escape or backdrop to close).
- **R** replays the current slide’s entrance motion (when not typing in an input).

## HTML deck

Open **`deck.html`** in Chrome, full screen. Arrows, Space / Shift+Space, dots, swipe.  
Slide 6 scrolls if content is tall. Requires network for fonts + GSAP.

## PowerPoint

```bash
npm run deck:pptx
```

Embeds **`media/screenshot-activity.png`** on slides 3 and 8 when the file exists.

## Messaging guardrails

- Do not claim **100% local** analysis; use **local-first** + user’s **Gemini** key.  
- Do not claim **PDF/OCR** as shipped (slide 7 only).  
- Avoid **steganography** claims; use **visible text in images**.
