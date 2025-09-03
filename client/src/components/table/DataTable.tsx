"use client";

import React from "react";
import type { DataTableProps } from "./types";

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 5,
  sortBy,
  sortOrder,
  onSortChange,
  getRowKey,
  tableLabel,
}: DataTableProps<T>) {
  // Column visibility persistence
  const [hiddenCols, setHiddenCols] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    // load saved
    try {
      const key = (tableLabel || 'table') + ':cols';
      const raw = localStorage.getItem(key);
      if (raw) setHiddenCols(JSON.parse(raw));
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      const key = (tableLabel || 'table') + ':cols';
      localStorage.setItem(key, JSON.stringify(hiddenCols));
    } catch {}
  }, [hiddenCols, tableLabel]);
  // Simple virtualization: render only visible window based on container height and row height
  // Defaults are conservative; can be tuned per table.
  const rowHeight = 64; // px
  const overscan = 6;
  const [containerHeight, setContainerHeight] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onResize = () => setContainerHeight(el.clientHeight);
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableLabel]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const total = data.length;
  const viewportCount = containerHeight ? Math.ceil(containerHeight / rowHeight) : 12;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(total, startIndex + viewportCount + overscan * 2);

  const SkeletonRow = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-center p-3 rounded-lg bg-discord-background animate-pulse">
      {columns.map((_, idx) => (
        <div key={idx} className="h-4 bg-discord-border/50 rounded" />
      ))}
    </div>
  );

  const renderHeader = () => (
    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-discord-text-muted uppercase" role="rowgroup">
      {columns.map((col) => {
        if (hiddenCols[col.id]) return null;
        const isActive = sortBy === col.id;
        const ariaSort = isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';
        const arrow = !col.sortable ? null : !isActive ? (
          <span className="opacity-40">↕</span>
        ) : sortOrder === 'asc' ? (
          <span>▲</span>
        ) : (
          <span>▼</span>
        );
        const content = (
          <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
            <span>{col.header}</span>{col.sortable && <span className="text-xs">{arrow}</span>}
          </div>
        );
        return (
          <div key={col.id} className={col.className} role="columnheader" aria-sort={ariaSort as 'none' | 'ascending' | 'descending'}>
            {col.sortable && onSortChange ? (
              <button onClick={() => onSortChange(col.id)} className="w-full text-left hover:text-discord-accent transition-colors">
                {content}
              </button>
            ) : content}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3" role="table" aria-label={tableLabel} aria-busy={isLoading ? 'true' : 'false'}>
      {renderHeader()}
      {isLoading
        ? Array.from({ length: skeletonRows }).map((_, i) => <SkeletonRow key={i} />)
        : (
          <div ref={containerRef} onScroll={onScroll} style={{ maxHeight: 640, overflowY: 'auto', position: 'relative' }}>
            <div style={{ height: total * rowHeight, position: 'relative' }}>
              {data.slice(startIndex, endIndex).map((row, i) => {
                const idx = startIndex + i;
                return (
                  <div key={getRowKey(row)} style={{ position: 'absolute', top: idx * rowHeight, left: 0, right: 0 }} className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-center p-3 rounded-lg bg-discord-background hover:bg-discord-input transition-colors duration-200" role="row">
                    {columns.map((col) => hiddenCols[col.id] ? null : (
                      <div key={col.id} className={col.className} role="cell">
                        {col.cell ? col.cell(row) : col.accessor ? col.accessor(row) : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      {/* Column visibility toggles */}
      {/** Simple toggler UI; can be hidden if not needed */}
      <div className="flex flex-wrap gap-3 pt-2">
        {columns.map((c) => (
          <label key={c.id} className="text-xs text-discord-text-muted inline-flex items-center gap-2">
            <input type="checkbox" checked={!hiddenCols[c.id]} onChange={(e) => setHiddenCols((prev) => ({ ...prev, [c.id]: !e.target.checked }))} />
            {c.header}
          </label>
        ))}
      </div>
    </div>
  );
}

export default DataTable;


