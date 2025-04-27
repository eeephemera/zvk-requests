"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RequestDetailsModal from "../../components/RequestDetailsModal";
import {
  getAllRequests,
  downloadRequestFile,
  updateRequestStatus,
  deleteRequest
} from "@/services/managerRequestService";
import { Request } from "@/services/requestService";
import { ApiError, PaginatedResponse } from "@/services/apiClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from '@/components/Header';

// Количество элементов на странице
const ITEMS_PER_PAGE = 10;

export default function ManagerPage() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOrg, setFilterOrg] = useState<string>('');
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  // Get requestId from URL query params if available
  const requestIdParam = searchParams.get('requestId');

  // Fetch requests with pagination and filters
  const { 
    data: requestsData,
    isLoading: isLoadingRequests,
    isError: isErrorRequests,
    error: requestsError
  } = useQuery<PaginatedResponse<Request>, ApiError>({
    queryKey: ['managerRequests', currentPage, filterStatus, filterOrg, sortField, sortDirection],
    queryFn: () => getAllRequests(
      currentPage,
      ITEMS_PER_PAGE,
      filterStatus,
      filterOrg,
      sortField,
      sortDirection
    ),
  });

  // State for loading status and file download
  const [downloadingFile, setDownloadingFile] = useState<boolean>(false);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerRequests'] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRequest(id),
    onSuccess: () => {
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['managerRequests'] });
    }
  });

  // File download handler
  const handleDownloadFile = async (requestId: number) => {
    if (downloadingFile) return;
    setDownloadingFile(true);
    setFileDownloadError(null);

    try {
      const { blob, filename } = await downloadRequestFile(requestId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      setFileDownloadError(
        error instanceof ApiError 
          ? error.message 
          : "Не удалось скачать файл. Пожалуйста, попробуйте позже."
      );
    } finally {
      setDownloadingFile(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (requestId: number, newStatus: string) => {
    await statusMutation.mutateAsync({ id: requestId, status: newStatus });
  };

  // Handle request deletion
  const handleDeleteRequest = async (requestId: number) => {
    await deleteMutation.mutateAsync(requestId);
  };

  // Open request by ID from URL param
  useEffect(() => {
    if (requestIdParam) {
      const id = parseInt(requestIdParam);
      const request = requestsData?.items.find(r => r.id === id);
      if (request) {
        setSelectedRequest(request);
      }
    }
  }, [requestIdParam, requestsData?.items]);

  // Rest of the component...
}