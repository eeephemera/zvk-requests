package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RequestRepository предоставляет методы для работы с таблицами requests и request_items.
type RequestRepository struct {
	pool *pgxpool.Pool
}

func (repo *RequestRepository) GetRequestByIDWithoutUser(context context.Context, id int) (any, error) {
	panic("unimplemented")
}

// NewRequestRepository создаёт новый RequestRepository.
func NewRequestRepository(pool *pgxpool.Pool) *RequestRepository {
	return &RequestRepository{pool: pool}
}

// CreateRequest вставляет новую заявку и ее элементы спецификации в базу данных.
// Выполняется в рамках одной транзакции.
func (repo *RequestRepository) CreateRequest(ctx context.Context, req *models.Request) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Гарантированный откат в случае любой ошибки
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p) // re-throw panic after Rollback
		} else if err != nil {
			if rbErr := tx.Rollback(ctx); rbErr != nil {
				log.Printf("Error rolling back transaction: %v (original error: %v)", rbErr, err)
			}
		} else {
			err = tx.Commit(ctx) // Commit returns error
			if err != nil {
				log.Printf("Error committing transaction: %v", err)
			}
		}
	}()

	// 1. Вставляем основную запись заявки
	requestQuery := `
		INSERT INTO requests (
			partner_user_id, partner_id, end_client_id, end_client_details_override,
			distributor_id, partner_contact_override, fz_law_type, mpt_registry_type,
			partner_activities, deal_state_description, estimated_close_date,
			overall_tz_file, status, manager_comment
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(ctx, requestQuery,
		req.PartnerUserID, req.PartnerID, req.EndClientID, req.EndClientDetailsOverride,
		req.DistributorID, req.PartnerContactOverride, req.FZLawType, req.MPTRegistryType,
		req.PartnerActivities, req.DealStateDescription, req.EstimatedCloseDate,
		req.OverallTZFile, req.Status, req.ManagerComment, // Status может быть установлен в 'На рассмотрении' по умолчанию в БД
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert request: %w", err)
	}

	// 2. Вставляем элементы спецификации, если они есть
	if len(req.Items) > 0 {
		itemQuery := `
			INSERT INTO request_items (
				request_id, product_id, custom_item_sku, custom_item_name,
				custom_item_description, quantity, unit_price, total_price
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		// Используем Batch для более эффективной вставки множества строк
		batch := &pgx.Batch{}
		for _, item := range req.Items {
			batch.Queue(itemQuery,
				req.ID, item.ProductID, item.CustomItemSKU, item.CustomItemName,
				item.CustomItemDescription, item.Quantity, item.UnitPrice, item.TotalPrice,
			)
		}

		results := tx.SendBatch(ctx, batch)
		// Важно закрыть results, чтобы освободить соединение
		defer results.Close()

		// Проверяем ошибки для каждой операции в батче
		for i := 0; i < len(req.Items); i++ {
			_, itemErr := results.Exec()
			if itemErr != nil {
				err = fmt.Errorf("failed to insert request item %d: %w", i, itemErr)
				return err // Ошибка вставки элемента, вызываем Rollback в defer
			}
			// Можно было бы сканировать ID, если нужно: .Scan(&req.Items[i].ID)
		}
	}

	// Если ошибок не было, Commit будет вызван в defer
	return nil
}

