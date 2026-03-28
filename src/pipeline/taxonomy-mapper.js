import { TAXONOMY, VALID_TECHNIQUES } from '../shared/taxonomy';

function walkChildren(node, path, target) {
  if (!node || typeof node !== 'object') return null;
  for (const [name, val] of Object.entries(node)) {
    if (name === 'description' || name === 'children') continue;
    const next = [...path, name];
    if (name === target) return next;
    if (val && typeof val === 'object' && val.children) {
      const hit = walkChildren(val.children, next, target);
      if (hit) return hit;
    }
  }
  return null;
}

export function mapToTaxonomyPath(attackClass, technique) {
  if (technique && VALID_TECHNIQUES.has(technique)) {
    for (const rootName of Object.keys(TAXONOMY)) {
      if (technique === rootName) return [rootName];
      const root = TAXONOMY[rootName];
      if (root.children) {
        const hit = walkChildren(root.children, [rootName], technique);
        if (hit) return hit;
      }
    }
  }
  if (attackClass && TAXONOMY[attackClass]) return [attackClass];
  if (attackClass) {
    for (const rootName of Object.keys(TAXONOMY)) {
      if (rootName.includes(attackClass) || attackClass.includes(rootName)) return [rootName];
    }
    return [attackClass];
  }
  return [];
}

export function isValidTechnique(technique) {
  if (!technique) return false;
  return VALID_TECHNIQUES.has(technique);
}
