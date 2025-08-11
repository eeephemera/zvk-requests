"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAllRequests, 
  updateRequestStatus,
  downloadAllFiles,
  getQuickFilesAction
} from "@/services/managerRequestService";
import { Request } from "@/services/requestService";
import { ApiError, PaginatedResponse, fetchBlobWithFilename } from '@/services/apiClient';
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusUpdateModal from "@/components/StatusUpdateModal";
import { formatDate } from "@/utils/formatters";
import { useRouter, useSearchParams } from "next/navigation";

// Number of items per page
const ITEMS_PER_PAGE = 10;

// Новая, более гибкая функция для получения классов статуса
const getStatusClasses = (status: string): string => {
    switch (status) {
        case 'На рассмотрении':
            return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        case 'В работе':
            return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        case 'На уточнении':
            return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        case 'Одобрена':
            return 'bg-green-500/10 text-green-400 border-green-500/20';
        case 'Завершена':
            return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        case 'Отклонена':
            return 'bg-red-500/10 text-red-400 border-red-500/20';
        default:
            return 'bg-gray-700 text-gray-300';
    }
};

export default function ManagerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // State variables
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterOrg, setFilterOrg] = useState<string>(searchParams.get('org') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const currentPage = Number(searchParams.get('page') || '1');

  // Update URL when filters change
  const updateUrl = (page: number, status: string, org: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (status) params.set('status', status);
    if (org) params.set('org', org);
    router.push(`/manager?${params.toString()}`);
  };

  const { 
    data: requestsData,
    isLoading,
    isFetching,
    error,
  } = useQuery<PaginatedResponse<Request>, ApiError>({
    queryKey: ['managerRequests', currentPage, filterStatus, filterOrg],
    queryFn: () => getAllRequests(
      currentPage,
      ITEMS_PER_PAGE,
      filterStatus,
      filterOrg,
      'created_at',
      'desc'
    ),
    refetchOnWindowFocus: false,
    staleTime: 30000,
    retry: 1,
  });

  const requests = useMemo(() => requestsData?.items ?? [], [requestsData]);
  const totalPages = useMemo(() => Math.ceil((requestsData?.total ?? 0) / ITEMS_PER_PAGE) || 1, [requestsData]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: number; status: string; comment: string }) => 
      updateRequestStatus(id, status, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerRequests'] });
      setIsModalOpen(false);
      setSelectedRequest(null);
    }
  });

  const handleOpenModal = (request: Request) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = (newStatus: string, comment: string) => {
    if (selectedRequest) {
      statusMutation.mutate({ id: selectedRequest.id, status: newStatus, comment });
    }
  };

  const handleFilter = () => {
    updateUrl(1, filterStatus, filterOrg);
  };
  
  const handleResetFilters = () => {
    setFilterStatus('');
    setFilterOrg('');
    updateUrl(1, '', '');
  };

  const handleRowClick = (id: number) => {
     router.push(`/manager/requests/${id}`);
  };

  // Files menu state
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [filesCache, setFilesCache] = useState<Record<number, { loading: boolean; files?: Array<{ id: number; file_name: string; mime_type: string; file_size: number }>; error?: string }>>({});

  const toggleFilesMenu = async (requestId: number) => {
    if (openMenuId === requestId) {
      setOpenMenuId(null);
      return;
    }
    // Load files and decide behavior
    setFilesCache(prev => ({ ...prev, [requestId]: prev[requestId] || { loading: true } }));
    try {
      const action = await getQuickFilesAction(requestId);
      if (action.type === 'single') {
        // direct download
        if (action.file.id) {
          await handleDownloadFile(action.file.id, action.file.file_name);
        }
        // keep menu closed
        setOpenMenuId(null);
        setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, files: action.file.id ? [{ id: action.file.id, file_name: action.file.file_name, mime_type: '', file_size: 0 }] : [] } }));
      } else {
        // open menu and show list
        setOpenMenuId(requestId);
        setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, files: action.files.map(f => ({ id: f.id, file_name: f.file_name, mime_type: '', file_size: 0 })) } }));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Ошибка загрузки файлов';
      setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, error: message } }));
    }
  };

  const handleDownloadAll = async (requestId: number) => {
    await downloadAllFiles(requestId);
  };

  const handleDownloadFile = async (fileId: number, fallbackName?: string) => {
    const { blob, filename } = await fetchBlobWithFilename(`/api/manager/requests/files/${fileId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || fallbackName || `file-${fileId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isModalOpen]);

  const renderContent = () => {
    if (isLoading && !requestsData) {
      return (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-discord-accent"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-discord-danger/10 border border-discord-danger/30 rounded-md p-4 mb-4 text-center">
          <p className="text-discord-danger">Ошибка загрузки данных: {error.message}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['managerRequests'] })}
            className="discord-btn-primary mt-4"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    
    if (requests.length === 0) {
      return (
        <div className="text-center py-8 bg-discord-background rounded-md">
          <p className="text-discord-text-muted mb-2">Заявок, соответствующих фильтрам, не найдено.</p>
          {(filterStatus || filterOrg) && (
            <button onClick={handleResetFilters} className="text-discord-accent hover:underline">
              Сбросить фильтры
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Table Header for Desktop */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-discord-text-muted uppercase">
          <div className="col-span-1">ID</div>
          <div className="col-span-3">Партнер</div>
          <div className="col-span-3">Конечный клиент</div>
          <div className="col-span-2">Статус</div>
          <div className="col-span-2 text-right">Создана</div>
          <div className="col-span-1">Файлы</div>
        </div>

        {requests.map((req) => (
          <div
            key={req.id}
            className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-center p-3 rounded-lg bg-discord-background hover:bg-discord-input transition-colors duration-200"
          >
            {/* ID */}
            <div className="col-span-full md:col-span-1 text-sm text-discord-text-muted">
                <span onClick={() => handleRowClick(req.id)} className="cursor-pointer hover:underline">
                    #{req.id}
                </span>
            </div>
            {/* Partner */}
            <div className="col-span-full md:col-span-3 text-sm font-medium text-discord-text truncate" title={req.partner?.name ?? 'Н/Д'}>
              {req.partner?.name ?? 'Н/Д'}
            </div>
            {/* End Client */}
            <div className="col-span-full md:col-span-3 text-sm text-discord-text-secondary truncate" title={req.end_client?.name ?? 'Н/Д'}>
               {req.end_client?.name ?? 'Н/Д'}
            </div>
             {/* Status + comment indicator */}
            <div className="col-span-full md:col-span-2 text-xs flex items-center gap-2">
                 <button
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(req); }}
                    className={`border text-xs rounded-full px-3 py-1.5 transition-colors duration-200 ${getStatusClasses(req.status)} hover:opacity-80`}
                  >
                    {req.status}
                 </button>
                 {req.manager_comment && (
                   <span title="Есть комментарий" className="inline-block w-2.5 h-2.5 rounded-full bg-discord-accent" />
                 )}
            </div>
             {/* Created At */}
            <div className="col-span-full md:col-span-2 text-sm text-discord-text-muted md:text-right">
              {formatDate(req.created_at)}
            </div>
            {/* Quick file actions */}
            <div className="col-span-full md:col-span-1 relative">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFilesMenu(req.id); }}
                className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-discord-border"
                title="Вложения"
              >
                {/* Paperclip icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6.75v8.25a4.5 4.5 0 11-9 0V5.25a2.25 2.25 0 114.5 0v8.25a.75.75 0 11-1.5 0V5.25a.75.75 0 00-1.5 0v9.75a3 3 0 106 0V6.75a.75.75 0 111.5 0z"/></svg>
                <span className="hidden md:inline">Файлы</span>
              </button>
              {openMenuId === req.id && (
                <div className="absolute right-0 mt-2 w-64 z-10 bg-discord-card border border-discord-border rounded shadow-lg p-2">
                  {filesCache[req.id]?.loading && (
                    <div className="p-3 text-sm text-discord-text-muted">Загрузка...</div>
                  )}
                  {filesCache[req.id]?.error && (
                    <div className="p-3 text-sm text-discord-danger">{filesCache[req.id]?.error}</div>
                  )}
                  {filesCache[req.id]?.files && filesCache[req.id]!.files!.length > 0 ? (
                    <div className="space-y-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadAll(req.id); }}
                        className="w-full flex items-center gap-2 text-left text-xs px-2 py-1 rounded hover:bg-discord-input"
                      >
                        {/* Download icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.75a.75.75 0 01.75.75v8.19l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0L7.72 11.28a.75.75 0 111.06-1.06l2.47 2.47V4.5a.75.75 0 01.75-.75z"/><path d="M4.5 15.75a.75.75 0 01.75.75v1.5A1.5 1.5 0 006.75 19.5h10.5a1.5 1.5 0 001.5-1.5v-1.5a.75.75 0 011.5 0v1.5A3 3 0 0117.25 21H6.75A3 3 0 013.75 18v-1.5a.75.75 0 01.75-.75z"/></svg>
                        Скачать все
                      </button>
                      <div className="max-h-56 overflow-auto divide-y divide-discord-border/50">
                        {filesCache[req.id]!.files!.map((f) => (
                          <button
                            key={f.id}
                            onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.file_name); }}
                            className="w-full text-left text-xs px-2 py-2 hover:bg-discord-input flex items-center gap-2"
                            title={f.file_name}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-discord-text-muted" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3.75A2.25 2.25 0 015.75 6v12A2.25 2.25 0 008 20.25h8A2.25 2.25 0 0018.25 18V8.56a2.25 2.25 0 00-.66-1.59l-2.56-2.56a2.25 2.25 0 00-1.59-.66H8z"/></svg>
                            <span className="truncate">{f.file_name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (!filesCache[req.id]?.loading && !filesCache[req.id]?.error) ? (
                    <div className="p-3 text-sm text-discord-text-muted">Файлы отсутствуют</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={["MANAGER"]}>
      <div className="container mx-auto p-4 sm:p-6">
        <div className="bg-discord-card border border-discord-border rounded-lg p-6 w-full mx-auto relative">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-discord-text flex items-center">
              <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
              Панель менеджера
            </h1>
            {isFetching && (
              <div className="absolute top-5 right-5" aria-label="Идет обновление данных" role="status">
                <div className="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="discord-input"
            >
              <option value="">Все статусы</option>
              <option value="На рассмотрении">На рассмотрении</option>
              <option value="В работе">В работе</option>
              <option value="Одобрена">Одобрена</option>
              <option value="Отклонена">Отклонена</option>
              <option value="Завершена">Завершена</option>
            </select>
            <input 
              type="text" 
              placeholder="Поиск по организации..."
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
              className="discord-input"
            />
            <button onClick={handleFilter} className="discord-btn-primary">Применить</button>
            <button onClick={handleResetFilters} className="discord-btn-secondary">Сбросить</button>
          </div>

          {renderContent()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-4">
              <button
                onClick={() => updateUrl(currentPage - 1, filterStatus, filterOrg)}
                disabled={currentPage === 1}
                className="discord-btn-secondary"
              >
                &laquo; Назад
              </button>
              <span className="text-discord-text-muted text-sm">
                Страница {currentPage} из {totalPages}
              </span>
              <button
                onClick={() => updateUrl(currentPage + 1, filterStatus, filterOrg)}
                disabled={currentPage === totalPages}
                className="discord-btn-secondary"
              >
                Вперед &raquo;
              </button>
            </div>
          )}
        </div>
      </div>
      <StatusUpdateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleStatusUpdate}
        request={selectedRequest}
      />
    </ProtectedRoute>
  );
} 