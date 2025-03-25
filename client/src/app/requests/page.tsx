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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">
            Регистрация проекта
          </h1>
          <Link 
            href="/my-requests" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Мои заявки
          </Link>
        </div>

        {/* Сообщения */}
        {(error || success) && (
          <div className="mb-4 text-center">
            {error && <p className="text-red-400">{error}</p>}
            {success && <p className="text-green-400">{success}</p>}
          </div>
        )}

        <form 
          ref={formRef} 
          className="space-y-4" 
          onSubmit={handleSubmit(onSubmit)}
          onChange={handleFormChange}
        >
          {/* Основная сетка */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левая колонка */}
            <div className="space-y-4">
              {/* ИНН */}
              <div>
                <label htmlFor="inn" className="block text-gray-300 text-sm mb-1">
                  ИНН <span className="text-red-400">*</span>
                </label>
                <input
                  id="inn"
                  type="text"
                  placeholder="Введите ИНН"
                  className={`w-full p-2 rounded bg-gray-700 text-white border ${errors.inn ? 'border-red-500' : 'border-gray-600'} focus:outline-none focus:ring-2 focus:ring-green-500 text-sm`}
                  {...register("inn", { required: "ИНН обязателен", pattern: {
                    value: /^\d{10}$|^\d{12}$/,
                    message: "ИНН должен содержать 10 или 12 цифр"
                  }})}
                />
                {errors.inn && <p className="text-red-400 text-xs mt-1">{errors.inn.message}</p>}
              </div>

              {/* Наименование организации */}
              <div>
                <label htmlFor="organizationName" className="block text-gray-300 text-sm mb-1">
                  Наименование организации <span className="text-red-400">*</span>
                </label>
                <input
                  id="organizationName"
                  type="text"
                  placeholder="Название организации"
                  className={`w-full p-2 rounded bg-gray-700 text-white border ${errors.organizationName ? 'border-red-500' : 'border-gray-600'} focus:outline-none focus:ring-2 focus:ring-green-500 text-sm`}
                  {...register("organizationName", { required: "Название организации обязательно" })}
                />
                {errors.organizationName && <p className="text-red-400 text-xs mt-1">{errors.organizationName.message}</p>}
              </div>

              {/* Прикрепить ТЗ */}
              <div>
                <label htmlFor="tzFile" className="block text-gray-300 text-sm mb-1">
                  Прикрепить ТЗ <span className="text-red-400">*</span>
                </label>
                <input
                  id="tzFile"
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  required
                />
                
                {/* Превью файла */}
                {filePreview && (
                  <div className="mt-2 p-2 bg-gray-700 rounded flex items-center">
                    {filePreview.startsWith('data:image') ? (
                      <Image 
                        src={filePreview} 
                        alt="Превью" 
                        width={64}
                        height={64}
                        className="h-16 w-auto object-contain mr-2" 
                      />
                    ) : (
                      <div className="h-12 w-12 bg-gray-600 rounded flex items-center justify-center mr-2">
                        <span className="text-xl">{filePreview}</span>
                      </div>
                    )}
                    <div className="text-sm text-gray-300 truncate">{fileName}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Правая колонка */}
            <div className="space-y-4">
              {/* Дата реализации */}
              <div>
                <label htmlFor="implementationDate" className="block text-gray-300 text-sm mb-1">
                  Дата реализации <span className="text-red-400">*</span>
                </label>
                <input
                  id="implementationDate"
                  type="date"
                  className={`w-full p-2 rounded bg-gray-700 text-white border ${errors.implementationDate ? 'border-red-500' : 'border-gray-600'} focus:outline-none focus:ring-2 focus:ring-green-500 text-sm`}
                  {...register("implementationDate", { required: "Дата реализации обязательна" })}
                />
                {errors.implementationDate && <p className="text-red-400 text-xs mt-1">{errors.implementationDate.message}</p>}
              </div>

              {/* Какой ФЗ? */}
              <div>
                <label htmlFor="fzType" className="block text-gray-300 text-sm mb-1">
                  Какой ФЗ?
                </label>
                <select
                  id="fzType"
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  {...register("fzType")}
                >
                  <option value="223">223 ФЗ</option>
                  <option value="44">44 ФЗ</option>
                </select>
              </div>

              {/* Реестр/Нереестр */}
              <div>
                <label htmlFor="registryType" className="block text-gray-300 text-sm mb-1">
                  Реестр/Нереестр
                </label>
                <select
                  id="registryType"
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  {...register("registryType")}
                >
                  <option value="registry">Реестр</option>
                  <option value="non-registry">Нереестр</option>
                </select>
              </div>
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label htmlFor="comment" className="block text-gray-300 text-sm mb-1">
              Комментарий
            </label>
            <textarea
              id="comment"
              placeholder="Введите комментарий"
              className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              rows={3}
              {...register("comment")}
            />
          </div>

          {/* Индикатор прогресса */}
          {isLoading && (
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
              <div 
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          )}

          {/* Кнопка */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded text-white font-semibold transition-colors ${
                isLoading ? "bg-green-800 relative" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isLoading ? (
                <>
                  <span className="opacity-0">Зарегистрировать проект</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2">Отправка...</span>
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