// GetRequestDetailsByID возвращает полную информацию о заявке по ID, включая связанные данные.
// Не проверяет права доступа - это задача для слоя обработчиков.
func (repo *RequestRepository) GetRequestDetailsByID(ctx context.Context, requestID int) (*models.Request, error) {
	// 1. Получаем основную информацию о заявке
	query := `
		SELECT 
			r.id, r.partner_user_id, r.partner_id, r.end_client_id, r.end_client_details_override,
			r.distributor_id, r.partner_contact_override, r.fz_law_type, r.mpt_registry_type,
			r.partner_activities, r.deal_state_description, r.estimated_close_date,
			r.overall_tz_file, r.status, r.manager_comment, r.created_at, r.updated_at,
			-- Данные пользователя
			u.id, u.login, u.role, u.partner_id, u.name, u.email, u.phone, u.created_at,
			-- Данные партнера
			p.id, p.name, p.address, p.inn, p.partner_status, p.assigned_manager_id, p.created_at, p.updated_at,
			-- Данные конечного клиента (если есть ID)
			ec.id, ec.name, ec.city, ec.inn, ec.full_address, ec.contact_person_details, ec.created_at, ec.updated_at,
			-- Данные дистрибьютора (если есть ID)
			d.id, d.name, d.address, d.inn, d.partner_status, d.assigned_manager_id, d.created_at, d.updated_at
		FROM requests r
		JOIN users u ON r.partner_user_id = u.id
		JOIN partners p ON r.partner_id = p.id
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
		LEFT JOIN partners d ON r.distributor_id = d.id -- Предполагаем, что дистрибьютор тоже партнер
		WHERE r.id = $1
	`
	var req models.Request
	var user models.User
	var partner models.Partner
	var endClient models.EndClient
	var distributor models.Partner
	var endClientID sql.NullInt64       // Для обработки NULL end_client_id
	var distributorID sql.NullInt64     // Для обработки NULL distributor_id
	var estimatedCloseDate sql.NullTime // Для обработки NULL даты
	var partnerAddress, partnerINN, partnerStatus, endClientCity, endClientInn, endClientFullAddress, endClientContactPersonDetails *string
	var endClientDetailsOverride, partnerContactOverride, fzLawType, mptRegistryType, partnerActivities, dealStateDescription, managerComment *string
	var userEmail, userName, userPhone *string

	err := repo.pool.QueryRow(ctx, query, requestID).Scan(
		&req.ID, &req.PartnerUserID, &req.PartnerID, &endClientID, &endClientDetailsOverride,
		&distributorID, &partnerContactOverride, &fzLawType, &mptRegistryType,
		&partnerActivities, &dealStateDescription, &estimatedCloseDate,
		&req.OverallTZFile, &req.Status, &managerComment, &req.CreatedAt, &req.UpdatedAt,
		// User
		&user.ID, &user.Login, &user.Role, &user.PartnerID, &userName, &userEmail, &userPhone, &user.CreatedAt,
		// Partner
		&partner.ID, &partner.Name, &partnerAddress, &partnerINN, &partnerStatus, &partner.AssignedManagerID, &partner.CreatedAt, &partner.UpdatedAt,
		// EndClient
		&endClient.ID, &endClient.Name, &endClientCity, &endClientInn, &endClientFullAddress, &endClientContactPersonDetails, &endClient.CreatedAt, &endClient.UpdatedAt,
		// Distributor
		&distributor.ID, &distributor.Name, &distributor.Address, &distributor.INN, &distributor.PartnerStatus, &distributor.AssignedManagerID, &distributor.CreatedAt, &distributor.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound // Используем нашу стандартную ошибку
		}
		log.Printf("Error fetching request details by ID %d: %v", requestID, err)
		return nil, fmt.Errorf("failed to fetch request details: %w", err)
	}

	// Заполняем связанные структуры
	user.Name = userName
	user.Email = userEmail
	user.Phone = userPhone
	req.User = &user

	partner.Address = partnerAddress
	if partnerINN != nil {
		partner.INN = partnerINN
	}
	partner.PartnerStatus = partnerStatus
	req.Partner = &partner

	req.EndClientDetailsOverride = endClientDetailsOverride
	req.PartnerContactOverride = partnerContactOverride
	req.FZLawType = fzLawType
	req.MPTRegistryType = mptRegistryType
	req.PartnerActivities = partnerActivities
	req.DealStateDescription = dealStateDescription
	req.ManagerComment = managerComment

	if endClientID.Valid {
		req.EndClientID = pint(int(endClientID.Int64))
		endClient.City = endClientCity
		if endClientInn != nil {
			endClient.INN = endClientInn
		}
		endClient.FullAddress = endClientFullAddress
		endClient.ContactPersonDetails = endClientContactPersonDetails
		req.EndClient = &endClient
	}

	if distributorID.Valid {
		req.DistributorID = pint(int(distributorID.Int64))
		req.Distributor = &distributor
	}

	if estimatedCloseDate.Valid {
		req.EstimatedCloseDate = &estimatedCloseDate.Time
	}

	// 2. Получаем элементы спецификации для этой заявки
	itemQuery := `
		SELECT 
			ri.id, ri.request_id, ri.product_id, ri.custom_item_sku, ri.custom_item_name,
			ri.custom_item_description, ri.quantity, ri.unit_price, ri.total_price,
			-- Данные продукта (если есть ID)
			p.id, p.sku, p.name, p.description, p.item_type, p.unit_price, p.created_at, p.updated_at
		FROM request_items ri
		LEFT JOIN products p ON ri.product_id = p.id
		WHERE ri.request_id = $1
		ORDER BY ri.id ASC
	`
	rows, err := repo.pool.Query(ctx, itemQuery, requestID)
	if err != nil {
		// Логируем ошибку, но можем вернуть основную часть заявки, если она была получена
		log.Printf("Error fetching request items for request ID %d: %v", requestID, err)
		// Не возвращаем ошибку здесь, чтобы не терять уже полученные данные
	} else {
		defer rows.Close()
		items := []models.RequestItem{}
		for rows.Next() {
			var item models.RequestItem
			var product models.Product
			var productID sql.NullInt64

			err := rows.Scan(
				&item.ID, &item.RequestID, &productID, &item.CustomItemSKU, &item.CustomItemName,
				&item.CustomItemDescription, &item.Quantity, &item.UnitPrice, &item.TotalPrice,
				// Product
				&product.ID, &product.SKU, &product.Name, &product.Description, &product.ItemType, &product.UnitPrice, &product.CreatedAt, &product.UpdatedAt,
			)
			if err != nil {
				log.Printf("Error scanning request item row for request ID %d: %v", requestID, err)
				// Пропускаем эту строку, но продолжаем с остальными
				continue
			}
			if productID.Valid {
				item.ProductID = pint(int(productID.Int64))
				item.Product = &product
			}
			items = append(items, item)
		}
		if err = rows.Err(); err != nil {
			log.Printf("Error after iterating request items for request ID %d: %v", requestID, err)
		}
		req.Items = items
	}

	return &req, nil
}

