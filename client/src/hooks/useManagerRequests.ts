"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllRequests } from "@/services/managerRequestService";
import type { PaginatedResponse } from "@/services/apiClient";
import type { Request } from "@/services/requestService";

export function useManagerRequests(
  params: {
    page: number;
    limit: number;
    statusFilter: string;
    orgFilter: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }
) {
  const { page, limit, statusFilter, orgFilter, sortBy, sortOrder } = params;

  return useQuery<PaginatedResponse<Request>>({
    queryKey: ['managerRequests', page, limit, statusFilter, orgFilter, sortBy, sortOrder],
    queryFn: () => getAllRequests(page, limit, statusFilter, orgFilter, sortBy, sortOrder),
    refetchOnWindowFocus: false,
    staleTime: 30000,
    retry: 1,
  });
}


