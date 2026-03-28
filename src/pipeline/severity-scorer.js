import { SEVERITY } from '../shared/constants';

export function scoreSeverity(confidence, attackClass, localSignals) {
  let level = SEVERITY.LOW;
  if (confidence >= 0.9) level = SEVERITY.CRITICAL;
  else if (confidence >= 0.75) level = SEVERITY.HIGH;
  else if (confidence >= 0.6) level = SEVERITY.MEDIUM;

  const unicode = localSignals?.unicodeAnomalies;
  const encoding = localSignals?.encodingFindings;
  if (unicode && encoding) {
    const order = [SEVERITY.LOW, SEVERITY.MEDIUM, SEVERITY.HIGH, SEVERITY.CRITICAL];
    const idx = order.indexOf(level);
    if (idx >= 0 && idx < order.length - 1) level = order[idx + 1];
  }

  return level;
}
