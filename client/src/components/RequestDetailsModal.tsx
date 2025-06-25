"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Request } from "../services/requestService";

interface RequestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: Request | null;
  isLoadingDetails: boolean;
  downloadingFile: boolean;
  fileDownloadError: string | null;
  onDownloadFile: (requestId: number) => void;
  formatDate: (dateString: string) => string;
  getStatusColor: (status: string) => string;
  // New props for manager functionality
  isManager?: boolean;
  onUpdateStatus?: (requestId: number, status: string) => void;
  onDeleteRequest?: (requestId: number) => void;
  updatingStatus?: boolean;
  deleting?: boolean;
  statusUpdateError?: string | null;
  deleteError?: string | null;
}

export default function RequestDetailsModal({
  isOpen,
  onClose,
  request,
  isLoadingDetails,
  downloadingFile,
  fileDownloadError,
  onDownloadFile,
  formatDate,
  getStatusColor,
  // Manager props with defaults
  isManager = false,
  onUpdateStatus,
  onDeleteRequest,
  updatingStatus = false,
  deleting = false,
  statusUpdateError = null,
  deleteError = null
}: RequestDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusValue, setStatusValue] = useState<string>("");
  
  // Set initial status value when request changes or loading finishes
  useEffect(() => {
    if (request && !isLoadingDetails) {
      setStatusValue(request.status);
    } else if (isLoadingDetails) {
      // Можно сбросить статус или оставить предыдущий, пока грузится
      // setStatusValue(""); // Опционально
    }
  }, [request, isLoadingDetails]);

  // Закрытие по клику вне модального окна
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // Only close if we're not in delete confirmation mode
        if (!showDeleteConfirm) {
          onClose();
        }
      }
    }

    // Закрытие по клавише Escape
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // First close delete confirmation if it's open
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Предотвращение прокрутки основной страницы
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = ''; // Восстановление прокрутки
    };
  }, [isOpen, onClose, showDeleteConfirm]);

  // Обработчик изменения статуса
  const handleStatusChange = () => {
    if (onUpdateStatus && request && statusValue !== request.status && !isLoadingDetails) {
      onUpdateStatus(request.id, statusValue);
    }
  };

  // Обработчик подтверждения удаления
  const handleConfirmDelete = () => {
    if (onDeleteRequest && request && !isLoadingDetails) {
      onDeleteRequest(request.id);
    }
  };

  if (!isOpen) return null;

  // Доступные статусы для выбора
  const availableStatuses = ["На рассмотрении", "В работе", "Выполнена", "Отклонена"];

  // Определяем классы для блюра и блокировки событий
  const blurClass = isLoadingDetails ? "blur-sm transition-all duration-300" : "transition-all duration-300";
  const pointerEventsClass = isLoadingDetails ? "pointer-events-none" : "";

  return createPortal(
    <div className="discord-modal-backdrop">
      {/* Delete confirmation dialog (без блюра) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-discord-darker p-6 rounded-lg shadow-2xl border border-discord-lightest max-w-md w-full animate-fadeIn">
            <h3 className="text-xl font-bold text-discord-danger mb-4">Подтверждение удаления</h3>
            <p className="text-discord-text mb-6">
              Вы уверены, что хотите удалить заявку #{request?.id ?? '...'}? Это действие нельзя отменить.
            </p>
            {deleteError && (
              <div className="p-3 mb-4 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
                <p className="text-discord-danger text-sm">{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="discord-btn-secondary"
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-discord-danger hover:bg-discord-danger-hover text-white px-4 py-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-discord-danger focus:ring-opacity-50"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Удаление...
                  </>
                ) : (
                  "Удалить"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main modal */}
      <div 
        ref={modalRef} 
        className="discord-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header (без блюра) */}
        <div className="discord-modal-header">
          <h2 id="modal-title" className="text-lg font-semibold text-discord-text flex items-center">
            <div className="w-1.5 h-5 bg-discord-accent rounded-full mr-2.5"></div>
             {/* Показываем ID даже во время загрузки, если он есть в request */}
            Информация о заявке #{request?.id ?? '...'}
          </h2>
          <button 
            onClick={onClose}
            className="text-discord-text-muted hover:text-discord-text transition-colors focus:outline-none focus:ring-2 focus:ring-discord-accent rounded-md p-1"
            aria-label="Закрыть"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* Обертка для основного контента с позиционированием для спиннера */} 
        <div className={`discord-modal-body relative ${pointerEventsClass}`}> 
           {/* Оверлей для индикатора загрузки поверх размытого контента */} 
           {isLoadingDetails && (
             <div className="absolute inset-0 bg-discord-card/50 flex items-center justify-center z-10 rounded-b-lg">
                 <div className="animate-spin w-8 h-8 border-4 border-discord-accent rounded-full border-t-transparent"></div>
             </div>
           )}
 
           {/* Основной контент модального окна (применяем блюр) */} 
           <div className={`${blurClass}`}> 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="space-y-4 animate-fadeIn delay-100">
                 <div className="discord-glass p-4">
                   <h3 className="text-sm font-medium text-discord-text-muted mb-3 uppercase tracking-wide">Информация о компании</h3>
                   <div className="space-y-3 text-discord-text">
                     {/* Применяем заглушки */}
                     <div>
                       <div className="text-xs text-discord-text-muted mb-1">ИНН</div>
                       <div className="font-medium">{request?.partner?.inn ?? '-'}</div>
                     </div>
                     <div>
                       <div className="text-xs text-discord-text-muted mb-1">Наименование организации</div>
                       <div className="font-medium">{request?.partner?.name ?? '-'}</div>
                     </div>
                     <div>
                       <div className="text-xs text-discord-text-muted mb-1">Дата реализации</div>
                       <div className="font-medium">{request ? formatDate(request.created_at) : '-'}</div>
                     </div>
                   </div>
                 </div>
                 
                 <div className="discord-glass p-4">
                    <h3 className="text-sm font-medium text-discord-text-muted mb-3 uppercase tracking-wide">Параметры</h3>
                   <div className="space-y-3 text-discord-text">
                      <div>
                        <div className="text-xs text-discord-text-muted mb-1">ФЗ</div>
                        <div className="font-medium">{request ? `${request.fz_type} ФЗ` : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-discord-text-muted mb-1">Тип реестра</div>
                        <div className="font-medium">
                          {request ? (request.registry_type === "registry" ? "Реестр" : "Нереестр") : '-'}
                        </div>
                      </div>
                   </div>
                 </div>
               </div>
               
               <div className="space-y-4 animate-fadeIn delay-200">
                 <div className="discord-glass p-4">
                   <h3 className="text-sm font-medium text-discord-text-muted mb-3 uppercase tracking-wide">Статус заявки</h3>
                   {isManager ? (
                     <div className="space-y-3">
                        <div className="flex flex-col">
                           <label htmlFor="status" className="text-xs text-discord-text-muted mb-1">Выберите статус</label>
                           <select 
                             id="status"
                             value={statusValue} // Используем локальное состояние
                             onChange={(e) => setStatusValue(e.target.value)}
                             className="discord-input appearance-none text-sm"
                             disabled={updatingStatus || isLoadingDetails} // Блокируем во время загрузки деталей
                           >
                             {availableStatuses.map(status => (
                               <option key={status} value={status}>{status}</option>
                             ))}
                           </select>
                        </div>
                        {/* Показываем кнопку, только если статус был изменен */}
                        {statusValue !== request?.status && (
                          <button 
                            onClick={handleStatusChange}
                            disabled={updatingStatus || isLoadingDetails} // Блокируем во время загрузки деталей
                            className="discord-btn-primary w-full text-sm"
                          >
                            {updatingStatus ? (
                              <>
                                <svg className="animate-spin h-4 w-4 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Сохранение...
                              </>
                            ) : (
                              'Сохранить статус'
                            )}
                          </button>
                        )}
                        {statusUpdateError && (
                           <p className="text-discord-danger text-xs mt-1">{statusUpdateError}</p>
                        )}
                     </div>
                   ) : (
                     // Отображение статуса для пользователя
                     <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${getStatusColor(request?.status ?? '')}`}>
                       <span className="w-2 h-2 bg-current rounded-full mr-1.5"></span>
                       {request?.status ?? '-'}
                     </div>
                   )}
                 </div>
                 
                 <div className="discord-glass p-4">
                   <h3 className="text-sm font-medium text-discord-text-muted mb-3 uppercase tracking-wide">Комментарий</h3>
                   <p className="text-discord-text text-sm whitespace-pre-wrap">
                     {/* Используем ?? для заглушки */}
                     {request?.comment || (isLoadingDetails ? '-' : 'Комментариев нет')}
                   </p>
                 </div>
 
                 <div className="discord-glass p-4">
                    <h3 className="text-sm font-medium text-discord-text-muted mb-3 uppercase tracking-wide">Файл ТЗ</h3>
                    <button 
                       onClick={() => request && !isLoadingDetails && onDownloadFile(request.id)} // Блокируем клик во время загрузки
                       disabled={downloadingFile || isLoadingDetails} // Блокируем кнопку
                       className="discord-btn-secondary w-full text-sm mt-2"
                    >
                      {downloadingFile ? (
                        <>
                         <svg className="animate-spin h-4 w-4 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Скачивание...
                        </>
                       ) : (
                          'Скачать файл'
                       )}
                    </button>
                    {fileDownloadError && (
                        <p className="text-discord-danger text-xs mt-1">{fileDownloadError}</p>
                    )}
                 </div>
               </div>
             </div>
           </div> 
         </div> 
         
         {/* Footer (без блюра) */}
         {isManager && (
             <div className="discord-modal-footer">
                 {deleteError && (
                    <p className="text-discord-danger text-sm mr-auto">{deleteError}</p>
                  )}
                 <button 
                   onClick={() => setShowDeleteConfirm(true)}
                   className="discord-btn-danger text-sm"
                   disabled={deleting || isLoadingDetails} // Блокируем кнопку
                 >
                   Удалить заявку
                 </button>
             </div>
         )}
       </div> 
     </div>,
     document.body // Render into body
   );
 } 