"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAllRequests, 
  updateRequestStatus,
  deleteRequest
} from "@/services/managerRequestService";
import { Request } from "@/services/requestService";
import { ApiError, PaginatedResponse } from '@/services/apiClient';
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";

// Number of items per page
const ITEMS_PER_PAGE = 10;

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function ManagerPage({ searchParams }: Partial<PageProps>) {
  // State variables
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOrg, setFilterOrg] = useState<string>('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const queryClient = useQueryClient();

  // Fetch requests with pagination and filters
  const { 
    data: requestsData,
    isLoading,
    error,
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
    // Добавляем параметры для предотвращения избыточных запросов
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 секунд
    retry: 1, // Одна повторная попытка при ошибке
  });

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
      queryClient.invalidateQueries({ queryKey: ['managerRequests'] });
    }
  });

  // Handler functions
  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      await statusMutation.mutateAsync({ id, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (confirm("Вы уверены, что хотите удалить эту заявку?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting request:', error);
      }
    }
  };

  // Filter handlers
  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
    queryClient.invalidateQueries({ queryKey: ['managerRequests'] });
  };

  const handleSortChange = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Отображаем интерфейс внутри ProtectedRoute для обеспечения доступа только пользователям с ролью MANAGER
  return (
    <ProtectedRoute allowedRoles={["MANAGER"]}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-discord-text mb-6">Панель менеджера</h1>
        
        {/* Filters */}
        <div className="mb-4 flex gap-4">
          <select 
            value={filterStatus} 
            onChange={(e) => {
              setFilterStatus(e.target.value);
              handleFilterChange();
            }}
            className="py-2 px-4 bg-discord-input border border-discord-border rounded-md text-discord-text"
          >
            <option value="">Все статусы</option>
            <option value="На рассмотрении">На рассмотрении</option>
            <option value="В работе">В работе</option>
            <option value="Завершена">Завершена</option>
            <option value="Отклонена">Отклонена</option>
          </select>

          <input
            type="text"
            value={filterOrg}
            onChange={(e) => {
              setFilterOrg(e.target.value);
              handleFilterChange();
            }}
            placeholder="Фильтр по организации..."
            className="py-2 px-4 bg-discord-input border border-discord-border rounded-md text-discord-text"
          />
        </div>

        {/* Состояние загрузки */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-discord-accent"></div>
          </div>
        )}

        {/* Состояние ошибки */}
        {error && (
          <div className="bg-discord-danger/10 border border-discord-danger/30 rounded-md p-4 mb-4">
            <p className="text-discord-danger text-center">
              Ошибка загрузки данных: {error.message || "Не удалось загрузить заявки"}
            </p>
            <div className="flex justify-center mt-4">
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['managerRequests'] })}
                className="bg-discord-button-primary text-white py-2 px-4 rounded-md hover:bg-opacity-80"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}

        {/* Нет данных */}
        {!isLoading && !error && (!requestsData || requestsData.items.length === 0) && (
          <div className="text-center py-8 bg-discord-card rounded-md">
            <p className="text-discord-text-muted mb-2">Нет заявок, соответствующих выбранным фильтрам</p>
            {filterStatus || filterOrg ? (
              <button
                onClick={() => {
                  setFilterStatus('');
                  setFilterOrg('');
                  handleFilterChange();
                }}
                className="text-discord-accent hover:underline"
              >
                Сбросить фильтры
              </button>
            ) : null}
          </div>
        )}

        {/* Requests table */}
        {!isLoading && !error && requestsData && requestsData.items.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-discord-border">
            <table className="w-full divide-y divide-discord-border">
              <thead className="bg-discord-card">
                <tr>
                  <th 
                    onClick={() => handleSortChange('id')}
                    className="px-6 py-3 text-left cursor-pointer hover:bg-discord-secondary/20 transition-colors"
                  >
                    ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left">Организация</th>
                  <th className="px-6 py-3 text-left">ИНН</th>
                  <th className="px-6 py-3 text-left">Статус</th>
                  <th className="px-6 py-3 text-left">Дата создания</th>
                  <th className="px-6 py-3 text-left">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-discord-secondary/5 divide-y divide-discord-border">
                {requestsData.items.map((request) => (
                  <tr key={request.id} className="hover:bg-discord-secondary/10">
                    <td className="px-6 py-4">#{request.id}</td>
                    <td className="px-6 py-4">{request.partner?.name || 'Н/Д'}</td>
                    <td className="px-6 py-4">{request.partner?.inn || 'Н/Д'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium
                        ${request.status === 'На рассмотрении' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${request.status === 'В работе' ? 'bg-blue-100 text-blue-800' : ''}
                        ${request.status === 'Завершена' ? 'bg-green-100 text-green-800' : ''}
                        ${request.status === 'Отклонена' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(request.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={request.status}
                        onChange={(e) => handleStatusUpdate(request.id, e.target.value)}
                        className="mr-2 py-1 px-2 bg-discord-input border border-discord-border rounded-md text-discord-text text-sm"
                      >
                        <option value="На рассмотрении">На рассмотрении</option>
                        <option value="В работе">В работе</option>
                        <option value="Завершена">Завершена</option>
                        <option value="Отклонена">Отклонена</option>
                      </select>
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        className="text-discord-danger hover:text-discord-danger/80 text-sm ml-3"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && requestsData && requestsData.total > ITEMS_PER_PAGE && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md ${currentPage === 1 
                ? 'bg-discord-secondary/20 text-discord-text-muted cursor-not-allowed' 
                : 'bg-discord-secondary/30 text-discord-text hover:bg-discord-secondary/50'}`}
            >
              &laquo; Назад
            </button>
            
            {Array.from(
              { length: Math.min(5, Math.ceil(requestsData.total / ITEMS_PER_PAGE)) }, 
              (_, i) => {
                // Показываем максимум 5 страниц вокруг текущей
                const totalPages = Math.ceil(requestsData.total / ITEMS_PER_PAGE);
                let pageToShow = i + 1;
                
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    pageToShow = i + currentPage - 2;
                  }
                  
                  if (pageToShow > totalPages) {
                    return null;
                  }
                }
                
                return (
                  <button
                    key={pageToShow}
                    onClick={() => setCurrentPage(pageToShow)}
                    className={`px-3 py-1 rounded-md ${currentPage === pageToShow 
                      ? 'bg-discord-accent text-white' 
                      : 'bg-discord-secondary/30 text-discord-text hover:bg-discord-secondary/50'}`}
                  >
                    {pageToShow}
                  </button>
                );
              }
            ).filter(Boolean)}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(requestsData.total / ITEMS_PER_PAGE)))}
              disabled={currentPage === Math.ceil(requestsData.total / ITEMS_PER_PAGE)}
              className={`px-3 py-1 rounded-md ${currentPage === Math.ceil(requestsData.total / ITEMS_PER_PAGE) 
                ? 'bg-discord-secondary/20 text-discord-text-muted cursor-not-allowed' 
                : 'bg-discord-secondary/30 text-discord-text hover:bg-discord-secondary/50'}`}
            >
              Вперед &raquo;
            </button>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}