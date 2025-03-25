interface RequestData {
    inn: string;
    organizationName: string;
    tzFile: File | null;
    implementationDate: string;
    fzType: string;
    comment: string;
    registryType: string;
  }
  
  export interface Request {
    id: number;
    user_id: number;
    inn: string;
    organization_name: string;
    implementation_date: string;
    fz_type: string;
    registry_type: string;
    comment: string;
    tz_file: string;
    status: string;
    created_at: string;
    updated_at: string;
  }
  
  interface RequestResponse {
    success: boolean;
    data?: {
      id?: number;
      requestId?: number;
      status?: string;
      [key: string]: unknown; // For any additional properties
    };
    error?: string;
  }
  
  export async function submitRequest(data: RequestData): Promise<RequestResponse> {
    try {
      if (!data.inn || !data.organizationName || !data.tzFile || !data.implementationDate) {
        return {
          success: false,
          error: "Пожалуйста, заполните все обязательные поля."
        };
      }
  
      const formData = new FormData();
      formData.append("inn", data.inn);
      formData.append("organization_name", data.organizationName);
      if (data.tzFile) formData.append("tz_file", data.tzFile);
      formData.append("implementation_date", data.implementationDate);
      formData.append("fz_type", data.fzType);
      formData.append("comment", data.comment);
      formData.append("registry_type", data.registryType);
  
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
  
      if (!res.ok) {
        const errorData = await res.json();
        const message = errorData.message || "Ошибка отправки заявки";
        
        if (res.status === 400) return { success: false, error: "Неверный формат данных." };
        if (res.status === 401) return { success: false, error: "Не авторизован." };
        
        return { success: false, error: message };
      }
  
      const responseData = await res.json();
      return {
        success: true,
        data: responseData
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Неизвестная ошибка"
      };
    }
  }
  
  export async function getUserRequests(page?: number, limit?: number): Promise<{ success: boolean; requests?: Request[]; total?: number; error?: string }> {
    try {
      // Проверка сетевого соединения
      if (typeof window !== 'undefined' && !navigator.onLine) {
        return { 
          success: false, 
          error: "Отсутствует подключение к интернету. Проверьте соединение и попробуйте снова." 
        };
      }

      // Формирование URL с параметрами пагинации, если они предоставлены
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/requests`;
      if (page && limit) {
        // Преобразуем page в offset
        const offset = (page - 1) * limit;
        url += `?limit=${limit}&offset=${offset}`;
      }

      // Установка таймаута для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаута

      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, error: "Не авторизован" };
        }
        
        if (res.status === 404) {
          return { success: false, error: "Заявки не найдены" };
        }
        
        if (res.status >= 500) {
          return { success: false, error: "Ошибка сервера. Пожалуйста, попробуйте позже." };
        }
        
        return { success: false, error: "Не удалось загрузить заявки" };
      }

      const data = await res.json();
      
      // Проверяем формат ответа - если это объект с пагинацией
      if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
        return { 
          success: true, 
          requests: data.items,
          total: data.total
        };
      }
      
      // Стандартный формат - массив заявок
      if (Array.isArray(data)) {
        return { success: true, requests: data };
      }
      
      return { success: false, error: "Неверный формат данных от сервера" };
    } catch (err: unknown) {
      console.error("Ошибка загрузки заявок:", err);
      
      // Обработка ошибки таймаута
      if (err instanceof DOMException && err.name === "AbortError") {
        return { 
          success: false, 
          error: "Превышено время ожидания ответа от сервера. Пожалуйста, попробуйте позже." 
        };
      }
      
      // Обработка сетевых ошибок
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        return { 
          success: false, 
          error: "Не удалось соединиться с сервером. Проверьте подключение к интернету." 
        };
      }
      
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Неизвестная ошибка при загрузке заявок" 
      };
    }
  }
  
  // Функция для сохранения и загрузки черновиков
  export function saveDraft(data: Partial<RequestData>): void {
    try {
      const draftData = { ...data };
      delete draftData.tzFile;
      localStorage.setItem('draftProject', JSON.stringify(draftData));
    } catch (error) {
      console.error("Ошибка сохранения черновика:", error);
    }
  }
  
  export function loadDraft(): Partial<RequestData> | null {
    try {
      const draftData = localStorage.getItem('draftProject');
      return draftData ? JSON.parse(draftData) : null;
    } catch (error) {
      console.error("Ошибка загрузки черновика:", error);
      return null;
    }
  }

  /**
   * Функция для скачивания файла ТЗ с обработкой ошибок
   */
  export async function downloadTzFile(requestId: number): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      // Проверка сетевого соединения
      if (typeof window !== 'undefined' && !navigator.onLine) {
        return { 
          success: false, 
          error: "Отсутствует подключение к интернету. Проверьте соединение и попробуйте снова." 
        };
      }
      
      // Установка таймаута для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаута
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests/${requestId}/tz_file`, {
        credentials: "include",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: "Не авторизован" };
        }
        
        if (response.status === 404) {
          return { success: false, error: "Файл не найден" };
        }
        
        if (response.status >= 500) {
          return { success: false, error: "Ошибка сервера. Пожалуйста, попробуйте позже." };
        }
        
        return { success: false, error: `Ошибка загрузки файла: ${response.status}` };
      }
      
      const blob = await response.blob();
      
      // Извлекаем имя файла из заголовков ответа
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'tz_file';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      return { success: true, blob, filename };
    } catch (err: unknown) {
      console.error("Ошибка при скачивании файла:", err);
      
      // Обработка ошибки таймаута
      if (err instanceof DOMException && err.name === "AbortError") {
        return { 
          success: false, 
          error: "Превышено время ожидания ответа от сервера. Пожалуйста, попробуйте позже." 
        };
      }
      
      // Обработка сетевых ошибок
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        return { 
          success: false, 
          error: "Не удалось соединиться с сервером. Проверьте подключение к интернету." 
        };
      }
      
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Неизвестная ошибка при скачивании файла" 
      };
    }
  }

  /**
   * Функция для получения общего количества заявок пользователя
   */
  export async function getTotalRequestsCount(): Promise<{ success: boolean; total?: number; error?: string }> {
    try {
      // Проверка сетевого соединения
      if (typeof window !== 'undefined' && !navigator.onLine) {
        return { 
          success: false, 
          error: "Отсутствует подключение к интернету. Проверьте соединение и попробуйте снова." 
        };
      }
      
      // На случай, если у сервера нет специального метода для подсчета,
      // делаем запрос с большим лимитом, чтобы определить общее количество
      // Запрашиваем только 1 элемент, но со смещением 0 и count=true
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/requests?limit=1&offset=0&count=true`;
      
      // Установка таймаута для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаута
      
      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, error: "Не авторизован" };
        }
        
        return { success: false, error: "Не удалось получить количество заявок" };
      }
      
      const data = await res.json();
      
      // Проверяем, содержит ли ответ поле total
      if (data && 'total' in data) {
        return { success: true, total: data.total };
      }
      
      // Если сервер вернул массив вместо объекта с total,
      // мы не можем точно определить общее количество
      return { success: false, error: "Сервер не поддерживает подсчет общего количества" };
    } catch (err: unknown) {
      console.error("Ошибка при получении количества заявок:", err);
      
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Неизвестная ошибка" 
      };
    }
  }