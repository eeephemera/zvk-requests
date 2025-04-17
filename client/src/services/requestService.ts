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
  distributorId?: number | null; // Выбор дистрибьютора (опционально?)
  
  // --- Конечный клиент ---
  endClientId?: number | null;   // ID найденного клиента
  endClientInn?: string;         // ИНН (для поиска/создания)
  endClientName?: string;        // Имя (для создания)
  endClientCity?: string;        // Город (для создания)
  endClientFullAddress?: string; // Полный адрес (для создания)
  endClientContactDetails?: string; // Контакты (для создания)

  // --- Продукт/Спецификация (одна позиция) ---
  productId?: number | null;         // ID выбранного продукта (опционально, если кастомный)
  customItemSku?: string;        // Артикул кастомного продукта
  customItemName?: string;       // Название кастомного продукта
  customItemDescription?: string;// Описание кастомного продукта
  quantity?: number | null;        // Количество (для кастомного или стандартного?)
  unitPrice?: number | null;       // Цена за ед. (для кастомного?) 
  // total_price будет вычисляться на бэкенде?

  // --- Параметры сделки ---
  dealDescription: string;           // Описание сути сделки (обязательно)
  estimatedValue?: number | null;    // Оценочная стоимость (опционально)
  estimatedCloseDate?: string | null;// Ожидаемая дата закрытия (опционально, строка ГГГГ-ММ-ДД)
  fzLawType?: string;                // Тип ФЗ (например, "223", "44", "Коммерческий", "-")?
  mptRegistryType?: string;          // Тип реестра (например, "Реестр", "Нереестр", "Неприменимо")?
  partnerActivities?: string;        // Активности партнера (текст)
  partnerContactOverride?: string;   // Контактное лицо партнера для этой сделки (текст)

  // --- Вложение ---
  attachmentFile?: File | null;    // ТЗ/Вложение (опционально)
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
 * TODO: Implement actual API call when the backend endpoint is ready.
 * TODO: Decide if using FormData or JSON (if file is optional/handled differently).
 * Throws ApiError on failure. Returns the created Request on success.
 */
