// --- Import base API client utilities ---
import { apiFetch, ApiError, PaginatedResponse, fetchBlobWithFilename } from './apiClient'; // Updated import
// --- Import related entity types ---
import { Product } from './productService';
import { Partner } from './partnerService';
import { EndClient } from './endClientService';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// --- Type Definitions specific to User Requests/Deal Registrations ---

// Новый интерфейс для данных формы "Регистрация сделки"
export interface DealRegistrationData {
  // --- Основные участники ---
  partnerId: number;          // Выбор партнера (обязательно)
  distributorId?: number | null; // Выбор дистрибьютора (опционально)
  
  // --- Конечный клиент ---
  endClientId?: number | null;   // ID найденного клиента
  endClientInn?: string;         // ИНН (для поиска/создания)
  endClientName?: string;        // Имя (для создания)
  endClientCity?: string;        // Город (для создания)
  endClientFullAddress?: string; // Полный адрес (для создания)
  endClientContactDetails?: string; // Контакты (для создания)
  endClientDetailsOverride?: string; // Дополнительные сведения о клиенте

  // --- Продукт/Спецификация ---
  productId?: number | null;     // ID выбранного продукта
  customItemSku?: string;        // Артикул кастомного продукта
  customItemName?: string;       // Название кастомного продукта
  customItemDescription?: string;// Описание кастомного продукта
  quantity?: number | null;      // Количество
  unitPrice?: number | null;     // Цена за единицу
  // total_price вычисляется на бэкенде

  // --- Параметры сделки ---
  dealDescription: string;           // Описание сути сделки (обязательно) - в БД: deal_state_description
  estimatedValue?: number | null;    // Оценочная стоимость 
  estimatedCloseDate?: string | null;// Ожидаемая дата закрытия (строка ГГГГ-ММ-ДД)
  fzLawType?: string;                // Тип ФЗ (например, "223", "44", ...)
  mptRegistryType?: string;          // Тип реестра МПТ
  partnerActivities?: string;        // Активности партнера
  partnerContactOverride?: string;   // Контактное лицо партнера для этой сделки

  // --- Вложение ---
  attachmentFile?: File | null;    // ТЗ/Вложение - в БД: overall_tz_file
}

// Общий интерфейс для заявки (подходит и для проекта, и для сделки?)
// Возможно, понадобятся специфичные поля для сделки
export interface Request {
  [x: string]: any; // Оставляем для гибкости, НО стараемся типизировать явно
  id: number;
  user_id: number; // ID пользователя, создавшего заявку
  // Поля из DealRegistrationData (если они сохраняются)
  partner_id?: number;
  distributor_id?: number; // Добавлено
  end_client_id?: number;
  deal_description?: string;
  estimated_value?: number;
  estimated_close_date?: string; // Добавлено
  fz_law_type?: string;          // Добавлено
  mpt_registry_type?: string;    // Добавлено
  partner_activities?: string;   // Добавлено
  partner_contact_override?: string; // Добавлено
  end_client_details_override?: string; // Используется для ненайденных/переопределенных клиентов
  // Общие поля
  status: string;
  created_at: string;
  updated_at: string;
  manager_comment?: string; // Комментарий менеджера
  // В деталях может быть больше информации
  partner?: Partner;     
  product?: Product; // Может быть null, если заявка с кастомным продуктом?
  end_client?: EndClient; 
  distributor?: Partner; // Добавлено
  items?: RequestItem[]; // Добавлено: Массив позиций заявки
  attachment_file_name?: string; 
  overall_tz_file?: string; // Имя файла из requests.overall_tz_file?
}

// Добавляем интерфейс для RequestItem (на основе server/models/request_item.go)
export interface RequestItem {
    id: number;
    request_id: number;
    product_id?: number | null;
    custom_item_sku?: string;
    custom_item_name?: string;
    custom_item_description?: string;
    quantity: number; // Предполагаем, что количество всегда есть
    unit_price?: number | null;
    total_price?: number | null;
    product?: Product | null; // Связанный продукт (если есть product_id)
}

// PaginatedResponse is imported from apiClient

// --- User-specific Request Service Functions ---

/**
 * Submits a new deal registration (User action).
 * Использует новый интерфейс DealRegistrationData.
 * Throws ApiError on failure. Returns the created Request on success.
 */
