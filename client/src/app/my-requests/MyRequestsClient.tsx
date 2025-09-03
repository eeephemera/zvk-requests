"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { getUserRequests, Request } from "@/services/requestService";
import { ApiError, PaginatedResponse } from "@/services/apiClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { formatDate } from "@/utils/formatters";
import { getStatusColor } from "@/utils/statusUtils";
import DataTable from "@/components/table/DataTable";
import type { Column } from "@/components/table/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// Константа для количества элементов на странице
const ITEMS_PER_PAGE = 10;

export default function MyRequestsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  // Запрос для получения заявок
  const { 
    data: requestsData, 
    isLoading,
    isFetching,
    isError,
    error 
  } = useQuery<PaginatedResponse<Request>, ApiError | Error | null>({
    queryKey: ['userRequests', currentPage, ITEMS_PER_PAGE],
    queryFn: () => getUserRequests(currentPage, ITEMS_PER_PAGE),
  });

  // Мемоизированные значения для предотвращения лишних ререндеров
  const totalRequests = useMemo(() => requestsData?.total ?? 0, [requestsData]);
  const requests = useMemo(() => requestsData?.items ?? [], [requestsData]);

  // Client-side filters & sorting
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchOrg, setSearchOrg] = useState<string>("");
  const debouncedOrg = useDebouncedValue(searchOrg, 400);
  const [sortBy, setSortBy] = useState<'id' | 'end_client_name' | 'status' | 'created_at'>("created_at");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const statusOk = statusFilter ? r.status === statusFilter : true;
      const orgName = r.end_client?.name?.toLowerCase() || "";
      const orgOk = debouncedOrg ? orgName.includes(debouncedOrg.toLowerCase()) : true;
      return statusOk && orgOk;
    });
  }, [requests, statusFilter, debouncedOrg]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortOrder === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = (() => {
        switch (sortBy) {
          case 'id': return a.id;
          case 'end_client_name': return (a.end_client?.name || "").toLowerCase();
          case 'status': return a.status;
          case 'created_at': return a.created_at;
        }
      })();
      const bv = (() => {
        switch (sortBy) {
          case 'id': return b.id;
          case 'end_client_name': return (b.end_client?.name || "").toLowerCase();
          case 'status': return b.status;
          case 'created_at': return b.created_at;
        }
      })();
      if (sortBy === 'id') return (av as number) > (bv as number) ? dir : (av as number) < (bv as number) ? -dir : 0;
      if (sortBy === 'created_at') return new Date(av as string).getTime() > new Date(bv as string).getTime() ? dir : new Date(av as string).getTime() < new Date(bv as string).getTime() ? -dir : 0;
      return ('' + av).localeCompare('' + bv) * dir;
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const toggleSort = (column: 'id' | 'end_client_name' | 'status' | 'created_at') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };
  
  const requestError = useMemo(() => {
    if (!isError || !error) return null;
    if (error instanceof ApiError) {
      if (error.status >= 500) return "Ошибка на сервере. Попробуйте обновить страницу.";
      if (error.status === 401 || error.status === 403) return "Ошибка доступа.";
      return error.message;
    }
    return error instanceof Error ? error.message : 'Произошла ошибка при загрузке заявок.';
  }, [isError, error]);
  
  const totalPages = useMemo(() => Math.ceil(totalRequests / ITEMS_PER_PAGE) || 1, [totalRequests]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      router.push(`/my-requests?page=${page}`);
    }
  };
  
  const handleRowClick = (requestId: number) => {
    router.push(`/my-requests/${requestId}`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
        </div>
      );
    }

    if (requestError) {
      return (
        <div className="m-5 text-center">
          <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
            <p className="text-discord-danger">{requestError}</p>
          </div>
        </div>
      );
    }

    if (totalRequests === 0) {
      return (
        <div className="discord-glass p-8 flex flex-col items-center justify-center text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-discord-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-medium text-discord-text">У вас пока нет регистраций</h3>
          <p className="text-sm text-discord-text-muted mt-1">Здесь будут отображаться все ваши сделки.</p>
          <Link href="/deal-registration" className="discord-btn-primary mt-4">
            Создать первую регистрацию
          </Link>
        </div>
      );
    }

    const columns: Array<Column<Request>> = [
      { id: 'id', header: 'ID', sortable: true, className: 'col-span-12 md:col-span-1', accessor: (r) => (
        <span className="md:hidden font-bold text-discord-text-muted">ID: </span>
      ) },
      { id: 'id-value', header: '', className: 'hidden md:block md:col-span-0', accessor: (r) => (
        <span>#{r.id}</span>
      ) },
      { id: 'end_client_name', header: 'Конечный клиент', sortable: true, className: 'col-span-12 md:col-span-4', accessor: (r) => (
        <div title={r.end_client?.name ?? 'Не указан'} className="truncate">
          {r.end_client?.name ?? 'Не указан'}
          {r.manager_comment && (
            <div className="mt-1 flex items-start gap-2 text-xs text-discord-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v7.5A2.25 2.25 0 0117.25 16.5H9l-3.53 2.353A.75.75 0 013.75 18.25V6.75z"/></svg>
              <span className="truncate" title={r.manager_comment}>{r.manager_comment}</span>
            </div>
          )}
        </div>
      ) },
      { id: 'product', header: 'Продукт/Услуга', className: 'col-span-12 md:col-span-3', accessor: (r) => (
        <span className="truncate block text-discord-text-secondary" title={r.items && r.items.length > 0 ? (r.items[0].product?.name ?? r.items[0].custom_item_name ?? 'Кастомный') : 'Нет данных'}>
          {(r.items && r.items.length > 0 ? (r.items[0].product?.name ?? r.items[0].custom_item_name) : 'Нет данных')}
          {r.items && r.items.length > 1 && <span className="text-xs"> (и еще {r.items.length - 1})</span>}
        </span>
      ) },
      { id: 'status', header: 'Статус', sortable: true, className: 'col-span-12 md:col-span-2', accessor: (r) => (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>
          {r.status}
        </div>
      ) },
      { id: 'created_at', header: 'Создана', sortable: true, className: 'col-span-12 md:col-span-2 md:text-right', accessor: (r) => (
        <span>{formatDate(r.created_at)}</span>
      ) },
    ];

    return (
      <>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-discord-text-muted">Статус</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="discord-input">
              <option value="">Все статусы</option>
              <option value="На рассмотрении">На рассмотрении</option>
              <option value="В работе">В работе</option>
              <option value="На уточнении">На уточнении</option>
              <option value="Одобрена">Одобрена</option>
              <option value="Отклонена">Отклонена</option>
              <option value="Завершена">Завершена</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-discord-text-muted">Организация</label>
            <input type="text" value={searchOrg} onChange={(e) => setSearchOrg(e.target.value)} placeholder="Поиск по организации..." className="discord-input" />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={sorted}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(id) => toggleSort(id as any)}
          getRowKey={(r) => r.id}
          tableLabel="Мои регистрации"
        />

        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="discord-btn-secondary transition-colors duration-200">&laquo; Назад</button>
            <span className="text-discord-text-muted text-sm">Страница {currentPage} из {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="discord-btn-secondary transition-colors duration-200">Вперед &raquo;</button>
          </div>
        )}
      </>
    );
  };
  
  return (
    <ProtectedRoute allowedRoles={["USER"]}>
      <div className="container mx-auto p-4 sm:p-6">
        <div className="bg-discord-card border border-discord-border rounded-lg w-full max-w-6xl p-6 mx-auto relative">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-discord-text flex items-center">
              <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
              Мои регистрации
            </h1>
            <Link
              href="/deal-registration"
              className="discord-btn-primary transition-colors duration-200"
            >
              Новая регистрация
            </Link>
          </div>
          {isFetching && (
            <div className="absolute top-5 right-5" aria-label="Идет обновление данных" role="status">
              <div className="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </ProtectedRoute>
  );
} 