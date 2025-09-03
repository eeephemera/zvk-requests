"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "./useDebouncedValue";

export function useManagerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterOrg, setFilterOrg] = useState<string>(searchParams.get('org') || '');
  const debouncedOrg = useDebouncedValue(filterOrg, 400);
  const currentPage = Number(searchParams.get('page') || '1');

  const updateUrl = useCallback((page: number, status: string, org: string, extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (status) params.set('status', status);
    if (org) params.set('org', org);
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => v && params.set(k, v));
    }
    router.push(`/manager?${params.toString()}`);
  }, [router]);

  const resetFilters = () => {
    setFilterStatus('');
    setFilterOrg('');
    updateUrl(1, '', '');
  };

  return {
    filterStatus,
    filterOrg,
    setFilterStatus,
    setFilterOrg,
    debouncedOrg,
    updateUrl,
    resetFilters,
    currentPage,
  };
}


