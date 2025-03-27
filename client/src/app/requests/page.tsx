"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { submitRequest, saveDraft, loadDraft } from "../../services/requestService";
import Image from 'next/image';
import Link from 'next/link';

type FormInputs = {
  inn: string;
  organizationName: string;
  implementationDate: string;
  fzType: "223" | "44";
  registryType: "registry" | "non-registry";
  comment: string;
};

export default function RequestsPage() {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormInputs>();
  const [tzFile, setTzFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Загрузка черновика при монтировании
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.inn) setValue('inn', draft.inn);
      if (draft.organizationName) setValue('organizationName', draft.organizationName);
      if (draft.implementationDate) setValue('implementationDate', draft.implementationDate);
      if (draft.fzType) setValue('fzType', draft.fzType as "223" | "44");
      if (draft.registryType) setValue('registryType', draft.registryType as "registry" | "non-registry");
      if (draft.comment) setValue('comment', draft.comment);
    }
  }, [setValue]);
  
  // Автоматическое сохранение черновика при изменении формы
  const handleFormChange = () => {
    if (formRef.current) {
      const formData = new FormData(formRef.current);
      const draft = {
        inn: formData.get('inn') as string,
        organizationName: formData.get('organizationName') as string,
        implementationDate: formData.get('implementationDate') as string,
        fzType: formData.get('fzType') as "223" | "44",
        registryType: formData.get('registryType') as "registry" | "non-registry",
        comment: formData.get('comment') as string
      };
      saveDraft(draft);
    }
  };
  
  // Функция для обработки файла и создания превью
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (!file) {
      setTzFile(null);
      setFilePreview(null);
      setFileName(null);
      return;
    }
    
    // Проверка размера файла
    if (file.size > 10 * 1024 * 1024) {
      setError("Размер файла не должен превышать 10МБ");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setTzFile(file);
    setFileName(file.name);
    setError("");
    
    // Создание превью для изображений
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // Для других типов файлов показываем иконку в зависимости от типа
      setFilePreview('📄');
    }
  };
  
  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setError("");
    setSuccess("");
    setIsLoading(true);
    setLoadingProgress(0);
    
    // Имитация прогресса загрузки
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 300);

    try {
      const response = await submitRequest({
        inn: data.inn,
        organizationName: data.organizationName,
        tzFile,
        implementationDate: data.implementationDate,
        fzType: data.fzType,
        comment: data.comment,
        registryType: data.registryType
      });
      
      if (response.success) {
        setSuccess("Заявка успешно отправлена!");
        setLoadingProgress(100);
        
        // Удаляем черновик после успешной отправки
        localStorage.removeItem('draftProject');
        
        // Сброс формы
        setTimeout(() => {
          reset();
          setTzFile(null);
          setFilePreview(null);
          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }, 1000);
      } else {
        setError(response.error || "Произошла ошибка при отправке заявки");
      }
    } catch (err) {
      console.error("Form submission error:", err);
      setError("Неизвестная ошибка при отправке формы");
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--discord-bg)' }}>
      <div className="discord-card w-full max-w-4xl p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-discord-text flex items-center">
            <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
            Регистрация проекта
          </h1>
          <Link 
            href="/my-requests" 
            className="discord-btn-primary"
          >
            Мои заявки
          </Link>
        </div>

        {/* Сообщения */}
        {(error || success) && (
          <div className="mb-5 text-center animate-fadeIn">
            {error && (
              <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
                <p className="text-discord-danger">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-discord-success bg-opacity-20 rounded-lg border border-discord-success border-opacity-30">
                <p className="text-discord-success">{success}</p>
              </div>
            )}
          </div>
        )}

        <form 
          ref={formRef} 
          className="space-y-5" 
          onSubmit={handleSubmit(onSubmit)}
          onChange={handleFormChange}
        >
          {/* Основная сетка */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Левая колонка */}
            <div className="space-y-5">
              {/* ИНН */}
              <div className="animate-slideUp delay-100">
                <label htmlFor="inn" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  ИНН <span className="text-discord-danger">*</span>
                </label>
                <input
                  id="inn"
                  type="text"
                  placeholder="Введите ИНН"
                  className={`discord-input w-full ${errors.inn ? 'border-discord-danger' : ''}`}
                  {...register("inn", { required: "ИНН обязателен", pattern: {
                    value: /^\d{10}$|^\d{12}$/,
                    message: "ИНН должен содержать 10 или 12 цифр"
                  }})}
                />
                {errors.inn && <p className="text-discord-danger text-xs mt-1">{errors.inn.message}</p>}
              </div>

              {/* Наименование организации */}
              <div className="animate-slideUp delay-200">
                <label htmlFor="organizationName" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Наименование организации <span className="text-discord-danger">*</span>
                </label>
                <input
                  id="organizationName"
                  type="text"
                  placeholder="Название организации"
                  className={`discord-input w-full ${errors.organizationName ? 'border-discord-danger' : ''}`}
                  {...register("organizationName", { required: "Название организации обязательно" })}
                />
                {errors.organizationName && <p className="text-discord-danger text-xs mt-1">{errors.organizationName.message}</p>}
              </div>

              {/* Прикрепить ТЗ */}
              <div className="animate-slideUp delay-300">
                <label htmlFor="tzFile" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Прикрепить ТЗ <span className="text-discord-danger">*</span>
                </label>
                <div className="border border-dashed border-discord-lightest rounded-lg p-4 bg-discord-darker hover:bg-discord-dark transition-colors">
                  <input
                    id="tzFile"
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    required
                  />
                  <label htmlFor="tzFile" className="cursor-pointer flex flex-col items-center text-discord-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm mb-1">Перетащите файл сюда или нажмите, чтобы выбрать</span>
                    <span className="text-xs">PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG (макс. 10МБ)</span>
                  </label>
                </div>
                
                {/* Превью файла */}
                {filePreview && (
                  <div className="mt-3 p-3 rounded-lg flex items-center bg-discord-medium animate-fadeIn">
                    {filePreview.startsWith('data:image') ? (
                      <Image 
                        src={filePreview} 
                        alt="Превью" 
                        width={64}
                        height={64}
                        className="h-16 w-auto object-contain mr-3 rounded-md" 
                      />
                    ) : (
                      <div className="h-12 w-12 bg-discord-dark rounded-md flex items-center justify-center mr-3 text-discord-accent">
                        <span className="text-xl">{filePreview}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-sm text-discord-text truncate">{fileName}</div>
                      <div className="text-xs text-discord-text-muted mt-1">
                        Добавлен {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setTzFile(null);
                        setFilePreview(null);
                        setFileName(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-discord-text-muted hover:text-discord-danger transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Правая колонка */}
            <div className="space-y-5">
              {/* Дата реализации */}
              <div className="animate-slideUp delay-100">
                <label htmlFor="implementationDate" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Дата реализации <span className="text-discord-danger">*</span>
                </label>
                <input
                  id="implementationDate"
                  type="date"
                  className={`discord-input w-full ${errors.implementationDate ? 'border-discord-danger' : ''}`}
                  {...register("implementationDate", { required: "Дата реализации обязательна" })}
                />
                {errors.implementationDate && <p className="text-discord-danger text-xs mt-1">{errors.implementationDate.message}</p>}
              </div>

              {/* Какой ФЗ? */}
              <div className="animate-slideUp delay-200">
                <label htmlFor="fzType" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Какой ФЗ?
                </label>
                <select
                  id="fzType"
                  className="discord-input w-full appearance-none pr-8"
                  style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                  {...register("fzType")}
                >
                  <option value="223">223 ФЗ</option>
                  <option value="44">44 ФЗ</option>
                </select>
              </div>

              {/* Реестр/Нереестр */}
              <div className="animate-slideUp delay-300">
                <label htmlFor="registryType" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                  Реестр/Нереестр
                </label>
                <select
                  id="registryType"
                  className="discord-input w-full appearance-none pr-8"
                  style={{backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23686b74' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
                  {...register("registryType")}
                >
                  <option value="registry">Реестр</option>
                  <option value="non-registry">Нереестр</option>
                </select>
              </div>
            </div>
          </div>

          {/* Комментарий */}
          <div className="animate-slideUp delay-300">
            <label htmlFor="comment" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
              Комментарий
            </label>
            <textarea
              id="comment"
              placeholder="Введите комментарий к заявке..."
              className="discord-input w-full resize-none"
              rows={4}
              {...register("comment")}
            />
          </div>

          {/* Индикатор прогресса */}
          {isLoading && (
            <div className="w-full bg-discord-dark rounded-full h-2 overflow-hidden animate-fadeIn">
              <div 
                className="h-full bg-discord-accent transition-all duration-300 rounded-full relative"
                style={{ width: `${loadingProgress}%` }}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <div className="animate-shimmer h-full w-full"></div>
                </div>
              </div>
            </div>
          )}

          {/* Кнопка */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className={`discord-btn-primary w-full py-3 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <>
                  <span className="opacity-0">Зарегистрировать проект</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Отправка...</span>
                  </span>
                </>
              ) : (
                "Зарегистрировать проект"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}