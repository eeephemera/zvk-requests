"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import Link from 'next/link';
import Image from 'next/image';

import { getPartners, Partner } from '@/services/partnerService';
import { getProducts, Product } from '@/services/productService';
import { findEndClientByINN, EndClient } from '@/services/endClientService';
import { getCurrentUser, User } from '@/services/userService';
import { 
    submitDealRegistration, 
    DealRegistrationData as RequestServiceDealRegistrationData,
    Request 
} from '@/services/requestService';
import { ApiError } from '@/services/apiClient';
import LoadingSpinner from '@/components/LoadingSpinner';

// Тип для данных формы, используемый react-hook-form
// Он соответствует тому, что возвращает input type=file (FileList | null)
// Исключаем attachmentFile из сервисного типа и добавляем поле с FileList
// Убираем productId и добавляем productInput
type DealRegistrationFormData = Omit<RequestServiceDealRegistrationData, 'attachmentFile' | 'productId'> & {
    productInput?: string; // Новое текстовое поле для продукта
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


  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [foundEndClient, setFoundEndClient] = useState<EndClient | null>(null);
  const [isSearchingInn, setIsSearchingInn] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatusMessage, setSearchStatusMessage] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Состояния для превью файла ---
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Снова деструктурируем register для ref
  const { ref: attachmentFileRefCallback, ...attachmentFileRegisterProps } = register("attachmentFile");
  const attachmentFileRef = useRef<HTMLInputElement | null>(null);

  const endClientInnValue = watch('endClientInn');

  const { data: partners, isLoading: isLoadingPartners, error: partnersError } = useQuery<Partner[], ApiError>({
    queryKey: ['partners'],
    queryFn: getPartners,
    staleTime: 5 * 60 * 1000,
  });

  const { data: products, isLoading: isLoadingProducts, error: productsError } = useQuery<Product[], ApiError>({
    queryKey: ['products'],
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000,
  });

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

  // --- Обработчик изменения файла --- 
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileError(null);

    if (!file) {
      setFileName(null);
      setFilePreview(null);
      return;
    }

    // Проверка размера файла
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError("Размер файла не должен превышать 15 МБ");
      setFileName(null);
      setFilePreview(null);
      // Очищаем input через ref, полученный от register
      if (attachmentFileRef.current) {
         attachmentFileRef.current.value = '';
      }
      return;
    }

    setFileName(file.name);

    // Создание превью
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview('📄');
    }
  };

  // --- Функция для удаления файла ---
  const removeFile = () => {
      setFileName(null);
      setFilePreview(null);
      setFileError(null);
      // Очищаем input через ref
      if (attachmentFileRef.current) {
          attachmentFileRef.current.value = '';
      }
      // Сбрасываем значение в RHF
      setValue('attachmentFile', null, { shouldValidate: true });
  };

  // --- Мутация для отправки формы --- 
  const dealMutation = useMutation<Request, ApiError, RequestServiceDealRegistrationData>({ // Типы: Результат, Ошибка, Передаваемые данные
      mutationFn: submitDealRegistration, // Функция из сервиса
      onSuccess: (createdRequest) => {
          setFormSuccess(`Сделка #${createdRequest.id} успешно зарегистрирована!`);
          removeFile(); 
          reset(); 
          // Сбрасываем состояние поиска ИНН
          setFoundEndClient(null);
          setIsSearchingInn(false);
          setSearchError(null);
          setSearchStatusMessage(null);
          // Очищаем поля ИНН и клиента на всякий случай (хотя reset должен это сделать)
          setValue('endClientInn', '');
          setValue('endClientId', null);
          setValue('endClientName', '');
          setValue('endClientCity', '');
      },
      onError: (error) => {
           console.error("Ошибка отправки формы (mutation):", error);
           // Используем сообщение из ApiError или стандартное
           setFormError(error.message || "Произошла ошибка при отправке.");
      },
      // onSettled: () => { // Вызывается после onSuccess или onError
      //   // Здесь можно убирать общий индикатор загрузки страницы, если он есть
      // }
  });

  // --- Обработчик отправки формы --- 
  const onSubmit: SubmitHandler<DealRegistrationFormData> = async (formData) => {
    setFormError(null); // Сбрасываем ошибки перед новой попыткой
    setFormSuccess(null);
    
    const fileList = formData.attachmentFile; 
    const actualAttachmentFile: File | null = fileList && fileList.length > 0 ? fileList[0] : null;
    
    // Подготовка данных для отправки в сервис, включая все новые поля
    const preparedDataForService: RequestServiceDealRegistrationData = {
        // --- Основные участники ---
        partnerId: formData.partnerId, 
        distributorId: formData.distributorId || null, // Добавлено. || null, если не выбрано
        
        // --- Конечный клиент ---
        endClientId: formData.endClientId, // ID найденного клиента
        endClientInn: formData.endClientInn, // ИНН (для поиска/создания)
        endClientName: formData.endClientName, // Имя (для создания)
        endClientCity: formData.endClientCity, // Город (для создания)
        endClientFullAddress: formData.endClientFullAddress || undefined, // Добавлено
        endClientContactDetails: formData.endClientContactDetails || undefined, // Добавлено

        // Убираем обращение к formData.productId, устанавливаем просто null
        productId: null, 
        customItemSku: formData.productInput === 'Продукт по ТЗ' ? (formData.customItemSku || undefined) : undefined, 
        customItemName: formData.productInput === 'Продукт по ТЗ' ? formData.customItemName : formData.productInput, // Если не по ТЗ, используем введенное значение как имя
        customItemDescription: formData.productInput === 'Продукт по ТЗ' ? (formData.customItemDescription || undefined) : undefined, 
        quantity: formData.productInput === 'Продукт по ТЗ' ? (formData.quantity || null) : null, // Количество только для ТЗ
        unitPrice: formData.productInput === 'Продукт по ТЗ' ? (formData.unitPrice || null) : null, // Цена только для ТЗ

        // --- Параметры сделки ---
        dealDescription: formData.dealDescription, // Описание сути сделки (обязательно)
        estimatedValue: formData.estimatedValue || null, // Оценочная стоимость
        estimatedCloseDate: formData.estimatedCloseDate || null, // Добавлено
        fzLawType: formData.fzLawType || undefined, // Добавлено
        mptRegistryType: formData.mptRegistryType || undefined, 
        partnerActivities: formData.partnerActivities || undefined, 

        // --- Вложение ---
        attachmentFile: actualAttachmentFile, // Файл
    };

    // Удаляем пустые/null/undefined значения, чтобы не передавать лишнего?
    // Например, если не выбрали productId, не отправлять `productId: null`
    // Это зависит от требований бэкенда. Пока оставим как есть.

    console.log("Calling mutation with Prepared Data:", preparedDataForService);
    
    try {
        // Вызываем мутацию
        await dealMutation.mutateAsync(preparedDataForService);
        // Обработка успеха/ошибки теперь происходит в onSuccess/onError мутации
    } catch (error) {
        // Сюда попадем, если сама mutateAsync выбросит ошибку (редко)
        // Основная обработка ошибок - в onError мутации
        console.error("Неожиданная ошибка при вызове mutateAsync:", error);
        if (!formError) { // Устанавливаем ошибку, только если onError не сработал
             setFormError(error instanceof Error ? error.message : "Произошла критическая ошибка при отправке.");
        }
    }
  };

  if (isLoadingPartners || isLoadingProducts || isLoadingUser) {
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

  if (partnersError || productsError || userError) {
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
                   {partnersError?.message || productsError?.message || userError?.message || "Неизвестная ошибка"}
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
          <div className="discord-card w-full max-w-4xl p-6 mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-discord-text flex items-center">
                <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
                Регистрация новой сделки
              </h1>
              <Link
                href="/my-requests"
                className="discord-btn-secondary"
              >
                Мои регистрации
              </Link>
            </div>

            {formError && (
               <div className="mb-4 p-3 bg-discord-danger bg-opacity-10 rounded-lg border border-discord-danger border-opacity-30">
                 <p className="text-discord-danger text-sm">{formError}</p>
               </div>
            )}
             {formSuccess && (
               <div className="mb-4 p-3 bg-discord-success bg-opacity-10 rounded-lg border border-discord-success border-opacity-30">
                 <p className="text-discord-success text-sm">{formSuccess}</p>
               </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                {/* --- 0. Информация об отправителе (текущий пользователь) --- */}
                <div className="border border-discord-border p-4 rounded-md bg-discord-darker space-y-2">
                   <h3 className="text-lg font-semibold text-discord-text mb-2">Отправитель заявки</h3>
                   {currentUser ? (
                     <>
                       <p className="text-sm text-discord-text-secondary">
                         <span className="font-medium text-discord-text-muted">ФИО:</span> {currentUser.name || 'Не указано'}
                       </p>
                       <p className="text-sm text-discord-text-secondary">
                         <span className="font-medium text-discord-text-muted">Email:</span> {currentUser.email || 'Не указан'}
                       </p>
                       <p className="text-sm text-discord-text-secondary">
                         <span className="font-medium text-discord-text-muted">Телефон:</span> {currentUser.phone || 'Не указан'}
                       </p>
                       <p className="text-sm text-discord-text-secondary">
                         <span className="font-medium text-discord-text-muted">Компания:</span> {currentUser.partner?.name || 'Не привязан к компании'}
                       </p>
                     </>
                   ) : (
                     <p className="text-sm text-discord-text-muted">Информация о пользователе не загружена.</p>
                   )}
                 </div>

                {/* --- 2. Описание сделки --- */}
                <div className="border border-discord-border p-4 rounded-md bg-discord-darker space-y-5">
                  <h3 className="text-lg font-semibold text-discord-text mb-3">Описание сделки и продукта</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Левая колонка описания */}
                    <div className="space-y-5">
                      {/* --- Продукт (теперь текстовое поле) --- */}
                      <div>
                        <label htmlFor="productInput" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                          Продукт / Услуга <span className="text-discord-danger">*</span>
                        </label>
                        <input
                          id="productInput"
                          type="text"
                          placeholder='Наименование продукта или "Продукт по ТЗ"'
                          className={`discord-input w-full ${formErrors.productInput ? 'border-discord-danger' : ''}`}
                          {...register("productInput", { 
                            required: 'Укажите наименование продукта или введите \'Продукт по ТЗ\'' 
                          })}
                        />
                        {formErrors.productInput && <p className="text-discord-danger text-xs mt-1">{formErrors.productInput.message}</p>}
                        <p className="text-xs text-discord-text-muted mt-1">Если продукт требует описания по ТЗ, введите "Продукт по ТЗ".</p>
                      </div>

                      {/* --- Условно отображаемые поля для кастомного продукта/спецификации --- */} 
                      {watch('productInput') === 'Продукт по ТЗ' && (
                          <div className="border border-discord-border border-opacity-50 p-3 rounded-md space-y-3 bg-discord-darker/50 animate-fade-in">
                              {/* Артикул кастомный */} 
                              <div>
                                 <label htmlFor="customItemSku" className="block text-discord-text-secondary text-xs mb-1 font-medium">
                                     Артикул/Код (опционально)
                                 </label>
                                 <input
                                     id="customItemSku"
                                     type="text"
                                     placeholder="Ваш артикул"
                                     className={`discord-input w-full text-sm ${formErrors.customItemSku ? 'border-discord-danger' : ''}`}
                                     {...register("customItemSku")}
                                 />
                                 {formErrors.customItemSku && <p className="text-discord-danger text-xs mt-1">{formErrors.customItemSku.message}</p>}
                             </div>
                              {/* Название кастомное */} 
                              <div>
                                 <label htmlFor="customItemName" className="block text-discord-text-secondary text-xs mb-1 font-medium">
                                     Наименование продукта/услуги <span className="text-discord-danger">*</span>
                                 </label>
                                 <input
                                     id="customItemName"
                                     type="text"
                                     placeholder="Название согласно ТЗ"
                                     className={`discord-input w-full text-sm ${formErrors.customItemName ? 'border-discord-danger' : ''}`}
                                     {...register("customItemName", {
                                         // Валидация: обязательно, если выбран 'Продукт по ТЗ'
                                         required: watch('productInput') === 'Продукт по ТЗ' ? 'Наименование обязательно для продукта по ТЗ' : false
                                     })}
                                 />
                                 {formErrors.customItemName && <p className="text-discord-danger text-xs mt-1">{formErrors.customItemName.message}</p>}
                             </div>
                             {/* Описание кастомное */} 
                             <div>
                                 <label htmlFor="customItemDescription" className="block text-discord-text-secondary text-xs mb-1 font-medium">
                                     Описание/Спецификация <span className="text-discord-danger">*</span>
                                 </label>
                                 <textarea
                                     id="customItemDescription"
                                     placeholder="Подробное описание, требования..."
                                     className={`discord-input w-full resize-none text-sm ${formErrors.customItemDescription ? 'border-discord-danger' : ''}`}
                                     rows={3}
                                     {...register("customItemDescription", {
                                         // Валидация: обязательно, если выбран 'Продукт по ТЗ'
                                          required: watch('productInput') === 'Продукт по ТЗ' ? 'Описание обязательно для продукта по ТЗ' : false
                                     })}
                                 />
                                 {formErrors.customItemDescription && <p className="text-discord-danger text-xs mt-1">{formErrors.customItemDescription.message}</p>}
                             </div>
                              {/* Количество */} 
                              <div>
                                 <label htmlFor="quantity" className="block text-discord-text-secondary text-xs mb-1 font-medium">
                                     Количество (шт/ед.) <span className="text-discord-danger">*</span>
                                 </label>
                                 <input
                                     id="quantity"
                                     type="number"
                                     placeholder="1"
                                     className={`discord-input w-full text-sm ${formErrors.quantity ? 'border-discord-danger' : ''}`}
                                     {...register("quantity", {
                                          valueAsNumber: true, 
                                          min: { value: 1, message: "Количество должно быть больше 0" },
                                          // Валидация: обязательно, если выбран 'Продукт по ТЗ'
                                          validate: (value) => {
                                             const productInputVal = watch('productInput');
                                             if (productInputVal !== 'Продукт по ТЗ') return true; // Не требуется, если не 'Продукт по ТЗ'
                                             
                                             const quantityValue = typeof value === 'number' && !isNaN(value) ? value : null;
                                             if (quantityValue === null || quantityValue <= 0) {
                                                 return 'Количество (больше 0) обязательно для продукта по ТЗ';
                                             }
                                             return true;
                                         }
                                     })}
                                 />
                                   {formErrors.quantity && <p className="text-discord-danger text-xs mt-1">{formErrors.quantity.message}</p>}
                              </div>
                              {/* Цена за единицу */} 
                              <div>
                                 <label htmlFor="unitPrice" className="block text-discord-text-secondary text-xs mb-1 font-medium">
                                     Цена за ед. (₽, опционально)
                                 </label>
                                 <input
                                     id="unitPrice"
                                     type="number"
                                     placeholder="Цена за единицу"
                                     className={`discord-input w-full text-sm ${formErrors.unitPrice ? 'border-discord-danger' : ''}`}
                                     {...register("unitPrice", { valueAsNumber: true, min: { value: 0, message: "Цена не может быть отрицательной" } })}
                                 />
                                  {formErrors.unitPrice && <p className="text-discord-danger text-xs mt-1">{formErrors.unitPrice.message}</p>}
                              </div>
                           </div>
                      )} {/* Конец условного блока */} 

                      {/* Оценочная стоимость (общая) */} 
                      <div>
                          <label htmlFor="estimatedValue" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Оценочная стоимость (₽, опционально)
                          </label>
                          <input
                            id="estimatedValue"
                            type="number"
                            placeholder="Введите сумму сделки"
                            className={`discord-input w-full ${formErrors.estimatedValue ? 'border-discord-danger' : ''}`}
                            {...register("estimatedValue", { valueAsNumber: true, min: { value: 0, message: "Сумма не может быть отрицательной" } })}
                          />
                           {formErrors.estimatedValue && <p className="text-discord-danger text-xs mt-1">{formErrors.estimatedValue.message}</p>}
                      </div>
                      {/* Тип ФЗ */}
                      <div>
                        <label htmlFor="fzLawType" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                          Тип ФЗ (опционально)
                        </label>
                        <select
                          id="fzLawType"
                          className="discord-input w-full appearance-none pr-8"
                          style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                          {...register("fzLawType")}
                        >
                          <option value="">Не выбрано</option>
                          <option value="223">223 ФЗ</option>
                          <option value="44">44 ФЗ</option>
                          <option value="Коммерческий">Коммерческий</option>
                          <option value="-">Неприменимо</option>
                        </select>
                      </div>
                      {/* Тип реестра МПТ */}
                      <div>
                        <label htmlFor="mptRegistryType" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                          Тип реестра МПТ (опционально)
                        </label>
                        <select
                          id="mptRegistryType"
                          className="discord-input w-full appearance-none pr-8"
                          style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                          {...register("mptRegistryType")}
                        >
                           <option value="">Не выбрано</option>
                          <option value="Реестр">Реестр</option>
                          <option value="Нереестр">Нереестр</option>
                          <option value="Неприменимо">Неприменимо</option>
                        </select>
                      </div>
                      {/* Ожидаемая дата закрытия */}
                      <div>
                          <label htmlFor="estimatedCloseDate" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Ожидаемая дата закрытия (опционально)
                          </label>
                          <input
                            id="estimatedCloseDate"
                            type="date"
                            className={`discord-input w-full ${formErrors.estimatedCloseDate ? 'border-discord-danger' : ''}`}
                            {...register("estimatedCloseDate")}
                          />
                           {formErrors.estimatedCloseDate && <p className="text-discord-danger text-xs mt-1">{formErrors.estimatedCloseDate.message}</p>}
                      </div>
                    </div>
                    {/* Правая колонка описания */}
                    <div className="space-y-5">
                       {/* Описание сделки */}
                        <div>
                          <label htmlFor="dealDescription" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Описание сделки <span className="text-discord-danger">*</span>
                          </label>
                          <textarea
                            id="dealDescription"
                            placeholder="Опишите суть сделки, потребности клиента..."
                            className={`discord-input w-full resize-none ${formErrors.dealDescription ? 'border-discord-danger' : ''}`}
                            rows={6}
                            {...register("dealDescription", { required: "Описание сделки обязательно" })}
                          />
                          {formErrors.dealDescription && <p className="text-discord-danger text-xs mt-1">{formErrors.dealDescription.message}</p>}
                        </div>
                        {/* Активности партнера */} 
                        <div>
                           <label htmlFor="partnerActivities" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                             Ключевые активности партнера (опционально)
                           </label>
                           <textarea
                             id="partnerActivities"
                             placeholder="Что партнер делает для продвижения сделки?"
                             className={`discord-input w-full resize-none ${formErrors.partnerActivities ? 'border-discord-danger' : ''}`}
                             rows={4}
                             {...register("partnerActivities")}
                           />
                           {formErrors.partnerActivities && <p className="text-discord-danger text-xs mt-1">{formErrors.partnerActivities.message}</p>}
                        </div>
                        {/* Дистрибьютор */} 
                        <div>
                          <label htmlFor="distributorId" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Дистрибьютор (опционально)
                          </label>
                          <select
                            id="distributorId"
                            className={`discord-input w-full appearance-none pr-8 ${formErrors.distributorId ? 'border-discord-danger' : ''}`}
                            style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                            {...register("distributorId", { valueAsNumber: true })}
                          >
                            <option value="">-- Не выбран --</option>
                            {/* Используем тот же список партнеров */} 
                            {partners?.map((partner) => (
                              <option key={partner.id} value={partner.id}>
                                {partner.name}
                              </option>
                            ))}
                          </select>
                          {formErrors.distributorId && <p className="text-discord-danger text-xs mt-1">{formErrors.distributorId.message}</p>}
                        </div>
                    </div>
                  </div>
                </div>


                {/* --- 3. Информация о конечном клиенте --- */}
                <div className="border border-discord-border p-4 rounded-md bg-discord-darker relative">
                  <h3 className="text-lg font-semibold text-discord-text mb-3">Конечный клиент</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* ИНН */}
                    <div className="relative">
                      <label htmlFor="endClientInn" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                        ИНН конечного клиента <span className="text-discord-danger">*</span>
                      </label>
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
                      {formErrors.endClientInn && <p className="text-discord-danger text-xs mt-1">{formErrors.endClientInn.message}</p>}
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
                        <label htmlFor="endClientName" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                          Наименование { !foundEndClient && <span className="text-discord-danger">*</span> }
                        </label>
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
                        {formErrors.endClientName && <p className="text-discord-danger text-xs mt-1">{formErrors.endClientName.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="endClientCity" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                          Город (опционально)
                        </label>
                        <input
                          id="endClientCity"
                          type="text"
                          placeholder="Город местонахождения"
                          className={`discord-input w-full ${formErrors.endClientCity ? 'border-discord-danger' : ''}`}
                          {...register("endClientCity")}
                           disabled={!!foundEndClient || isSearchingInn}
                        />
                      </div>
                    </>

                    {/* Новые поля */} 
                    {/* Полный адрес */} 
                    <div>
                        <label htmlFor="endClientFullAddress" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Полный адрес (опционально)
                        </label>
                        <input
                          id="endClientFullAddress"
                          type="text"
                          placeholder="Индекс, регион, город, улица, дом"
                          className={`discord-input w-full ${formErrors.endClientFullAddress ? 'border-discord-danger' : ''}`}
                          {...register("endClientFullAddress")}
                          disabled={!!foundEndClient || isSearchingInn} // Блокировать, если клиент найден
                        />
                         {formErrors.endClientFullAddress && <p className="text-discord-danger text-xs mt-1">{formErrors.endClientFullAddress.message}</p>}
                    </div>
                     {/* Контактное лицо клиента */} 
                     <div>
                        <label htmlFor="endClientContactDetails" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                            Контактное лицо клиента (опционально)
                        </label>
                        <input
                          id="endClientContactDetails"
                          type="text"
                          placeholder="ФИО, должность, email, телефон"
                          className={`discord-input w-full ${formErrors.endClientContactDetails ? 'border-discord-danger' : ''}`}
                          {...register("endClientContactDetails")}
                          disabled={!!foundEndClient || isSearchingInn} // Блокировать, если клиент найден
                        />
                         {formErrors.endClientContactDetails && <p className="text-discord-danger text-xs mt-1">{formErrors.endClientContactDetails.message}</p>}
                    </div>

                  </div>
                </div>

                {/* --- 4. Вложение (опционально) --- */}
                <div>
                  <label htmlFor="attachmentFile" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                    Прикрепить файл (опционально, макс. 15МБ)
                  </label>
                  <div className={`border border-dashed rounded-lg p-4 bg-discord-darker transition-colors ${fileError ? 'border-discord-danger' : 'border-discord-lightest hover:border-discord-accent/50'}`}>
                    <input
                      id="attachmentFile"
                      type="file"
                       // Передаем ref через колбэк
                       ref={(e) => {
                         attachmentFileRefCallback(e); // Вызываем оригинальный ref от RHF
                         attachmentFileRef.current = e; // Сохраняем ссылку в наш ref
                       }}
                      // Применяем остальные пропсы от register
                      {...attachmentFileRegisterProps} // Используем props без ref
                      className="hidden"
                      // Явный onChange для нашей логики превью
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip,.rar,.7z"
                    />
                    <label htmlFor="attachmentFile" className="cursor-pointer flex flex-col items-center text-discord-text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <span className="text-sm mb-1">Перетащите файл сюда или нажмите, чтобы выбрать</span>
                      <span className="text-xs">(PDF, DOC, DOCX, XLS, XLSX, JPG, PNG и др.)</span>
                    </label>
                  </div>
                  {fileError && <p className="text-discord-danger text-xs mt-1">{fileError}</p>}

                  {fileName && filePreview && (
                    <div className="mt-3 p-3 rounded-lg flex items-center bg-discord-medium border border-discord-border">
                      {filePreview.startsWith('data:image') ? (
                        <Image 
                          src={filePreview} 
                          alt="Превью" 
                          width={48}
                          height={48}
                          className="h-12 w-auto object-contain mr-3 rounded-md bg-discord-darker p-1" 
                        />
                      ) : (
                        <div className="h-10 w-10 bg-discord-dark rounded-md flex items-center justify-center mr-3 text-discord-accent text-xl">
                           {filePreview} 
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm text-discord-text truncate" title={fileName}>{fileName}</div>
                      </div>
                      <button 
                        type="button"
                        onClick={removeFile}
                        className="ml-2 text-discord-text-muted hover:text-discord-danger transition-colors p-1 rounded-full hover:bg-discord-danger/10"
                        aria-label="Удалить файл"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
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
