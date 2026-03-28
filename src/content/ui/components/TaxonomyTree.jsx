import React, { useMemo, useState } from 'react';
import { TAXONOMY } from '../../../shared/taxonomy';

function NodeView({ name, node, activePath, depth }) {
  const [open, setOpen] = useState(activePath.includes(name));
  const hasChildren = node.children && Object.keys(node.children).length > 0;
  const isActive = activePath[activePath.length - 1] === name;

  return (
    <div style={{ marginLeft: depth ? 12 : 0 }}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={`sentientcy-taxo-node flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ${isActive ? 'is-active' : ''}`}
      >
        <span className="sentientcy-text-faint mt-0.5 shrink-0">{hasChildren ? (open ? '▾' : '▸') : '·'}</span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{name}</span>
          {node.description ? (
            <span className="sentientcy-taxo-desc mt-0.5 block text-[11px] leading-snug">{node.description}</span>
          ) : null}
        </span>
      </button>
      {hasChildren && open ? (
        <div className="mt-1 border-l border-zinc-600/60 pl-2">
          {Object.entries(node.children).map(([childName, child]) => (
            <NodeView key={childName} name={childName} node={child} activePath={activePath} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaxonomyTree({ path }) {
  const activePath = useMemo(() => path || [], [path]);

  return (
    <div className="sentientcy-taxo max-h-48 overflow-y-auto rounded-xl p-2">
      {Object.entries(TAXONOMY).map(([name, node]) => (
        <NodeView key={name} name={name} node={node} activePath={activePath} depth={0} />
      ))}
    </div>
  );
}