export async function submitDealRegistration(data: DealRegistrationData): Promise<Request> {
  // Валидация для новой формы
  if (!data.partnerId || !data.dealDescription || (!data.endClientId && !data.endClientInn)) {
     throw new ApiError("Пожалуйста, заполните все обязательные поля (Партнер, Описание сделки, ИНН или ID конечного клиента).", 400);
  }
  if (!data.endClientId && data.endClientInn && !data.endClientName) {
      throw new ApiError("Пожалуйста, укажите Наименование нового конечного клиента.", 400);
  }

  // Всегда используем FormData, как ожидает сервер
  const formData = new FormData();
  
  // Создаем JSON-объект для поля request_data
  const requestDataPayload: any = {
    partner_id: data.partnerId,
    deal_state_description: data.dealDescription,
  };
  
  // Конечный клиент
  if (data.endClientId) {
    requestDataPayload.end_client_id = data.endClientId;
  }
  if (data.endClientInn) {
    requestDataPayload.end_client_inn = data.endClientInn;
  }
  if (data.endClientName) {
    requestDataPayload.end_client_name = data.endClientName;
  }
  if (data.endClientCity) {
    requestDataPayload.end_client_city = data.endClientCity;
  }
  if (data.endClientFullAddress) {
    requestDataPayload.end_client_full_address = data.endClientFullAddress;
  }
  if (data.endClientContactDetails) {
    requestDataPayload.end_client_contact_details = data.endClientContactDetails;
  }
  if (data.endClientDetailsOverride) {
    requestDataPayload.end_client_details_override = data.endClientDetailsOverride;
  }
  
  // Продукт и параметры
  if (data.productId) {
    requestDataPayload.product_id = data.productId;
  }
  if (data.customItemSku) {
    requestDataPayload.custom_item_sku = data.customItemSku;
  }
  if (data.customItemName) {
    requestDataPayload.custom_item_name = data.customItemName;
  }
  if (data.customItemDescription) {
    requestDataPayload.custom_item_description = data.customItemDescription;
  }
  if (data.quantity !== null && data.quantity !== undefined) {
    requestDataPayload.quantity = data.quantity;
  }
  if (data.unitPrice !== null && data.unitPrice !== undefined) {
    requestDataPayload.unit_price = data.unitPrice;
  }
  
  // Параметры сделки
  if (data.estimatedCloseDate) {
    // Преобразуем дату из формата день.месяц.год в формат YYYY-MM-DD
    try {
      console.log("Исходная дата:", data.estimatedCloseDate);
      
      // Если дата уже в формате YYYY-MM-DD и корректна
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.estimatedCloseDate)) {
        const [year, month, day] = data.estimatedCloseDate.split('-').map(Number);
        if (year > 1900 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          requestDataPayload.estimated_close_date = data.estimatedCloseDate;
        } else {
          throw new Error(`Invalid date components: ${data.estimatedCloseDate}`);
        }
      } 
      // Если дата в формате ДД.ММ.ГГГГ
      else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(data.estimatedCloseDate)) {
        const parts = data.estimatedCloseDate.split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        
        // Проверка на корректность компонентов даты
        const yearNum = Number(year);
        const monthNum = Number(month);
        const dayNum = Number(day);
        
        if (yearNum > 1900 && yearNum < 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          requestDataPayload.estimated_close_date = `${year}-${month}-${day}`;
        } else {
          throw new Error(`Invalid date components: ${day}.${month}.${year}`);
        }
      }
      // Обработка формата с неправильным годом (например, 29.03.123123)
      else if (/^\d{1,2}\.\d{1,2}\.\d+$/.test(data.estimatedCloseDate)) {
        const parts = data.estimatedCloseDate.split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        
        // Исправляем неправильный год, берем только последние 4 цифры или дополняем до 4
        let year = parts[2];
        if (year.length > 4) {
          year = year.substring(year.length - 4);
        } else if (year.length < 4) {
          year = year.padStart(4, '2'); // Дополняем до 4 цифр, начиная с 2
        }
        
        // Проверка на корректность компонентов даты после коррекции
        const yearNum = Number(year);
        const monthNum = Number(month);
        const dayNum = Number(day);
        
        if (yearNum > 1900 && yearNum < 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          requestDataPayload.estimated_close_date = `${year}-${month}-${day}`;
          console.log("Исправленная дата:", requestDataPayload.estimated_close_date);
        } else {
          throw new Error(`Invalid date components after correction: ${day}.${month}.${year}`);
        }
      }
      // Иначе пытаемся обработать как обычную дату
      else {
        const date = new Date(data.estimatedCloseDate);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${data.estimatedCloseDate}`);
        }
        
        // Получаем компоненты и проверяем их на корректность
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        if (year > 1900 && year < 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          requestDataPayload.estimated_close_date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else {
          throw new Error(`Invalid date components from Date object: ${date.toISOString()}`);
        }
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      throw new ApiError("Неверный формат даты закрытия сделки. Используйте формат ДД.ММ.ГГГГ (например, 29.03.2023)", 400);
    }
  }
  
  if (data.fzLawType) {
    requestDataPayload.fz_law_type = data.fzLawType;
  }
  if (data.mptRegistryType) {
    requestDataPayload.mpt_registry_type = data.mptRegistryType;
  }
  if (data.partnerActivities) {
    requestDataPayload.partner_activities = data.partnerActivities;
  }
  if (data.partnerContactOverride) {
    requestDataPayload.partner_contact_override = data.partnerContactOverride;
  }
  if (data.distributorId) {
    requestDataPayload.distributor_id = data.distributorId;
  }

  // Добавляем JSON в один параметр формы, как ожидает сервер
  formData.append('request_data', JSON.stringify(requestDataPayload));
  
  // Файл, если есть
  if (data.attachmentFile) {
    formData.append('overall_tz_file', data.attachmentFile);
  }

  try {
    console.log("Sending request as FormData with request_data field");
    
    // Отправляем запрос на сервер
    const createdRequest = await apiFetch<Request>('/api/requests', {
      method: 'POST',
      body: formData,
      // FormData автоматически установит правильный Content-Type
    });
    return createdRequest;
  } catch (err) {
    // Логируем ошибку и перебрасываем её
    console.error("Error submitting deal registration:", err);
    throw err;
  }
}

/**
 * Fetches requests (projects or deals) for the current user (paginated).
 * Throws ApiError on failure. Returns PaginatedResponse<Request> on success.
 */
export async function getUserRequests(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Request>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  try {
    // User endpoint for getting their requests (projects and/or deals)
    const response = await apiFetch<PaginatedResponse<Request>>(`/api/requests/my?${params.toString()}`);
    
    // Проверяем, что в ответе есть данные и они соответствуют ожидаемой структуре
    if (response && response.items) {
      // Преобразуем ответ для совместимости с клиентским интерфейсом
      response.items = response.items.map(req => {
        // Правильное формирование связанных объектов
        return {
          ...req,
          // Добавляем информацию о партнере, если есть partner_id
          partner: req.partner || (req.partner_id ? { 
            id: req.partner_id, 
            name: req.partner_name || `Партнер #${req.partner_id}`,
            created_at: '',
            updated_at: ''
          } : undefined),
          
          // Добавляем информацию о продукте, если есть product_id
          product: req.product || (req.product_id ? {
            id: req.product_id,
            name: req.product_name || `Продукт #${req.product_id}`,
            sku: req.product_sku || '',
            item_type: req.product_item_type || '',
            unit_price: req.product_unit_price || 0,
            description: req.product_description || '',
            created_at: '',
            updated_at: ''
          } : undefined),
          
          // Добавляем информацию о конечном клиенте, если есть end_client_id
          end_client: req.end_client || (req.end_client_id ? {
            id: req.end_client_id,
            name: req.end_client_name || `Клиент #${req.end_client_id}`,
            inn: req.end_client_inn || '',
            created_at: '',
            updated_at: ''
          } : undefined)
        };
      });
    }
    
    return response;
  } catch (err) {
    console.error(`User: Error fetching requests (page: ${page}, limit: ${limit}):`, err);
    throw err;
  }
}

