"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RequestDetailsModal from "../../components/RequestDetailsModal";
import {
  getAllRequests,
  downloadRequestFile,
  updateRequestStatus,
  deleteRequest,
  getRequestByIdForManager
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
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loadingSingleRequest, setLoadingSingleRequest] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { 
    data: paginatedData,
    isLoading: isLoadingRequests,
    isError: isErrorRequests,
    error: errorRequests,
    isFetching: isFetchingRequests,
  } = useQuery<PaginatedResponse<Request>, ApiError | Error | null>({
    queryKey: ['allRequests', currentPage, ITEMS_PER_PAGE, filterStatus, filterOrg, sortField, sortDirection],
    queryFn: () => getAllRequests(currentPage, ITEMS_PER_PAGE, filterStatus, filterOrg, sortField, sortDirection),
  });

  const requests = useMemo(() => paginatedData?.items ?? [], [paginatedData]);
  const totalItems = useMemo(() => paginatedData?.total ?? 0, [paginatedData]);
  const totalPages = useMemo(() => Math.ceil(totalItems / ITEMS_PER_PAGE) || 1, [totalItems]);

  const listRequestError = useMemo(() => {
    const err = errorRequests;
    if (!isErrorRequests || !err) return null;
    
    let displayError = 'Произошла ошибка при загрузке списка заявок.';
    if (err instanceof ApiError) {
      if (err.status >= 500) {
        displayError = "Ошибка на сервере при загрузке списка заявок.";
      } else if (err.status === 401 || err.status === 403) {
        displayError = "Ошибка доступа к списку заявок.";
      } else {
        displayError = err.message || displayError;
      }
    } else if (err instanceof Error) {
      displayError = err.message;
    }
    return displayError;
  }, [isErrorRequests, errorRequests]);

  useEffect(() => {
    const requestIdStr = searchParams.get("requestId");
    
    if (!requestIdStr) {
      if (selectedRequest) setSelectedRequest(null);
      if (isLoadingDetails) setIsLoadingDetails(false); 
      return;
    }

    const id = parseInt(requestIdStr, 10);
    if (isNaN(id)) {
        if (selectedRequest) setSelectedRequest(null);
        if (isLoadingDetails) setIsLoadingDetails(false);
        router.replace("/manager", { scroll: false });
        return;
    }
    
    if (selectedRequest && selectedRequest.id === id && !isLoadingDetails) {
        return;
    }

    if (!isLoadingDetails) {
        setIsLoadingDetails(true);
    }
    
    if (!isLoadingRequests && !isFetchingRequests) {
      const foundRequest = requests.find((req) => req.id === id);

      if (foundRequest) {
        setSelectedRequest(foundRequest);
        setIsLoadingDetails(false);
        setRequestError(null);
      } else {
        setSelectedRequest(null);
        setIsLoadingDetails(false);
        setRequestError(`Заявка с ID ${id} не найдена.`);
      }
    } else {
        // Если список еще грузится/обновляется, просто остаемся в состоянии isLoadingDetails = true
    }

  }, [searchParams, requests, isLoadingRequests, isFetchingRequests, router, selectedRequest, isLoadingDetails]);

  const mutationUpdateStatus = useMutation<Request, ApiError | Error, { requestId: number; status: string }>({ 
    mutationFn: ({ requestId, status }) => updateRequestStatus(requestId, status),
    onSuccess: (updatedRequest) => {
      queryClient.invalidateQueries({ queryKey: ['allRequests'] });
      if (selectedRequest && selectedRequest.id === updatedRequest.id) {
        setSelectedRequest(updatedRequest);
      }
      setStatusUpdateError(null);
    },
    onError: (error) => {
      let msg = "Ошибка обновления статуса.";
      if (error instanceof ApiError) {
        msg = error.message || (error.status === 404 ? "Заявка не найдена." : msg);
      } else if (error instanceof Error) {
         msg = error.message;
      }
      setStatusUpdateError(msg);
      console.error("Ошибка обновления статуса:", error);
    },
    onSettled: () => {
        setUpdatingStatus(false);
    }
  });

  const mutationDelete = useMutation<void, ApiError | Error, number>({ 
    mutationFn: (requestId) => deleteRequest(requestId),
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries({ queryKey: ['allRequests'] });
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(null);
        router.replace("/manager", { scroll: false });
      }
      setDeleteError(null);
    },
    onError: (error) => {
      let msg = "Ошибка удаления заявки.";
      if (error instanceof ApiError) {
        msg = error.message || (error.status === 404 ? "Заявка не найдена." : msg);
      } else if (error instanceof Error) {
         msg = error.message;
      }
      setDeleteError(msg);
      console.error("Ошибка удаления:", error);
    },
    onSettled: () => {
      setIsDeleting(false);
    }
  });

  const mutationDownloadFile = useMutation< { blob: Blob; filename: string }, ApiError | Error, number>({ 
    mutationFn: (requestId) => downloadRequestFile(requestId),
    onSuccess: ({ blob, filename }) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      setFileDownloadError(null);
    },
    onError: (error) => {
      let msg = "Ошибка скачивания файла.";
       if (error instanceof ApiError) {
        msg = error.message || (error.status === 404 ? "Файл или заявка не найдены." : msg);
      } else if (error instanceof Error) {
         msg = error.message;
      }
      setFileDownloadError(msg);
      console.error("Ошибка скачивания файла:", error);
    },
    onSettled: () => {
      setDownloadingFile(false);
    }
  });

  const handleRowClick = (request: Request) => {
    router.push(`/manager?requestId=${request.id}`);
  };

  const handleDownloadFile = (requestId: number) => {
    if (mutationDownloadFile.isPending) return;
    setDownloadingFile(true);
    setFileDownloadError(null);
    mutationDownloadFile.mutate(requestId);
  };

  const handleUpdateStatus = (requestId: number, status: string) => {
    if (mutationUpdateStatus.isPending) return;
    setUpdatingStatus(true);
    setStatusUpdateError(null);
    mutationUpdateStatus.mutate({ requestId, status });
  };

  const handleDeleteRequest = (requestId: number) => {
    if (mutationDelete.isPending) return;
    setIsDeleting(true);
    setDeleteError(null);
    mutationDelete.mutate(requestId);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "На рассмотрении":
        return "bg-yellow-100 text-yellow-800";
      case "В работе":
        return "bg-purple-100 text-purple-800";
      case "Выполнена":
        return "bg-green-100 text-green-800";
      case "Отклонена":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const statuses = ["На рассмотрении", "В работе", "Выполнена", "Отклонена"];

  return (
    <ProtectedRoute allowedRoles={["MANAGER"]}>
      <div className="min-h-screen flex flex-col bg-discord-background">
        <Header />
        <div className="container mx-auto p-6 flex-grow">
          <div className="discord-card p-6 mb-6">
            <h1 className="text-2xl font-bold text-discord-text flex items-center mb-6">
              <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
              Панель управления заявками {(isFetchingRequests && !isLoadingRequests) ? '(Обновление...)' : ''}
            </h1>
            
            {listRequestError && (
              <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30 mb-4">
                <p className="text-discord-danger">{listRequestError}</p>
              </div>
            )}

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="status-filter" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Фильтр по статусу
                </label>
                <select
                  id="status-filter"
                  className="discord-input w-full appearance-none pr-8"
                  style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Все статусы</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="org-filter" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Поиск по организации
                </label>
                <input
                  id="org-filter"
                  type="text"
                  placeholder="Введите название организации"
                  className="discord-input w-full"
                  value={filterOrg}
                  onChange={(e) => {
                    setFilterOrg(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div>
                <label htmlFor="sort-by" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Сортировка
                </label>
                <select
                  id="sort-by"
                  className="discord-input w-full appearance-none pr-8"
                  style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                  value={`${sortField}-${sortDirection}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-');
                    setSortField(field);
                    setSortDirection(direction as 'asc' | 'desc');
                    setCurrentPage(1);
                  }}
                >
                  <option value="id-desc">ID (новые сверху)</option>
                  <option value="id-asc">ID (старые сверху)</option>
                  <option value="organization_name-asc">Организация (А-Я)</option>
                  <option value="organization_name-desc">Организация (Я-А)</option>
                  <option value="implementation_date-asc">Дата реализации (возр.)</option>
                  <option value="implementation_date-desc">Дата реализации (убыв.)</option>
                  <option value="status-asc">Статус (А-Я)</option>
                  <option value="status-desc">Статус (Я-А)</option>
                </select>
              </div>
            </div>

            {isLoadingRequests ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="discord-glass p-8 flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-discord-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-discord-text">Заявки отсутствуют</h3>
                <p className="text-discord-text-muted mt-2 max-w-md">
                  {totalItems > 0 
                    ? "По заданным критериям поиска не найдено заявок." 
                    : "В данный момент в системе нет ни одной заявки."}
                </p>
              </div>
            ) : (
              <>
                {totalItems > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mb-4">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`discord-btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      &laquo; Предыдущая
                    </button>
                    <span className="text-discord-text">
                      Страница {currentPage} из {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`discord-btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Следующая &raquo;
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto max-h-96">
                  <table className="discord-table w-full table-fixed">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th 
                          className="discord-table-header p-1.5 w-[8%] cursor-pointer hover:bg-discord-darker" 
                          onClick={() => handleSort('id')}
                        >
                          ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                          className="discord-table-header p-1.5 w-[25%] cursor-pointer hover:bg-discord-darker" 
                          onClick={() => handleSort('organization_name')}
                        >
                          Организация {sortField === 'organization_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="discord-table-header p-1.5 w-[15%]">ИНН</th>
                        <th 
                          className="discord-table-header p-1.5 w-[15%] cursor-pointer hover:bg-discord-darker" 
                          onClick={() => handleSort('implementation_date')}
                        >
                          Дата {sortField === 'implementation_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="discord-table-header p-1.5 w-[7%]">ФЗ</th>
                        <th 
                          className="discord-table-header p-1.5 w-[15%] cursor-pointer hover:bg-discord-darker" 
                          onClick={() => handleSort('status')}
                        >
                          Статус {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => (
                        <tr
                          key={request.id}
                          className="discord-table-row cursor-pointer hover:bg-discord-medium transition-colors duration-200"
                          onClick={() => handleRowClick(request)}
                        >
                          <td className="p-1.5 text-discord-text text-xs whitespace-nowrap overflow-hidden text-ellipsis">#{request.id}</td>
                          <td className="p-1.5 text-discord-text font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis">{request.organization_name}</td>
                          <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis">{request.inn}</td>
                          <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                            {formatDate(request.implementation_date)}
                          </td>
                          <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                            {request.fz_type} ФЗ
                          </td>
                          <td className="p-1.5 text-xs">
                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                              <span className="w-1 h-1 bg-current rounded-full mr-1 opacity-70"></span>
                              {request.status}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalItems > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`discord-btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      &laquo; Предыдущая
                    </button>
                    <span className="text-discord-text">
                      Страница {currentPage} из {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`discord-btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Следующая &raquo;
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedRequest && (
            <RequestDetailsModal
              isOpen={true}
              onClose={() => router.replace("/manager", { scroll: false })}
              request={selectedRequest}
              isLoadingDetails={isLoadingDetails}
              downloadingFile={mutationDownloadFile.isPending}
              fileDownloadError={fileDownloadError}
              onDownloadFile={handleDownloadFile}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              isManager={true}
              onUpdateStatus={handleUpdateStatus}
              onDeleteRequest={handleDeleteRequest}
              updatingStatus={mutationUpdateStatus.isPending}
              deleting={mutationDelete.isPending}
              statusUpdateError={statusUpdateError}
              deleteError={deleteError}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}