export async function submitDealRegistration(data: DealRegistrationData): Promise<Request> {
  console.warn("submitDealRegistration: API call not implemented yet.");
  // Валидация для новой формы
  if (!data.partnerId || !data.dealDescription || (!data.endClientId && !data.endClientInn)) {
     throw new ApiError("Пожалуйста, заполните все обязательные поля (Партнер, Описание сделки, ИНН или ID конечного клиента).", 400);
  }
  if (!data.endClientId && data.endClientInn && !data.endClientName) {
      throw new ApiError("Пожалуйста, укажите Наименование нового конечного клиента.", 400);
  }

  // Определяем, как отправлять: FormData или JSON
  // Если есть файл, то FormData предпочтительнее.
  const useFormData = !!data.attachmentFile;
  let body: FormData | string;

  if (useFormData) {
      const formData = new FormData();
      formData.append("partner_id", data.partnerId.toString());
      formData.append("deal_description", data.dealDescription);
      if (data.endClientId) {
          formData.append("end_client_id", data.endClientId.toString());
      }
      if (data.endClientInn) {
          formData.append("end_client_inn", data.endClientInn);
      }
      if (data.endClientName) { // Отправляем только если создаем нового
          formData.append("end_client_name", data.endClientName);
      }
       if (data.endClientCity) { // Отправляем только если создаем нового
          formData.append("end_client_city", data.endClientCity);
      }
      if (data.endClientFullAddress) { // Отправляем только если создаем нового
          formData.append("end_client_full_address", data.endClientFullAddress);
      }
      if (data.endClientContactDetails) { // Отправляем только если создаем нового
          formData.append("end_client_contact_details", data.endClientContactDetails);
      }
      if (data.estimatedValue !== null && data.estimatedValue !== undefined) { // Проверяем на null и undefined
          formData.append("estimated_value", data.estimatedValue.toString());
      }
      if (data.estimatedCloseDate) {
          formData.append("estimated_close_date", data.estimatedCloseDate);
      }
      if (data.fzLawType) {
          formData.append("fz_law_type", data.fzLawType);
      }
      if (data.mptRegistryType) {
          formData.append("mpt_registry_type", data.mptRegistryType);
      }
      if (data.partnerActivities) {
          formData.append("partner_activities", data.partnerActivities);
      }
      if (data.partnerContactOverride) {
          formData.append("partner_contact_override", data.partnerContactOverride);
      }
      if (data.productId) {
          formData.append("product_id", data.productId.toString());
      }
      if (data.customItemSku) {
          formData.append("custom_item_sku", data.customItemSku);
      }
      if (data.customItemName) {
          formData.append("custom_item_name", data.customItemName);
      }
      if (data.customItemDescription) {
          formData.append("custom_item_description", data.customItemDescription);
      }
      if (data.quantity !== null && data.quantity !== undefined) {
          formData.append("quantity", data.quantity.toString());
      }
      if (data.unitPrice !== null && data.unitPrice !== undefined) {
          formData.append("unit_price", data.unitPrice.toString());
      }
      if (data.attachmentFile) {
          formData.append("attachment_file", data.attachmentFile);
      }
      body = formData;
    } else {
      // Отправка как JSON
      const payload: any = {
          partner_id: data.partnerId,
          deal_description: data.dealDescription,
      };
      if (data.endClientId) {
           payload.end_client_id = data.endClientId;
      }
       if (data.endClientInn) {
           payload.end_client_inn = data.endClientInn;
      }
       if (data.endClientName) { // Отправляем только если создаем нового
           payload.end_client_name = data.endClientName;
      }
      if (data.endClientCity) { // Отправляем только если создаем нового
           payload.end_client_city = data.endClientCity;
      }
       if (data.endClientFullAddress) { // Отправляем только если создаем нового
           payload.end_client_full_address = data.endClientFullAddress;
      }
       if (data.endClientContactDetails) { // Отправляем только если создаем нового
           payload.end_client_contact_details = data.endClientContactDetails;
      }
       if (data.estimatedValue !== null && data.estimatedValue !== undefined) { // Проверяем на null и undefined
           payload.estimated_value = data.estimatedValue;
      }
      if (data.estimatedCloseDate) {
          payload.estimated_close_date = data.estimatedCloseDate;
      }
      if (data.fzLawType) {
          payload.fz_law_type = data.fzLawType;
      }
      if (data.mptRegistryType) {
          payload.mpt_registry_type = data.mptRegistryType;
      }
      if (data.partnerActivities) {
          payload.partner_activities = data.partnerActivities;
      }
      if (data.partnerContactOverride) {
          payload.partner_contact_override = data.partnerContactOverride;
      }
      if (data.productId) {
          payload.product_id = data.productId;
      }
      if (data.customItemSku) {
          payload.custom_item_sku = data.customItemSku;
      }
      if (data.customItemName) {
          payload.custom_item_name = data.customItemName;
      }
      if (data.customItemDescription) {
          payload.custom_item_description = data.customItemDescription;
      }
      if (data.quantity !== null && data.quantity !== undefined) {
          payload.quantity = data.quantity;
      }
      if (data.unitPrice !== null && data.unitPrice !== undefined) {
          payload.unit_price = data.unitPrice;
      }
      body = JSON.stringify(payload);
  }

  try {
    // TODO: Уточнить эндпоинт для регистрации сделок. Может быть тот же /api/requests?
    // Бэкенд должен будет определить тип запроса по наличию partner_id/product_id.
    // const createdRequest = await apiFetch<Request>('/api/requests', {
    //   method: 'POST',
    //   body: body,
    //   // Если отправляем JSON, нужен заголовок
    //   headers: useFormData ? undefined : { 'Content-Type': 'application/json' },
    // });
    // return createdRequest;

    // Моковый ответ
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log("Mock submitting deal registration with data:", data);
    const mockId = Math.floor(Math.random() * 1000) + 500;
    // Возвращаем моковый объект Request
    return {
      id: mockId,
      user_id: 1, // Пример ID пользователя
      partner_id: data.partnerId,
      end_client_id: data.endClientId ?? undefined,
      deal_description: data.dealDescription,
      estimated_value: data.estimatedValue === null ? undefined : data.estimatedValue,
      status: "На рассмотрении", // Начальный статус
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

  } catch (err) {
    console.error("User: Error submitting deal registration:", err);
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
    return await apiFetch<PaginatedResponse<Request>>(`/api/requests/my?${params.toString()}`); // Используем /my эндпоинт
  } catch (err) {
    console.error(`User: Error fetching requests (page: ${page}, limit: ${limit}):`, err);
        throw err;
  }
}

/**
 * Fetches the details of a specific request (project or deal) for the current user.
 * TODO: Implement actual API call when the backend endpoint is ready.
 * Throws ApiError on failure. Returns the detailed Request on success.
 */
export async function getRequestDetails(id: number): Promise<Request> {
    console.warn(`getRequestDetails(${id}): API call not implemented yet.`);
    // TODO: Обновить моковые данные или реализовать реальный вызов
    // return await apiFetch<Request>(`/api/requests/my/${id}`);

    // Обновленный моковый ответ (только для сделок)
    await new Promise(resolve => setTimeout(resolve, 700));
    const baseRequest: Partial<Request> = {
        id: id,
        user_id: 1,
        status: ['На рассмотрении', 'В работе', 'Выполнена'][id % 3],
        created_at: new Date(Date.now() - 86400000 * (id % 5)).toISOString(),
        updated_at: new Date().toISOString(),
    };

    // Теперь все заявки - это "сделки"
    return {
        ...baseRequest,
        partner_id: 101 + (id % 3),
        end_client_id: 201 + (id % 2),
        deal_description: 'Описание сделки номер ' + id + '. Очень важная сделка.',
        estimated_value: 100000 * (id % 5 + 1),
        partner: { id: 101 + (id % 3), name: `Партнер ${101 + (id % 3)}`, created_at: '', updated_at: ''}, 
        end_client: { id: 201 + (id % 2), name: `Конечный Клиент ${201 + (id % 2)}`, inn: `ИНН-${201 + (id % 2)}`, created_at: '', updated_at: ''},
        status: baseRequest.status ?? 'На рассмотрении',
        created_at: baseRequest.created_at ?? '',
        updated_at: baseRequest.updated_at ?? '',
    } as Request;
}

/**
 * Downloads the attachment file associated with a specific request for the current user.
 * TODO: Implement actual API call when the backend endpoint is ready.
 * Throws ApiError on failure. Returns { blob: Blob, filename: string } on success.
 */
export async function downloadRequestFile(id: number): Promise<{ blob: Blob; filename: string }> {
    console.warn(`downloadRequestFile(${id}): API call not implemented yet.`);
    // return await fetchBlobWithFilename(`/api/requests/download/${id}`);

    // Моковый ответ
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Имя файла теперь всегда attachment_...
    const filename = `attachment_${id}.docx`; 
    const content = `Это моковое содержимое файла для заявки ${id}.\nИмя файла: ${filename}\nТип: Сделка`;    
    const blob = new Blob([content], { type: 'text/plain' });

    return { blob, filename };
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