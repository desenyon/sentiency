export function validateSchema(value, schema) {
  if (!schema || !value && schema.type === 'object') return false;
  if (schema.type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (schema.required || []).every((key) => key in value)
      && Object.entries(schema.properties || {}).every(([key, spec]) => !(key in value) || validateSchema(value[key], spec));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length <= 1000 && value.every((v) => validateSchema(v, schema.items));
  if (schema.type === 'integer') return Number.isSafeInteger(value);
  if (schema.type === 'number') return Number.isFinite(value);
  if (schema.type === 'string') return typeof value === 'string' && value.length <= 100000;
  if (schema.type === 'boolean') return typeof value === 'boolean';
  return false;
}
export function validateClassifier(value, schema, sourceText) {
  if (!validateSchema(value, schema)) return false;
  if ('confidence' in value && (value.confidence < 0 || value.confidence > 1)) return false;
  const text = sourceText ?? value.extracted_visible_text;
  if (value.injection_spans) {
    if (typeof text !== 'string' && value.injection_spans.length) return false;
    if (value.injection_spans.some((span) => span.start < 0 || span.end <= span.start || span.end > text.length || text.slice(span.start, span.end) !== span.text)) return false;
  }
  if (value.transcription_blocks) {
    const blocks = [...value.transcription_blocks].sort((a, b) => a.readingOrder - b.readingOrder);
    if (new Set(blocks.map((b) => b.readingOrder)).size !== blocks.length || blocks.some((b) => b.readingOrder < 0)) return false;
    if (blocks.length && blocks.map((b) => b.text).join('\n') !== value.extracted_visible_text) return false;
  }
  return true;
}
export const TRAJECTORY_SCHEMA = {
  type: 'object', required: ['trajectory_attack_detected', 'confidence', 'compromised_turns'],
  properties: {
    trajectory_attack_detected: { type: 'boolean' }, confidence: { type: 'number' },
    compromised_turns: { type: 'array', items: { type: 'integer' } },
  },
};
export function validateTrajectory(value, count) {
  if (!validateClassifier(value, TRAJECTORY_SCHEMA)) return false;
  const turn = (v) => v == null || Number.isSafeInteger(v) && v >= 1 && v <= count;
  return turn(value.attack_began_at_turn)
    && (value.safe_truncation_point == null || Number.isSafeInteger(value.safe_truncation_point) && value.safe_truncation_point >= 0 && value.safe_truncation_point <= count)
    && value.compromised_turns.every((v) => Number.isSafeInteger(v) && v >= 1 && v <= count)
    && ['attack_type', 'description'].every((k) => value[k] == null || typeof value[k] === 'string' && value[k].length <= 10000);
}