/**
 * Fetches the details of a specific request (project or deal) for the current user.
 * Throws ApiError on failure. Returns the detailed Request on success.
 */
export async function getRequestDetails(id: number): Promise<Request> {
  try {
    // API-запрос для получения подробной информации о заявке
    return await apiFetch<Request>(`/api/requests/my/${id}`);
  } catch (err) {
    console.error(`Error fetching request details for ID ${id}:`, err);
    throw err;
  }
}

/**
 * Downloads the attachment file associated with a specific request for the current user.
 * Throws ApiError on failure. Returns { blob: Blob, filename: string } on success.
 */
export async function downloadRequestFile(id: number): Promise<{ blob: Blob; filename: string }> {
  try {
    // Скачивание файла через fetchBlobWithFilename
    return await fetchBlobWithFilename(`/api/requests/${id}/download`);
  } catch (err) {
    console.error(`Error downloading file for request ${id}:`, err);
    throw err;
  }
}

// --- Functions moved to managerRequestService.ts or draftService.ts ---
// getAllRequests
// getRequestById (User version is getRequestDetails)
// updateRequestStatus
// deleteRequest
// saveDraft, loadDraft, clearDraft

// --- Deprecated function --- (Optional: Mark old function explicitly)
/**
 * @deprecated Use submitProjectRequest for old form or submitDealRegistration for new form.
 */
// export const submitRequest = submitProjectRequest;