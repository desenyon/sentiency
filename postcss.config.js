// Chrome does not initialize @property declarations inside a shadow stylesheet.
// Mirror Tailwind's non-inherited defaults in the base layer for shadow hosts.
// Deriving these from the compiled declarations keeps rings, borders and spacing
// consistent when Tailwind adds or removes internal custom properties.
const shadowPropertyDefaults = {
  postcssPlugin: 'sentiency-shadow-property-defaults',
  OnceExit(root, { Rule, Declaration, AtRule }) {
    const rule = new Rule({ selector: ':host, :host *, :host ::before, :host ::after, :host ::backdrop' });
    root.walkAtRules('property', (property) => {
      if (!property.params.startsWith('--tw-')) return;
      let inherits; let initial = 'initial';
      property.walkDecls('inherits', (declaration) => { inherits = declaration.value; });
      property.walkDecls('initial-value', (declaration) => { initial = declaration.value; });
      if (inherits === 'false') rule.append(new Declaration({ prop: property.params, value: initial }));
    });
    if (rule.nodes?.length) root.append(new AtRule({ name: 'layer', params: 'base' }).append(rule));
  },
};

module.exports = {
  plugins: [require('@tailwindcss/postcss')(), shadowPropertyDefaults],
};