// ListRequestsByUser возвращает список заявок (без деталей спецификации) для конкретного пользователя-партнера.
// Добавляет пагинацию.
func (repo *RequestRepository) ListRequestsByUser(ctx context.Context, userID, limit, offset int) ([]models.Request, int64, error) {
	var total int64
	var requests []models.Request

	// Используем транзакцию для согласованности COUNT и SELECT
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Откат по умолчанию, Commit будет вызван вручную

	// 1. Считаем общее количество заявок пользователя
	countQuery := `SELECT COUNT(*) FROM requests WHERE partner_user_id = $1`
	err = tx.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		log.Printf("Error counting requests for user ID %d: %v", userID, err)
		return nil, 0, fmt.Errorf("failed to count user requests: %w", err)
	}

	if total == 0 {
		_ = tx.Commit(ctx) // Коммитим, т.к. чтение прошло успешно
		return []models.Request{}, 0, nil
	}

	// 2. Получаем срез заявок с пагинацией
	// Для простоты, здесь мы выбираем только основные поля для отображения в списке
	selectQuery := `
		SELECT r.id, r.status, r.created_at, 
		       COALESCE(ec.name, r.end_client_details_override) AS client_identifier
		FROM requests r
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
		WHERE r.partner_user_id = $1 AND ($2 = '' OR r.status = $2)
		ORDER BY r.created_at DESC
		LIMIT $3 OFFSET $4
	`
	rows, err := tx.Query(ctx, selectQuery, userID, "", limit, offset)
	if err != nil {
		log.Printf("Error fetching requests for user ID %d: %v", userID, err)
		return nil, 0, fmt.Errorf("failed to fetch user requests slice: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var req models.Request
		var clientIdentifier sql.NullString
		err := rows.Scan(&req.ID, &req.Status, &req.CreatedAt, &clientIdentifier)
		if err != nil {
			log.Printf("Error scanning partner request row: %v", err)
			continue
		}
		// Заполняем временное поле для отображения, если оно вам нужно.
		// Важно: в самой модели `Request` нет поля `ClientIdentifier`.
		// Если оно нужно, его надо добавить в модель.
		// А пока что, мы просто игнорируем это значение, так как его некуда положить.
		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Rows error after scanning requests for user ID %d: %v", userID, err)
		return nil, 0, fmt.Errorf("rows error after scanning user requests: %w", err)
	}

	// Коммитим транзакцию
	if err = tx.Commit(ctx); err != nil {
		log.Printf("Error committing transaction for listing user requests %d: %v", userID, err)
		return nil, 0, fmt.Errorf("failed to commit list user requests transaction: %w", err)
	}

	if requests == nil {
		requests = []models.Request{} // Гарантируем пустой срез, а не nil
	}

	return requests, total, nil
}

