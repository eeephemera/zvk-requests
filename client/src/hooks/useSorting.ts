"use client";

import { useState } from "react";

export type SortOrder = 'asc' | 'desc';

export function useSorting<TField extends string>(initialField: TField, initialOrder: SortOrder = 'desc') {
  const [sortBy, setSortBy] = useState<TField>(initialField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);

  const toggleSort = (field: TField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return { sortBy, sortOrder, setSortBy, setSortOrder, toggleSort };
}


