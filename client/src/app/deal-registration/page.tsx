"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import Link from 'next/link';

import { findEndClientByINN, EndClient } from '@/services/endClientService';
import { getCurrentUser, User } from '@/services/userService';
import { 
    submitDealRegistration, 
    DealRegistrationData as RequestServiceDealRegistrationData,
    Request 
} from '@/services/requestService';
import { ApiError } from '@/services/apiClient';
import LoadingSpinner from '@/components/LoadingSpinner';

// Тип, ожидаемый сервисной функцией
type ApiDealRegistrationData = RequestServiceDealRegistrationData;

// Тип для данных формы, используемый react-hook-form
type DealRegistrationFormData = Omit<ApiDealRegistrationData, 'attachmentFile'> & {
    attachmentFile?: FileList | null;
};

export default function DealRegistrationPage() {
  const { 
    register, 
    handleSubmit, 
    reset, 
    setValue, 
    watch, 
    formState: { errors: formErrors, isSubmitting },
    trigger
  } = useForm<DealRegistrationFormData>({
    mode: 'onBlur' 
  });

  const queryClient = useQueryClient();

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [foundEndClient, setFoundEndClient] = useState<EndClient | null>(null);
  const [isSearchingInn, setIsSearchingInn] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatusMessage, setSearchStatusMessage] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Состояния для файлов ---
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Снова деструктурируем register для ref
  const { ref: attachmentFileRefCallback, ...attachmentFileRegisterProps } = register("attachmentFile");
  const attachmentFileRef = useRef<HTMLInputElement | null>(null);

  const endClientInnValue = watch('endClientInn');

  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useQuery<User, ApiError>({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!endClientInnValue || endClientInnValue.length < 10 || endClientInnValue.length > 12) {
        setIsSearchingInn(false);
        setFoundEndClient(null);
        setSearchError(null);
        setSearchStatusMessage(null);
        setValue('endClientId', null);
        setValue('endClientName', '');
        setValue('endClientCity', '');
        trigger('endClientName');
        return; 
    }

    const innPattern = /^(\d{10}|\d{12})$/;
    if (!innPattern.test(endClientInnValue)) {
        setIsSearchingInn(false);
        setSearchStatusMessage("Неверный формат ИНН.");
        setFoundEndClient(null);
        setSearchError(null);
        setValue('endClientId', null);
        return;
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      setIsSearchingInn(true);
      setSearchError(null);
      setSearchStatusMessage("Идет поиск...");
      setFoundEndClient(null);
      setValue('endClientId', null);

      try {
        const client = await findEndClientByINN(endClientInnValue);
        if (client) {
          setFoundEndClient(client);
          setSearchStatusMessage(`Клиент найден: ${client.name}`);
          setValue('endClientId', client.id);
          setValue('endClientName', client.name);
          setValue('endClientCity', client.city || '');
          trigger('endClientName');
        } else {
          setFoundEndClient(null);
          setSearchStatusMessage("Клиент не найден. Заполните Наименование.");
           setValue('endClientId', null);
           setValue('endClientName', ''); 
           setValue('endClientCity', '');
           trigger('endClientName');
        }
      } catch (err) {
        console.error("Ошибка поиска ИНН:", err);
        setSearchError(err instanceof Error ? err.message : "Ошибка сервера при поиске ИНН");
        setSearchStatusMessage(null);
        setFoundEndClient(null);
        setValue('endClientId', null);
      } finally {
        setIsSearchingInn(false);
      }
    }, 600);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [endClientInnValue, setValue, trigger]);

  // --- Обновленный обработчик изменения файла для поддержки нескольких файлов ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    if (newFiles.length === 0) return;

    setFileError(null);
    const allFiles = [...attachedFiles, ...newFiles];
    let validationPassed = true;

    // Проверяем каждый файл
    const maxSize = 15 * 1024 * 1024;
    allFiles.forEach(file => {
      if (file.size > maxSize) {
        setFileError(`Файл "${file.name}" превышает лимит в 15 МБ.`);
        validationPassed = false;
      }
    });

    if (!validationPassed) {
      // Очищаем input, чтобы можно было выбрать тот же файл снова после ошибки
      if (attachmentFileRef.current) {
        attachmentFileRef.current.value = '';
      }
      return;
    }
    
    // Обновляем состояние react-hook-form
    const dataTransfer = new DataTransfer();
    allFiles.forEach(file => dataTransfer.items.add(file));
    setValue('attachmentFile', dataTransfer.files, { shouldValidate: true });

    setAttachedFiles(allFiles);
  };

  // --- Новые обработчики для Drag-n-Drop ---
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Это необходимо, чтобы событие onDrop сработало
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const newFiles = e.dataTransfer.files;
    if (newFiles && newFiles.length > 0) {
      // Имитируем событие для handleFileChange
      const syntheticEvent = {
        target: { files: newFiles }
      } as unknown as ChangeEvent<HTMLInputElement>;
      handleFileChange(syntheticEvent);
    }
  };

  // --- Функция для удаления одного файла из списка ---
  const removeFile = (fileToRemove: File) => {
    const updatedFiles = attachedFiles.filter(file => file !== fileToRemove);

    const dataTransfer = new DataTransfer();
    updatedFiles.forEach(file => dataTransfer.items.add(file));
    setValue('attachmentFile', dataTransfer.files, { shouldValidate: true });

    setAttachedFiles(updatedFiles);
    
    // Сбрасываем ошибку, если она была связана с размером
    if (fileError) {
      setFileError(null);
    }
  };

  // --- Мутация для отправки формы --- 
  const dealMutation = useMutation<Request, ApiError, ApiDealRegistrationData>({
      mutationFn: submitDealRegistration,
      onSuccess: (createdRequest) => {
          // Инвалидируем кеш списка заявок, чтобы при следующем переходе он обновился
          queryClient.invalidateQueries({ queryKey: ['userRequests'] });
          
          // Показываем сообщение об успехе и очищаем форму для следующей заявки
          setFormSuccess(`Сделка #${createdRequest.id} успешно зарегистрирована. Вы можете создать новую.`);
          setAttachedFiles([]);
          reset(); 
          setUploadProgress(null);
          setFoundEndClient(null);
          setIsSearchingInn(false);
          setSearchError(null);
          setSearchStatusMessage(null);
      },
      onError: (error) => {
           console.error("Ошибка отправки формы (mutation):", error);
           setFormError(error.message || "Произошла ошибка при отправке.");
           setUploadProgress(null);
      },
  });

  // --- Обработчик отправки формы --- 
  const onSubmit: SubmitHandler<DealRegistrationFormData> = async (formData) => {
    setFormError(null);
    setFormSuccess(null);
    setUploadProgress(0);
    
    if (!currentUser || !currentUser.partner?.id) {
        setFormError("Не удалось определить вашу организацию. Пожалуйста, войдите в систему заново.");
        return;
    }

    const { attachmentFile, ...otherFormData } = formData;

    const apiData: ApiDealRegistrationData = {
        ...otherFormData,
        partnerId: currentUser.partner.id,
        attachmentFiles: attachmentFile ? Array.from(attachmentFile) : [],
        onUploadProgress: (progress) => {
          setUploadProgress(progress);
        },
    };
    
    dealMutation.mutate(apiData);
  };

  if (isLoadingUser) {
    return (
      <ProtectedRoute allowedRoles={["USER"]} redirectIfNotAllowed={true}>
        <div className="min-h-screen flex flex-col bg-discord-background">
          <Header />
          <div className="flex-grow flex items-center justify-center">
            <LoadingSpinner />
            <p className="text-discord-text-muted ml-3">Загрузка данных...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (userError) {
    return (
      <ProtectedRoute allowedRoles={["USER"]} redirectIfNotAllowed={true}>
        <div className="min-h-screen flex flex-col bg-discord-background">
          <Header />
          <div className="container mx-auto p-6">
             <div className="discord-card max-w-4xl mx-auto p-6 bg-discord-danger/10 border border-discord-danger/30">
                 <h2 className="text-xl font-bold text-discord-danger mb-3">Ошибка загрузки данных</h2>
                 <p className="text-discord-text-secondary mb-2">
                   Не удалось загрузить необходимые данные для формы (партнеры, продукты или информация о пользователе).
                 </p>
                 <p className="text-xs text-discord-text-muted">
                   {userError?.message || "Неизвестная ошибка"}
                 </p>
             </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["USER"]} redirectIfNotAllowed={true}>
      <div className="min-h-screen flex flex-col bg-discord-background">
        <Header />
        <div className="container mx-auto p-6 flex-grow">
          <div className="bg-discord-card border border-discord-border rounded-lg w-full max-w-4xl p-6 mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-discord-text flex items-center">
                <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
                Новая регистрация
              </h1>
              <Link
                href="/my-requests"
                className="discord-btn-secondary transition-colors duration-200"
              >
                К списку регистраций
              </Link>
            </div>

            {formError && (
               <div className="mb-4 p-3 bg-discord-danger bg-opacity-10 rounded-lg border border-discord-danger border-opacity-30">
                 <p className="text-discord-danger text-sm">{formError}</p>
               </div>
            )}
             {formSuccess && (
               <div className="mb-4 p-3 flex justify-between items-center bg-discord-success bg-opacity-10 rounded-lg border border-discord-success border-opacity-30">
                 <p className="text-discord-text text-sm font-medium">{formSuccess}</p>
                 <button
                   type="button"
                   onClick={() => setFormSuccess(null)}
                   className="text-discord-text hover:bg-discord-success/20 rounded-full p-1 transition-colors duration-200"
                   aria-label="Скрыть сообщение об успехе"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
               </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                {/* --- 1. Информация о партнере --- */}
                <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-5">
                  <h3 className="text-lg font-semibold text-discord-text mb-3">Информация о партнере</h3>
                  
                  {/* Отображаем информацию о текущем пользователе и его компании (партнере) */}
                  <div>
                    {currentUser ? (
                      <div className="space-y-3">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-discord-text-muted mb-1">Компания-партнер:</h4>
                          <p className="text-discord-text font-medium">
                            {currentUser.partner?.name || 'Не привязан к компании'}
                          </p>
                          
                          {/* Скрытое поле для partnerId */}
                          <input
                            type="hidden"
                            {...register("partnerId", { 
                              required: true,
                              value: currentUser.partner?.id || undefined,
                              valueAsNumber: true 
                            })}
                          />
                          
                          {!currentUser.partner?.id && (
                            <p className="text-discord-danger text-xs mt-1">
                              Ваш аккаунт не привязан к компании-партнеру. Обратитесь к администратору.
                            </p>
                          )}
                        </div>
                        
                        <h4 className="text-sm font-semibold text-discord-text-muted mb-1">Информация об отправителе:</h4>
                        <p className="text-sm text-discord-text-secondary">
                          <span className="font-medium text-discord-text-muted">ФИО:</span> {currentUser.name || 'Не указано'}
                        </p>
                        <p className="text-sm text-discord-text-secondary">
                          <span className="font-medium text-discord-text-muted">Email:</span> {currentUser.email || 'Не указан'}
                        </p>
                        <p className="text-sm text-discord-text-secondary">
                          <span className="font-medium text-discord-text-muted">Телефон:</span> {currentUser.phone || 'Не указан'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-discord-text-muted">Информация о пользователе не загружена.</p>
                    )}
                  </div>
                </div>

                {/* --- 2. Описание сделки --- */}
                <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-5">
                  <h3 className="text-lg font-semibold text-discord-text mb-3">Описание проекта</h3>
                  
                  {/* Новое поле - Название проекта */}
                  <div>
                    <label htmlFor="projectName" className="form-label">Название проекта/сделки *</label>
                    <input
                      id="projectName"
                      type="text"
                      placeholder="Например, 'Поставка серверов для нужд ООО Ромашка'"
                      className={`discord-input w-full ${formErrors.projectName ? 'border-discord-danger' : ''}`}
                      {...register("projectName", { required: "Название проекта обязательно" })}
                    />
                    {formErrors.projectName && <p className="form-error-message">{formErrors.projectName.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Левая колонка описания */}
                    <div className="space-y-5">
                      {/* ПОЛЯ ДЛЯ ТОВАРА УДАЛЕНЫ */}

                      {/* ГРУППА ДЛЯ ЦЕНЫ И КОЛИЧЕСТВА - НАЧАЛО */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="sm:w-1/2">
                          <label htmlFor="quantity" className="form-label">Количество</label>
                          <input
                            id="quantity"
                            type="number"
                            placeholder="Кол-во"
                            className={`discord-input w-full ${formErrors.quantity ? 'border-discord-danger' : ''}`}
                            {...register("quantity", { 
                              valueAsNumber: true,
                              min: { value: 1, message: "Количество должно быть больше 0" }
                            })}
                          />
                          {formErrors.quantity && <p className="form-error-message">{formErrors.quantity.message}</p>}
                        </div>
                        <div className="sm:w-1/2">
                          <label htmlFor="unitPrice" className="form-label">Цена за ед.</label>
                          <input
                            id="unitPrice"
                            type="number"
                            placeholder="Цена за единицу"
                            className={`discord-input w-full ${formErrors.unitPrice ? 'border-discord-danger' : ''}`}
                            {...register("unitPrice", { 
                              valueAsNumber: true,
                              min: { value: 0, message: "Цена не может быть отрицательной" }
                            })}
                          />
                          {formErrors.unitPrice && <p className="form-error-message">{formErrors.unitPrice.message}</p>}
                        </div>
                      </div>
                      {/* ГРУППА ДЛЯ ЦЕНЫ И КОЛИЧЕСТВА - КОНЕЦ */}
                       {/* Описание сделки (ТЗ) */}
                       <div>
                          <label htmlFor="dealDescription" className="form-label">Подробнее о сделке / Техническое задание *</label>
                          <textarea
                            id="dealDescription"
                            placeholder="Опишите суть сделки, потребности клиента, технические требования..."
                            className={`discord-input w-full ${formErrors.dealDescription ? 'border-discord-danger' : ''}`}
                            rows={8}
                            {...register("dealDescription", { required: "Описание сделки обязательно" })}
                          />
                          {formErrors.dealDescription && <p className="form-error-message">{formErrors.dealDescription.message}</p>}
                        </div>
                    </div>
                    {/* Правая колонка описания */}
                    <div className="space-y-5">
                       
                        {/* Активности партнера */} 
                        <div>
                           <label htmlFor="partnerActivities" className="form-label">Ключевые активности партнера (опционально)</label>
                           <textarea
                             id="partnerActivities"
                             placeholder="Что партнер делает для продвижения сделки?"
                             className={`discord-input w-full ${formErrors.partnerActivities ? 'border-discord-danger' : ''}`}
                             rows={4}
                             {...register("partnerActivities")}
                           />
                           {formErrors.partnerActivities && <p className="form-error-message">{formErrors.partnerActivities.message}</p>}
                        </div>
                        
                        {/* Тип ФЗ */}
                        <div>
                          <label htmlFor="fzLawType" className="form-label">Тип ФЗ (опционально)</label>
                          <select
                            id="fzLawType"
                            className="discord-input w-full"
                            {...register("fzLawType")}
                          >
                            <option value="">Не выбрано</option>
                            <option value="223">223 ФЗ</option>
                            <option value="44">44 ФЗ</option>
                            <option value="Коммерческий">Коммерческий</option>
                          </select>
                        </div>
                        
                        {/* Тип реестра МПТ */}
                        <div>
                          <label htmlFor="mptRegistryType" className="form-label">Тип реестра МПТ (опционально)</label>
                          <select
                            id="mptRegistryType"
                            className="discord-input w-full"
                            {...register("mptRegistryType")}
                          >
                             <option value="">Не выбрано</option>
                            <option value="Реестр">Реестр</option>
                            <option value="Нереестр">Нереестр</option>
                          </select>
                        </div>
                        
                        {/* Ожидаемая дата закрытия */}
                        <div>
                          <label htmlFor="estimatedCloseDate" className="form-label">Ожидаемая дата закрытия сделки</label>
                          <input
                            id="estimatedCloseDate"
                            type="date"
                            className={`discord-input w-full ${formErrors.estimatedCloseDate ? 'border-discord-danger' : ''}`}
                            {...register("estimatedCloseDate")}
                          />
                           {formErrors.estimatedCloseDate && <p className="form-error-message">{formErrors.estimatedCloseDate.message}</p>}
                        </div>
                    </div>
                  </div>
                </div>


                {/* --- 3. Информация о конечном клиенте --- */}
                <div className="border border-discord-border p-4 rounded-lg bg-discord-background relative">
                  <h3 className="text-lg font-semibold text-discord-text mb-3">Конечный клиент</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* ИНН */}
                    <div className="relative">
                      <label htmlFor="endClientInn" className="form-label">ИНН конечного клиента *</label>
                      <input
                        id="endClientInn"
                        type="text"
                        placeholder="Введите ИНН для поиска или нового клиента"
                        className={`discord-input w-full ${formErrors.endClientInn ? 'border-discord-danger' : ''} ${isSearchingInn ? 'pr-10' : ''}`}
                        {...register("endClientInn", {
                          required: "ИНН конечного клиента обязателен",
                          pattern: {
                            value: /^(\d{10}|\d{12})$/,
                            message: "ИНН должен содержать 10 или 12 цифр"
                          },
                        })}
                      />
                       {isSearchingInn && (
                           <div className="absolute right-3 top-[calc(0.375rem+1.5em)] transform -translate-y-1/2">
                             <LoadingSpinner />
                           </div>
                       )}
                      {formErrors.endClientInn && <p className="form-error-message">{formErrors.endClientInn.message}</p>}
                      <div className="mt-1 text-xs h-4">
                          {searchStatusMessage && !searchError && (
                             <span className={`${foundEndClient ? 'text-discord-success' : 'text-discord-text-muted'}`}>{searchStatusMessage}</span>
                          )}
                          {searchError && (
                             <span className="text-discord-danger">{searchError}</span>
                          )}
                       </div>
                    </div>

                    {/* Поля для нового клиента */}
                    <>
                       <div>
                        <label htmlFor="endClientName" className="form-label">Наименование { !foundEndClient && <span className="text-discord-danger">*</span> }</label>
                        <input
                          id="endClientName"
                          type="text"
                          placeholder="Название организации"
                          className={`discord-input w-full ${formErrors.endClientName ? 'border-discord-danger' : ''}`}
                          {...register("endClientName", { 
                              required: !foundEndClient ? "Наименование обязательно для нового клиента" : false 
                          })}
                          disabled={!!foundEndClient || isSearchingInn}
                        />
                        {formErrors.endClientName && <p className="form-error-message">{formErrors.endClientName.message}</p>}
                      </div>
                    </>

                    {/* Новые поля */} 
                    {/* Полный адрес */} 
                    <div>
                        <label htmlFor="endClientFullAddress" className="form-label">Полный адрес</label>
                        <input
                          id="endClientFullAddress"
                          type="text"
                          placeholder="Индекс, регион, город, улица, дом"
                          className={`discord-input w-full ${formErrors.endClientFullAddress ? 'border-discord-danger' : ''}`}
                          {...register("endClientFullAddress")}
                          disabled={!!foundEndClient || isSearchingInn} // Блокировать, если клиент найден
                        />
                         {formErrors.endClientFullAddress && <p className="form-error-message">{formErrors.endClientFullAddress.message}</p>}
                    </div>
                     {/* Контактное лицо клиента */} 
                     <div>
                        <label htmlFor="endClientContactDetails" className="form-label">Контактное лицо клиента (опционально)</label>
                        <input
                          id="endClientContactDetails"
                          type="text"
                          placeholder="ФИО, должность, email, телефон"
                          className={`discord-input w-full ${formErrors.endClientContactDetails ? 'border-discord-danger' : ''}`}
                          {...register("endClientContactDetails")}
                          disabled={!!foundEndClient || isSearchingInn} // Блокировать, если клиент найден
                        />
                         {formErrors.endClientContactDetails && <p className="form-error-message">{formErrors.endClientContactDetails.message}</p>}
                    </div>

                  </div>
                </div>

                {/* --- 4. Вложение (опционально) --- */}
                <div>
                  <label htmlFor="attachmentFile" className="form-label">Прикрепить файлы (опционально, макс. 15МБ)</label>
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-lg p-4 bg-discord-background transition-colors ${
                      fileError ? 'border-discord-danger'
                      : isDragging ? 'border-discord-accent bg-discord-accent/10'
                      : 'border-discord-border hover:border-discord-accent/50'
                    }`}
                  >
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md pointer-events-none">
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-500">
                          <label htmlFor="attachmentFile" className="relative cursor-pointer bg-discord-gray-light rounded-md font-medium text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 pointer-events-auto">
                            <span>{isDragging ? 'Отпустите, чтобы добавить' : 'Перетащите файлы сюда'}</span>
                            <input
                              id="attachmentFile"
                              type="file"
                              multiple // <<< Разрешаем выбор нескольких файлов
                              className="hidden"
                              {...attachmentFileRegisterProps}
                              ref={(e) => {
                                attachmentFileRefCallback(e);
                                attachmentFileRef.current = e;
                              }}
                              onChange={(e) => {
                                attachmentFileRegisterProps.onChange(e);
                                handleFileChange(e);
                              }}
                            />
                          </label>
                          <p className="pl-1 pointer-events-none">или нажмите, чтобы выбрать</p>
                        </div>
                        <p className="text-xs text-gray-400 pointer-events-none">
                          (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG и др.)
                        </p>
                      </div>
                    </div>
                  </div>
                  {fileError && <p className="form-error-message">{fileError}</p>}

                  {/* Новый блок для отображения списка файлов */}
                  {attachedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-discord-text-muted">Прикрепленные файлы:</h4>
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="p-2 pr-3 rounded-lg flex items-center bg-discord-input border border-discord-border overflow-hidden relative">
                           {/* Полоса прогресса */}
                           {uploadProgress !== null && (
                              <div
                                 className="absolute top-0 left-0 h-full bg-discord-accent/20 transition-all duration-300 ease-linear"
                                 style={{ width: `${uploadProgress}%` }}
                              />
                           )}
                           <div className="relative z-10 h-8 w-8 bg-discord-card rounded-md flex items-center justify-center mr-3 text-discord-accent text-lg">
                              📄
                           </div>
                           <div className="relative z-10 flex-1 overflow-hidden">
                              <div className="text-sm text-discord-text truncate" title={file.name}>{file.name}</div>
                              <div className="text-xs text-discord-text-muted">{(file.size / 1024).toFixed(1)} KB</div>
                           </div>
                           <button 
                              type="button"
                              onClick={() => removeFile(file)}
                              className="relative z-10 ml-2 text-discord-text-muted hover:text-discord-danger transition-colors duration-200 p-1 rounded-full hover:bg-discord-danger/10"
                              aria-label={`Удалить файл ${file.name}`}
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                           </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Кнопка отправки */}
                <div>
                  <button
                    type="submit"
                    // Используем isPending от мутации и isSubmitting от RHF
                    disabled={dealMutation.isPending || isSubmitting} 
                    className={`discord-btn-primary w-full py-3 relative ${dealMutation.isPending || isSubmitting ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                     {/* Используем isPending от мутации для отображения лоадера */} 
                     {(dealMutation.isPending || isSubmitting) ? (
                        <>
                           <span className="opacity-0">Зарегистрировать сделку</span> 
                           <span className="absolute inset-0 flex items-center justify-center">
                             <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             <span>Отправка...</span>
                           </span>
                        </>
                    ) : (
                      "Зарегистрировать сделку"
                    )}
                  </button>
                </div>
            </form>
            
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 