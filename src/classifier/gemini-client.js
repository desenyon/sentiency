import { GEMINI_API_URL } from '../shared/constants';
import { storage } from '../shared/storage';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(s) {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

export async function callGemini(promptText) {
  const key = await storage.getApiKey();
  if (!key) {
    return { networkError: true, message: 'No API key configured' };
  }

  const url = `${GEMINI_API_URL}?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastErr = json?.error?.message || res.statusText;
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const text =
        json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
      const cleaned = stripCodeFences(text);
      try {
        return JSON.parse(cleaned);
      } catch {
        return { parseError: true, raw: cleaned };
      }
    } catch (e) {
      lastErr = e.message;
      await sleep(1000 * 2 ** attempt);
    }
  }
  return { networkError: true, message: lastErr || 'Gemini request failed' };
}
