"use client";

import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateRequestStatus } from "@/services/managerRequestService";
import { Request } from "@/services/requestService";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusUpdateModal from "@/components/StatusUpdateModal";
import { formatDate } from "@/utils/formatters";
import { useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/table/DataTable";
import type { Column } from "@/components/table/types";
import ManagerFilters from "./ManagerFilters";
import { useManagerFilters } from "@/hooks/useManagerFilters";
import { useManagerRequests } from "@/hooks/useManagerRequests";
import { useFilesMenu } from "@/hooks/useFilesMenu";

// Number of items per page
const ITEMS_PER_PAGE = 10;

// Backend sort field mapping whitelist
const SORT_FIELD_MAP = {
  id: 'id',
  partner_name: 'partner_name',
  end_client_name: 'end_client_name',
  status: 'status',
  created_at: 'created_at',
} as const;

type SortField = keyof typeof SORT_FIELD_MAP;

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
  const { filterStatus, filterOrg, setFilterStatus, setFilterOrg, debouncedOrg, updateUrl, resetFilters, currentPage } = useManagerFilters();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // currentPage handled by useManagerFilters

  // Sorting state (sync with URL)
  const initialSortBy = (searchParams.get('sort_by') as SortField) || 'created_at';
  const [sortBy, setSortBy] = useState<SortField>(initialSortBy in SORT_FIELD_MAP ? initialSortBy : 'created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'
  );

  // updateUrl comes from useManagerFilters

  // Validated sortBy sent to backend
  const backendSortBy = SORT_FIELD_MAP[sortBy];

  const { data: requestsData, isLoading, isFetching, error } = useManagerRequests({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    statusFilter: filterStatus,
    orgFilter: debouncedOrg,
    sortBy: backendSortBy,
    sortOrder,
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

  // Sorting helper
  const toggleSort = (column: SortField) => {
    if (!(column in SORT_FIELD_MAP)) return;
    if (sortBy === column) {
      const next = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(next);
      updateUrl(currentPage, filterStatus, filterOrg, { sort_by: column, sort_order: next });
    } else {
      setSortBy(column);
      setSortOrder('asc');
      updateUrl(currentPage, filterStatus, filterOrg, { sort_by: column, sort_order: 'asc' });
    }
  };

  const { openMenuId, filesCache, toggleFilesMenu, handleDownloadAll, handleDownloadFile } = useFilesMenu();

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

  const SkeletonRow = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-center p-3 rounded-lg bg-discord-background animate-pulse">
      <div className="col-span-full md:col-span-1 h-4 bg-discord-border/50 rounded" />
      <div className="col-span-full md:col-span-3 h-4 bg-discord-border/50 rounded" />
      <div className="col-span-full md:col-span-3 h-4 bg-discord-border/50 rounded" />
      <div className="col-span-full md:col-span-2 h-6 bg-discord-border/50 rounded-full" />
      <div className="col-span-full md:col-span-2 h-4 bg-discord-border/50 rounded" />
      <div className="col-span-full md:col-span-1 h-6 bg-discord-border/50 rounded" />
    </div>
  );

  const SortHeader = ({ column, label, align = 'left' }: { column: SortField; label: string; align?: 'left' | 'right' }) => {
    const isActive = sortBy === column;
    const ariaSort = isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = !isActive ? (
      <span className="opacity-40">↕</span>
    ) : sortOrder === 'asc' ? (
      <span>▲</span>
    ) : (
      <span>▼</span>
    );
    return (
      <button
        onClick={() => toggleSort(column)}
        className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'} hover:text-discord-accent transition-colors`}
        title={`Сортировать по ${label.toLowerCase()}`}
        role="columnheader"
        aria-sort={ariaSort as 'none' | 'ascending' | 'descending'}
      >
        <span>{label}</span>
        <span className="text-xs">{arrow}</span>
      </button>
    );
  };

  const renderContent = () => {
    if (isLoading && !requestsData) {
      return (
        <div className="space-y-3" role="table" aria-busy="true" aria-label="Заявки менеджера">
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-discord-danger/10 border border-discord-danger/30 rounded-md p-4 mb-4 text-center" role="alert" aria-live="assertive">
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
        <div className="text-center py-8 bg-discord-background rounded-md" role="note" aria-live="polite">
          <p className="text-discord-text-muted mb-2">Заявок, соответствующих фильтрам, не найдено.</p>
          {(filterStatus || filterOrg) && (
            <button onClick={handleResetFilters} className="text-discord-accent hover:underline">
              Сбросить фильтры
            </button>
          )}
        </div>
      );
    }

    const columns: Array<Column<Request>> = [
      { id: 'id', header: 'ID', sortable: true, className: 'col-span-full md:col-span-1', accessor: (r) => (
        <span onClick={() => handleRowClick(r.id)} className="cursor-pointer hover:underline">#{r.id}</span>
      )},
      { id: 'partner_name', header: 'Партнер', sortable: true, className: 'col-span-full md:col-span-3', accessor: (r) => (
        <span title={r.partner?.name ?? 'Н/Д'} className="truncate block">{r.partner?.name ?? 'Н/Д'}</span>
      )},
      { id: 'end_client_name', header: 'Конечный клиент', sortable: true, className: 'col-span-full md:col-span-3', accessor: (r) => (
        <span title={r.end_client?.name ?? 'Н/Д'} className="truncate block text-discord-text-secondary">{r.end_client?.name ?? 'Н/Д'}</span>
      )},
      { id: 'status', header: 'Статус', sortable: true, className: 'col-span-full md:col-span-2', cell: (r) => (
        <div className="text-xs flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleOpenModal(r); }} className={`border text-xs rounded-full px-3 py-1.5 transition-colors duration-200 ${getStatusClasses(r.status)} hover:opacity-80`}>
            {r.status}
          </button>
          {r.manager_comment && <span title="Есть комментарий" className="inline-block w-2.5 h-2.5 rounded-full bg-discord-accent" />}
        </div>
      )},
      { id: 'created_at', header: 'Создана', sortable: true, align: 'right', className: 'col-span-full md:col-span-2 md:text-right', accessor: (r) => (
        <span>{formatDate(r.created_at)}</span>
      )},
      { id: 'files', header: 'Файлы', className: 'col-span-full md:col-span-1', cell: (r) => (
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); toggleFilesMenu(r.id); }} className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-discord-border" title="Вложения">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6.75v8.25a4.5 4.5 0 11-9 0V5.25a2.25 2.25 0 114.5 0v8.25a.75.75 0 11-1.5 0V5.25a.75.75 0 00-1.5 0v9.75a3 3 0 106 0V6.75a.75.75 0 111.5 0z"/></svg>
            <span className="hidden md:inline">Файлы</span>
          </button>
          {openMenuId === r.id && (
            <div className="absolute right-0 mt-2 w-64 z-10 bg-discord-card border border-discord-border rounded shadow-lg p-2">
              {filesCache[r.id]?.loading && (<div className="p-3 text-sm text-discord-text-muted">Загрузка...</div>)}
              {filesCache[r.id]?.error && (<div className="p-3 text-sm text-discord-danger">{filesCache[r.id]?.error}</div>)}
              {filesCache[r.id]?.files && filesCache[r.id]!.files!.length > 0 ? (
                <div className="space-y-1">
                  <button onClick={(e) => { e.stopPropagation(); handleDownloadAll(r.id); }} className="w-full flex items-center gap-2 text-left text-xs px-2 py-1 rounded hover:bg-discord-input">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.75a.75.75 0 01.75.75v8.19l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0L7.72 11.28a.75.75 0 111.06-1.06l2.47 2.47V4.5a.75.75 0 01.75-.75z"/><path d="M4.5 15.75a.75.75 0 01.75.75v1.5A1.5 1.5 0 006.75 19.5h10.5a1.5 1.5 0 001.5-1.5v-1.5a.75.75 0 011.5 0v1.5A3 3 0 0117.25 21H6.75A3 3 0 013.75 18v-1.5a.75.75 0 01.75-.75z"/></svg>
                    Скачать все
                  </button>
                  <div className="max-h-56 overflow-auto divide-y divide-discord-border/50">
                    {filesCache[r.id]!.files!.map((f) => (
                      <button key={f.id} onClick={(e) => { e.stopPropagation(); handleDownloadFile(f.id, f.file_name); }} className="w-full text-left text-xs px-2 py-2 hover:bg-discord-input flex items-center gap-2" title={f.file_name}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-discord-text-muted" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3.75A2.25 2.25 0 015.75 6v12A2.25 2.25 0 008 20.25h8A2.25 2.25 0 0018.25 18V8.56a2.25 2.25 0 00-.66-1.59l-2.56-2.56a2.25 2.25 0 00-1.59-.66H8z"/></svg>
                        <span className="truncate">{f.file_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (!filesCache[r.id]?.loading && !filesCache[r.id]?.error) ? (
                <div className="p-3 text-sm text-discord-text-muted">Файлы отсутствуют</div>
              ) : null}
            </div>
          )}
        </div>
      )},
    ];

    return (
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading && !requestsData}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(id) => toggleSort(id as any)}
        getRowKey={(r) => r.id}
        tableLabel="Заявки менеджера"
      />
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
          
          <ManagerFilters
            status={filterStatus}
            org={filterOrg}
            onChangeStatus={setFilterStatus}
            onChangeOrg={setFilterOrg}
            onApply={() => updateUrl(1, filterStatus, filterOrg, { sort_by: sortBy, sort_order: sortOrder })}
            onReset={resetFilters}
          />

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