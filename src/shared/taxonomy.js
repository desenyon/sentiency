function collectTechniques(node, prefix, out) {
  if (!node) return;
  Object.entries(node).forEach(([name, val]) => {
    const path = prefix ? `${prefix} > ${name}` : name;
    if (val && typeof val === 'object' && val.description !== undefined) {
      out.add(name);
      if (val.children) collectTechniques(val.children, name, out);
    }
  });
}

export const TAXONOMY = {
  'Overt Instruction': {
    description: 'Direct, explicit attempts to override model behavior.',
    children: {
      'Instruction Supersession': {
        description: 'Replacing prior instructions with new adversarial directives.',
      },
      'Role Reassignment': {
        description: 'Forcing the model into an unintended persona or privilege level.',
      },
      'Policy Override': {
        description: 'Commands that attempt to nullify safety or usage policies.',
      },
      'Jailbreak Phrasing': {
        description: 'Classic jailbreak templates and DAN-style roleplay.',
      },
    },
  },
  'Indirect Prompt Injection (User-Prompt Delivery)': {
    description: 'Payloads delivered through user-controlled input channels.',
    children: {
      'Embedded Directive': {
        description: 'Malicious instructions embedded in user-visible prompts.',
      },
      'Multi-Part Assembly': {
        description: 'Instructions split across multiple user turns.',
      },
      'Delimiter Abuse': {
        description: 'Fake system or tool blocks inside user content.',
      },
    },
  },
  'Indirect Prompt Injection (Context-Data)': {
    description: 'Attacks introduced via retrieved or external context.',
    children: {
      'External Context-Data Injection': {
        description: 'Untrusted documents or snippets in the model context.',
        children: {
          'Attacker-Owned External Injection': {
            description: 'Content sourced from attacker-controlled hosts or files.',
          },
          'Third-Party Document Injection': {
            description: 'Poisoned content in shared docs, emails, or tickets.',
          },
        },
      },
      'Visual Text Concealment': {
        description: 'Hidden or low-visibility text carrying instructions.',
      },
      'Metadata Channel': {
        description: 'Instructions hidden in filenames, alt text, or metadata.',
      },
    },
  },
  'Cognitive Control Bypass': {
    description: 'Techniques that manipulate reasoning or attention.',
    children: {
      'Attention Diversion': {
        description: 'Long benign preambles to bury the attack.',
      },
      'Authority Fabrication': {
        description: 'Claims of legal, managerial, or system authority.',
      },
      'Urgency and Social Pressure': {
        description: 'Time pressure or emotional manipulation.',
      },
      'Crescendo Attack': {
        description: 'Gradual escalation across benign turns.',
      },
      'Deceptive Delight Attack': {
        description: 'Benign rapport followed by a sudden injection.',
      },
    },
  },
  'Instruction Reformulation': {
    description: 'Repackaging instructions to evade filters.',
    children: {
      'Instruction Obfuscation': {
        description: 'Encoding or obscuring the payload.',
        children: {
          'Orthographic Manipulation': {
            description: 'Homoglyphs, spacing, and glyph tricks.',
            children: {
              'Homoglyph Substitution': {
                description: 'Lookalike Unicode for Latin letters.',
              },
            },
          },
          'Base-N Encoding': {
            description: 'Base64 and similar encodings of instructions.',
          },
          'Fragment Concatenation': {
            description: 'Split strings reassembled at runtime.',
          },
        },
      },
      'Euphemism and Indirection': {
        description: 'Indirect wording to imply harmful goals.',
      },
      'Translation Layering': {
        description: 'Pivot languages to bypass keyword lists.',
      },
    },
  },
  'Integrative Instruction Prompting': {
    description: 'Combining benign tasks with harmful objectives.',
    children: {
      'Task Coupling': {
        description: 'Bundling exfiltration with legitimate work.',
      },
      'Tool Misuse Priming': {
        description: 'Steering toward unsafe tool or API use.',
      },
      'In-Session Protocol Setup': {
        description: 'Establishing codewords or state for later exploitation.',
      },
    },
  },
  'Prompt Boundary Manipulation': {
    description: 'Blurring or crossing system vs user boundaries.',
    children: {
      'Synthetic System Markers': {
        description: 'Fake <system>, XML, or markdown fences.',
      },
      'Prior-LLM-Output Injection': {
        description: 'Poisoning via prior assistant outputs in context.',
      },
      'Output-Driven Steering': {
        description: 'Using model outputs to redirect later behavior.',
      },
      'Gradual Steering': {
        description: 'Slow drift toward disallowed outputs.',
      },
    },
  },
  'Multimodal Prompting Attacks': {
    description: 'Attacks spanning images, audio, or mixed modalities.',
    children: {
      'Steganographic Visual Prompt': {
        description: 'Instructions encoded in imagery.',
      },
      'OCR-Exploit Payload': {
        description: 'Text designed to OCR into harmful directives.',
      },
      'Cross-Modal Instruction': {
        description: 'Instructions split across modalities.',
      },
    },
  },
};

const _techniques = new Set();
Object.keys(TAXONOMY).forEach((k) => {
  _techniques.add(k);
  const root = TAXONOMY[k];
  if (root.children) collectTechniques(root.children, k, _techniques);
});

export const VALID_TECHNIQUES = _techniques;

export const TAXONOMY_CLASS_NAMES = Object.keys(TAXONOMY);