// ListRequestsByManager возвращает список заявок для партнеров, назначенных указанному менеджеру.
// Добавляет пагинацию и фильтрацию/сортировку.
func (repo *RequestRepository) ListRequestsByManager(
	ctx context.Context,
	managerID int,
	limit, offset int,
	// Параметры для фильтрации и сортировки
	statusFilter string, // Фильтр по статусу заявки
	partnerNameFilter string, // Фильтр по имени партнера
	clientFilter string, // Фильтр по имени/ИНН конечного клиента
	sortBy string, // Поле для сортировки (например, 'created_at', 'status', 'partner_name')
	sortOrder string, // 'ASC' или 'DESC'
) ([]models.Request, int64, error) {
	var total int64
	var requests []models.Request

	// Базовые части запроса
	selectClause := `
		SELECT 
			r.id, r.status, r.created_at, r.estimated_close_date,
			p.id AS partner_id, p.name AS partner_name, 
			COALESCE(ec.name, r.end_client_details_override) AS client_identifier,
			ec.inn AS client_inn 
	`
	fromClause := `
		FROM requests r
		JOIN partners p ON r.partner_id = p.id
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
	`
	// WHERE для менеджера
	managerWhereClause := ` WHERE p.assigned_manager_id = $1 `
	args := []interface{}{managerID}
	argCounter := 2 // Начинаем со $2 для доп. фильтров

	// Добавляем фильтры
	filterClauses := []string{}
	if statusFilter != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("r.status = $%d", argCounter))
		args = append(args, statusFilter)
		argCounter++
	}
	if partnerNameFilter != "" {
		filterClauses = append(filterClauses, fmt.Sprintf("p.name ILIKE $%d", argCounter))
		args = append(args, "%"+partnerNameFilter+"%")
		argCounter++
	}
	if clientFilter != "" {
		// Ищем по имени клиента ИЛИ по ИНН клиента
		filterClauses = append(filterClauses, fmt.Sprintf("(COALESCE(ec.name, r.end_client_details_override) ILIKE $%d OR ec.inn ILIKE $%d)", argCounter, argCounter))
		args = append(args, "%"+clientFilter+"%", "%"+clientFilter+"%")
		argCounter++
	}

	filterWhereClause := ""
	if len(filterClauses) > 0 {
		filterWhereClause = " AND " + strings.Join(filterClauses, " AND ")
	}

	// Собираем WHERE для COUNT
	countWhereClause := managerWhereClause + filterWhereClause

	// Собираем ORDER BY
	orderByClause := " ORDER BY r.created_at DESC" // Сортировка по умолчанию
	validSortFields := map[string]string{          // Маппинг псевдонимов к реальным полям
		"created_at":           "r.created_at",
		"status":               "r.status",
		"partner_name":         "p.name",
		"client":               "client_identifier", // Сортировка по вычисляемому полю
		"estimated_close_date": "r.estimated_close_date",
	}
	if sortFieldExpr, ok := validSortFields[sortBy]; ok {
		sortOrderSanitized := "ASC"
		if strings.ToUpper(sortOrder) == "DESC" {
			sortOrderSanitized = "DESC"
		}
		orderByClause = fmt.Sprintf(" ORDER BY %s %s NULLS LAST", sortFieldExpr, sortOrderSanitized) // NULLS LAST для дат
	}

	// Пагинация
	paginationClause := fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCounter, argCounter+1)

	// Используем транзакцию
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Считаем общее количество с учетом фильтров
	countQuery := "SELECT COUNT(*) " + fromClause + countWhereClause
	err = tx.QueryRow(ctx, countQuery, args[:argCounter-1]...).Scan(&total) // Передаем только аргументы для WHERE
	if err != nil {
		log.Printf("Error counting manager requests for manager ID %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("failed to count manager requests: %w", err)
	}

	if total == 0 {
		_ = tx.Commit(ctx)
		return []models.Request{}, 0, nil
	}

	// 2. Получаем срез заявок
	// Добавляем аргументы для LIMIT и OFFSET
	args = append(args, limit, offset)
	selectQuery := selectClause + fromClause + countWhereClause + orderByClause + paginationClause

	rows, err := tx.Query(ctx, selectQuery, args...)
	if err != nil {
		log.Printf("Error fetching manager requests for manager ID %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("failed to fetch manager requests slice: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var req models.Request
		var clientIdentifier, clientInn sql.NullString // Используем NullString для COALESCE и INN
		var estimatedCloseDate sql.NullTime

		// Создаем временные структуры
		req.Partner = &models.Partner{}
		req.EndClient = &models.EndClient{}

		err = rows.Scan(
			&req.ID, &req.Status, &req.CreatedAt, &estimatedCloseDate,
			&req.Partner.ID, &req.Partner.Name,
			&clientIdentifier, &clientInn,
		)
		if err != nil {
			log.Printf("Error scanning manager request row for manager ID %d: %v", managerID, err)
			continue
		}

		// Заполняем поля для отображения
		if clientIdentifier.Valid {
			// Используем EndClientDetailsOverride как временное хранилище
			req.EndClientDetailsOverride = &clientIdentifier.String
		}
		if clientInn.Valid {
			req.EndClient.INN = &clientInn.String // Сохраняем ИНН, если он есть
		}
		if estimatedCloseDate.Valid {
			req.EstimatedCloseDate = &estimatedCloseDate.Time
		}

		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Rows error after scanning manager requests for manager ID %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("rows error after scanning manager requests: %w", err)
	}

	// Коммитим
	if err = tx.Commit(ctx); err != nil {
		log.Printf("Error committing transaction for listing manager requests %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("failed to commit list manager requests transaction: %w", err)
	}

	if requests == nil {
		requests = []models.Request{}
	}

	return requests, total, nil
}

// UpdateRequestStatus обновляет статус заявки и комментарий менеджера.
func (repo *RequestRepository) UpdateRequestStatus(ctx context.Context, requestID int, newStatus string, managerComment *string) error {
	query := `
		UPDATE requests
		SET status = $1, manager_comment = $2, updated_at = NOW()
		WHERE id = $3
	`
	cmdTag, err := repo.pool.Exec(ctx, query, newStatus, managerComment, requestID)
	if err != nil {
		log.Printf("Error updating request status for ID %d: %v", requestID, err)
		return fmt.Errorf("failed to update request status: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CheckManagerAccess проверяет, имеет ли менеджер доступ к заявке.
// Доступ есть, если он назначен на партнера этой заявки.
func (repo *RequestRepository) CheckManagerAccess(ctx context.Context, managerID int, requestID int) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM requests r
			JOIN partners p ON r.partner_id = p.id
			WHERE r.id = $1 AND p.assigned_manager_id = $2
		)
	`
	var hasAccess bool
	err := repo.pool.QueryRow(ctx, query, requestID, managerID).Scan(&hasAccess)
	if err != nil {
		log.Printf("Error checking manager access for manager %d, request %d: %v", managerID, requestID, err)
		return false, fmt.Errorf("failed to check manager access: %w", err)
	}
	return hasAccess, nil
}

// DeleteRequest удаляет заявку и связанные с ней элементы спецификации (из-за ON DELETE CASCADE).
// Права доступа должны проверяться в обработчике.
func (repo *RequestRepository) DeleteRequest(ctx context.Context, requestID int) error {
	query := "DELETE FROM requests WHERE id = $1"
	cmdTag, err := repo.pool.Exec(ctx, query, requestID)
	if err != nil {
		log.Printf("Error deleting request with ID %d: %v", requestID, err)
		return fmt.Errorf("failed to delete request: %w", err)
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- Вспомогательная функция ---

// pint возвращает указатель на int. Полезно для опциональных полей ID.
func pint(i int) *int {
	return &i
}
