package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// RequestRepository предоставляет методы для работы с таблицей requests.
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

// CreateFile вставляет новый файл в базу данных и возвращает его ID.
func (repo *RequestRepository) CreateFile(ctx context.Context, file *models.File) (int, error) {
	query := `
		INSERT INTO files (file_name, mime_type, file_size, file_data)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	var fileID int
	err := repo.pool.QueryRow(ctx, query, file.FileName, file.MimeType, file.FileSize, file.FileData).Scan(&fileID)
	if err != nil {
		return 0, fmt.Errorf("failed to insert file: %w", err)
	}
	return fileID, nil
}

// CreateRequest вставляет новую заявку в базу данных и связывает с ней файлы.
// Использует транзакцию для обеспечения целостности данных.
func (repo *RequestRepository) CreateRequest(ctx context.Context, req *models.Request, fileIDs []int) error {
	tx, err := repo.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// defer tx.Rollback(ctx) гарантирует откат, если что-то пойдет не так.
	// Если Commit выполнится успешно, Rollback не сделает ничего.
	defer tx.Rollback(ctx)

	// Шаг 1: Вставляем основную запись заявки
	requestQuery := `
		INSERT INTO requests (
			partner_user_id, partner_id, end_client_id, end_client_details_override,
			distributor_id, partner_contact_override, fz_law_type, mpt_registry_type,
			partner_activities, deal_state_description, estimated_close_date,
			status, manager_comment,
			project_name, quantity, unit_price, total_price
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(ctx, requestQuery,
		req.PartnerUserID, req.PartnerID, req.EndClientID, req.EndClientDetailsOverride,
		req.DistributorID, req.PartnerContactOverride, req.FZLawType, req.MPTRegistryType,
		req.PartnerActivities, req.DealStateDescription, req.EstimatedCloseDate,
		req.Status, req.ManagerComment,
		req.ProjectName, req.Quantity, req.UnitPrice, req.TotalPrice,
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert request within transaction: %w", err)
	}

	// Шаг 2: Связываем файлы с созданной заявкой
	if len(fileIDs) > 0 {
		// Готовим批量插入 (batch insert)
		rows := make([][]interface{}, len(fileIDs))
		for i, fileID := range fileIDs {
			rows[i] = []interface{}{req.ID, fileID}
		}

		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"request_files"},
			[]string{"request_id", "file_id"},
			pgx.CopyFromRows(rows),
		)

		if err != nil {
			return fmt.Errorf("failed to link files to request within transaction: %w", err)
		}
	}

	// Шаг 3: Коммитим транзакцию
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetRequestDetailsByID возвращает полную информацию о заявке по ID.
func (repo *RequestRepository) GetRequestDetailsByID(ctx context.Context, requestID int) (*models.Request, error) {
	query := `
		SELECT 
			r.id, r.partner_user_id, r.partner_id, r.end_client_id, r.end_client_details_override,
			r.distributor_id, r.partner_contact_override, r.fz_law_type, r.mpt_registry_type,
			r.partner_activities, r.deal_state_description, r.estimated_close_date,
			r.status, r.manager_comment, r.created_at, r.updated_at,
			r.project_name, r.quantity, r.unit_price, r.total_price,
			-- Данные пользователя
			u.id as user_id, u.login, u.role, u.partner_id as user_partner_id, u.name as user_name, u.email as user_email, u.phone as user_phone, u.created_at as user_created_at,
			-- Данные партнера
			p.id as partner_id_p, p.name as partner_name, p.address as partner_address, p.inn as partner_inn, p.partner_status, p.assigned_manager_id as partner_manager_id, p.created_at as partner_created_at, p.updated_at as partner_updated_at
		FROM requests r
		JOIN users u ON r.partner_user_id = u.id
		JOIN partners p ON r.partner_id = p.id
		WHERE r.id = $1
	`
	var req models.Request
	var user models.User
	var partner models.Partner

	// Nullable поля из основной таблицы requests
	var endClientID, distributorID sql.NullInt64
	var estimatedCloseDate sql.NullTime
	var endClientDetailsOverride, partnerContactOverride, fzLawType, mptRegistryType, partnerActivities, dealStateDescription, managerComment, projectName *string
	var quantity sql.NullInt32
	var unitPrice, totalPrice decimal.NullDecimal

	// Nullable поля для пользователя (u.*)
	var userName, userEmail, userPhone sql.NullString
	// Nullable поля для партнера (p.*)
	var partnerAddress, partnerINN, partnerStatus sql.NullString
	var partnerManagerID sql.NullInt64

	err := repo.pool.QueryRow(ctx, query, requestID).Scan(
		&req.ID, &req.PartnerUserID, &req.PartnerID, &endClientID, &endClientDetailsOverride,
		&distributorID, &partnerContactOverride, &fzLawType, &mptRegistryType,
		&partnerActivities, &dealStateDescription, &estimatedCloseDate,
		&req.Status, &managerComment, &req.CreatedAt, &req.UpdatedAt,
		&projectName, &quantity, &unitPrice, &totalPrice,
		// User
		&user.ID, &user.Login, &user.Role, &user.PartnerID, &userName, &userEmail, &userPhone, &user.CreatedAt,
		// Partner
		&partner.ID, &partner.Name, &partnerAddress, &partnerINN, &partnerStatus, &partnerManagerID, &partner.CreatedAt, &partner.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound // Используем нашу стандартную ошибку
		}
		log.Printf("Error fetching request details by ID %d: %v", requestID, err)
		return nil, fmt.Errorf("failed to fetch request details: %w", err)
	}

	// После успешного получения основной информации о заявке, загружаем связанные файлы
	files, err := repo.getFilesForRequest(ctx, requestID)
	if err != nil {
		// Не возвращаем ошибку, а логируем ее, чтобы не ломать основной запрос, если файлы не загрузились
		log.Printf("Warning: failed to fetch files for request %d: %v", requestID, err)
	}
	req.Files = files

	// Заполняем поля самой заявки
	req.ProjectName = projectName
	if quantity.Valid {
		req.Quantity = pint(int(quantity.Int32))
	}
	if unitPrice.Valid {
		req.UnitPrice = &unitPrice.Decimal
	}
	if totalPrice.Valid {
		req.TotalPrice = &totalPrice.Decimal
	}

	// Заполняем связанные структуры
	user.Name = pstr(userName.String)
	user.Email = pstr(userEmail.String)
	user.Phone = pstr(userPhone.String)
	req.User = &user

	partner.Address = pstr(partnerAddress.String)
	partner.INN = pstr(partnerINN.String)
	partner.PartnerStatus = pstr(partnerStatus.String)
	if partnerManagerID.Valid {
		partner.AssignedManagerID = pint(int(partnerManagerID.Int64))
	}
	req.Partner = &partner

	if endClientID.Valid {
		req.EndClientID = pint(int(endClientID.Int64))
		var endClient models.EndClient
		ecQuery := `SELECT id, name, city, inn, full_address, contact_person_details, created_at, updated_at FROM end_clients WHERE id = $1`
		var ecCity, ecInn, ecFullAddress, ecContactPersonDetails sql.NullString
		err := repo.pool.QueryRow(ctx, ecQuery, endClientID.Int64).Scan(
			&endClient.ID, &endClient.Name, &ecCity, &ecInn, &ecFullAddress, &ecContactPersonDetails, &endClient.CreatedAt, &endClient.UpdatedAt,
		)
		if err != nil && err != pgx.ErrNoRows {
			log.Printf("Error fetching end client %d for request %d: %v", endClientID.Int64, requestID, err)
		} else if err == nil {
			endClient.City = pstr(ecCity.String)
			endClient.INN = pstr(ecInn.String)
			endClient.FullAddress = pstr(ecFullAddress.String)
			endClient.ContactPersonDetails = pstr(ecContactPersonDetails.String)
			req.EndClient = &endClient
		}
	}

	if distributorID.Valid {
		req.DistributorID = pint(int(distributorID.Int64))
		var distributor models.Partner
		dQuery := `SELECT id, name, address, inn, partner_status, assigned_manager_id, created_at, updated_at FROM partners WHERE id = $1`
		var dAddress, dInn, dStatus sql.NullString
		var dManagerID sql.NullInt64
		err := repo.pool.QueryRow(ctx, dQuery, distributorID.Int64).Scan(
			&distributor.ID, &distributor.Name, &dAddress, &dInn, &dStatus, &dManagerID, &distributor.CreatedAt, &distributor.UpdatedAt,
		)
		if err != nil && err != pgx.ErrNoRows {
			log.Printf("Error fetching distributor %d for request %d: %v", distributorID.Int64, requestID, err)
		} else if err == nil {
			distributor.Address = pstr(dAddress.String)
			distributor.INN = pstr(dInn.String)
			distributor.PartnerStatus = pstr(dStatus.String)
			if dManagerID.Valid {
				distributor.AssignedManagerID = pint(int(dManagerID.Int64))
			}
			req.Distributor = &distributor
		}
	}

	if estimatedCloseDate.Valid {
		req.EstimatedCloseDate = &estimatedCloseDate.Time
	}

	return &req, nil
}

// getFilesForRequest - вспомогательный метод для получения всех файлов, связанных с заявкой
func (repo *RequestRepository) getFilesForRequest(ctx context.Context, requestID int) ([]*models.File, error) {
	query := `
		SELECT f.id, f.file_name, f.mime_type, f.file_size, f.created_at
		FROM files f
		JOIN request_files rf ON f.id = rf.file_id
		WHERE rf.request_id = $1
		ORDER BY f.created_at DESC
	`
	rows, err := repo.pool.Query(ctx, query, requestID)
	if err != nil {
		return nil, fmt.Errorf("failed to query files for request: %w", err)
	}
	defer rows.Close()

	var files []*models.File
	for rows.Next() {
		var file models.File
		if err := rows.Scan(&file.ID, &file.FileName, &file.MimeType, &file.FileSize, &file.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan file row: %w", err)
		}
		files = append(files, &file)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error after iterating through file rows: %w", err)
	}

	return files, nil
}

// GetFileByID возвращает метаданные файла (без содержимого) по его ID.
func (repo *RequestRepository) GetFileByID(ctx context.Context, fileID int) (*models.File, error) {
	query := `SELECT id, file_name, mime_type, file_size, created_at FROM files WHERE id = $1`
	var file models.File
	err := repo.pool.QueryRow(ctx, query, fileID).Scan(&file.ID, &file.FileName, &file.MimeType, &file.FileSize, &file.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get file by id: %w", err)
	}
	return &file, nil
}

// GetFileDataByID возвращает только бинарные данные файла по его ID.
func (repo *RequestRepository) GetFileDataByID(ctx context.Context, fileID int) ([]byte, error) {
	query := `SELECT file_data FROM files WHERE id = $1`
	var data []byte
	err := repo.pool.QueryRow(ctx, query, fileID).Scan(&data)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get file data by id: %w", err)
	}
	return data, nil
}

// UpdateRequest - пример. НЕ ИСПОЛЬЗУЕТСЯ.
// Здесь может быть логика для общего обновления полей заявки.
func (repo *RequestRepository) UpdateRequest(ctx context.Context, req *models.Request) error {
	// ...
	return nil
}

// ListRequestsByUser возвращает список заявок для конкретного пользователя с пагинацией.
func (r *RequestRepository) ListRequestsByUser(ctx context.Context, userID int, limit, offset int) ([]models.Request, int64, error) {
	// Сначала считаем общее количество заявок для пользователя
	countQuery := "SELECT COUNT(*) FROM requests WHERE partner_user_id = $1"
	var total int64
	err := r.pool.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		log.Printf("Error counting requests for user %d: %v", userID, err)
		return nil, 0, fmt.Errorf("failed to count requests for user: %w", err)
	}

	// Если заявок нет, возвращаем пустой срез
	if total == 0 {
		return []models.Request{}, 0, nil
	}

	// Теперь получаем сами заявки с JOIN'ами для отображения в списке
	query := `
		SELECT
			r.id,
			r.status,
			r.created_at,
			r.project_name,
			p.id as partner_id,
			p.name as partner_name,
			ec.id as client_id,
			ec.name as client_name,
			r.end_client_details_override
		FROM requests r
		LEFT JOIN partners p ON r.partner_id = p.id
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
		WHERE r.partner_user_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		log.Printf("Error listing requests for user %d: %v", userID, err)
		return nil, 0, fmt.Errorf("failed to list requests for user: %w", err)
	}
	defer rows.Close()

	requests := make([]models.Request, 0, limit)
	for rows.Next() {
		var req models.Request
		var partner models.Partner
		var client models.EndClient
		var clientID sql.NullInt64
		var clientName, endClientDetailsOverride sql.NullString

		err := rows.Scan(
			&req.ID,
			&req.Status,
			&req.CreatedAt,
			&req.ProjectName,
			&partner.ID,
			&partner.Name,
			&clientID,
			&clientName,
			&endClientDetailsOverride,
		)
		if err != nil {
			// Логируем ошибку, но не прерываем весь процесс
			log.Printf("Error scanning request row for user %d: %v", userID, err)
			continue
		}

		req.Partner = &partner
		if clientID.Valid {
			client.ID = int(clientID.Int64)
			// Если имя не NULL, присваиваем его
			if clientName.Valid {
				client.Name = clientName.String
			}
			req.EndClient = &client
		}

		// Устанавливаем оверрайд, если он есть
		if endClientDetailsOverride.Valid {
			req.EndClientDetailsOverride = &endClientDetailsOverride.String
		}

		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error after iterating rows for user %d: %v", userID, err)
		return nil, 0, fmt.Errorf("error after iterating rows: %w", err)
	}

	return requests, total, nil
}

// UpdateRequestStatus обновляет статус заявки и добавляет комментарий менеджера.
func (repo *RequestRepository) UpdateRequestStatus(ctx context.Context, requestID int, newStatus models.RequestStatus, managerComment *string) error {
	query := `
		UPDATE requests
		SET
			status = $1,
			manager_comment = $2,
			updated_at = NOW()
		WHERE id = $3
	`
	tag, err := repo.pool.Exec(ctx, query, newStatus, managerComment, requestID)
	if err != nil {
		log.Printf("Error updating status for request %d: %v", requestID, err)
		return fmt.Errorf("failed to update request status: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return ErrNotFound // Заявка с таким ID не найдена
	}

	return nil
}

// CheckUserAccessToFile проверяет, имеет ли пользователь (любой, включая менеджера) доступ к файлу.
// Доступ есть, если пользователь создал заявку, к которой привязан файл.
// Менеджеры имеют доступ ко всем файлам (пока что).
// TODO: Сделать для менеджера проверку, что он ведет партнера, создавшего заявку.
func (repo *RequestRepository) CheckUserAccessToFile(ctx context.Context, userID int, fileID int) (bool, error) {
	// Сначала проверим роль пользователя
	var userRole models.UserRole
	err := repo.pool.QueryRow(ctx, "SELECT role FROM users WHERE id = $1", userID).Scan(&userRole)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, ErrNotFound
		}
		log.Printf("Error fetching user role for access check, userID %d: %v", userID, err)
		return false, fmt.Errorf("could not verify user role")
	}

	// Менеджеры имеют доступ ко всему
	if userRole == models.RoleManager {
		return true, nil
	}

	// Для обычных пользователей проверяем, что они создали заявку, к которой прикреплен файл
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM request_files rf
			JOIN requests r ON rf.request_id = r.id
			WHERE rf.file_id = $1 AND r.partner_user_id = $2
		)
	`
	var hasAccess bool
	err = repo.pool.QueryRow(ctx, query, fileID, userID).Scan(&hasAccess)
	if err != nil {
		log.Printf("Error checking file access for user %d and file %d: %v", userID, fileID, err)
		return false, fmt.Errorf("failed to check file access")
	}

	return hasAccess, nil
}

// DeleteRequest удаляет заявку по ID.
// Благодаря ON DELETE CASCADE в БД, связанные записи в request_files также удалятся.
func (repo *RequestRepository) DeleteRequest(ctx context.Context, requestID int) error {
	query := "DELETE FROM requests WHERE id = $1"
	tag, err := repo.pool.Exec(ctx, query, requestID)
	if err != nil {
		log.Printf("Error deleting request %d: %v", requestID, err)
		return fmt.Errorf("failed to delete request: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Вспомогательные функции для преобразования в указатели
// Это нужно, чтобы легко вставлять значения в поля типа *string, *int и т.д.
func pint(i int) *int {
	return &i
}
func pstr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
func pdecimal(d decimal.Decimal) *decimal.Decimal {
	return &d
}

// ListAllRequests возвращает список всех заявок с пагинацией, фильтрацией и сортировкой.
// Предназначен для роли Менеджера.
func (repo *RequestRepository) ListAllRequests(
	ctx context.Context,
	limit, offset int,
	statusFilter models.RequestStatus,
	partnerNameFilter string,
	clientFilter string,
	sortBy string,
	sortOrder string,
) ([]models.Request, int64, error) {
	// Базовый запрос с JOIN'ами для получения всей необходимой информации
	baseQuery := `
		FROM requests r
		LEFT JOIN users u ON r.partner_user_id = u.id
		LEFT JOIN partners p ON r.partner_id = p.id
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
	`
	// Конструктор для WHERE
	whereClauses := []string{}
	args := []interface{}{}
	argID := 1

	// Фильтр по статусу
	if statusFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.status = $%d", argID))
		args = append(args, statusFilter)
		argID++
	}
	// Фильтр по названию партнера
	if partnerNameFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("p.name ILIKE $%d", argID))
		args = append(args, "%"+partnerNameFilter+"%")
		argID++
	}
	// Фильтр по названию конечного клиента
	if clientFilter != "" {
		// Ищем как в названии клиента, так и в поле оверрайда
		whereClauses = append(whereClauses, fmt.Sprintf("(ec.name ILIKE $%d OR r.end_client_details_override ILIKE $%d)", argID, argID))
		args = append(args, "%"+clientFilter+"%")
		argID++
	}

	whereQuery := ""
	if len(whereClauses) > 0 {
		whereQuery = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Запрос для получения общего количества записей с учетом фильтров
	countQuery := "SELECT COUNT(*) " + baseQuery + whereQuery
	var total int64
	err := repo.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		log.Printf("Error counting all requests: %v", err)
		return nil, 0, fmt.Errorf("failed to count all requests: %w", err)
	}
	if total == 0 {
		return []models.Request{}, 0, nil
	}

	// Запрос для получения самих данных
	dataQuery := `
		SELECT
			r.id, r.created_at, r.status, r.project_name,
			p.id as partner_id, p.name as partner_name,
			u.id as user_id, u.name as user_name,
			ec.id as client_id, ec.name as client_name,
			r.end_client_details_override
	` + baseQuery + whereQuery

	// Сортировка
	if sortBy != "" {
		// "Белый список" полей для сортировки для безопасности
		allowedSortBy := map[string]string{
			"created_at": "r.created_at",
			"status":     "r.status",
			"partner":    "p.name",
			"client":     "ec.name",
			"project":    "r.project_name",
		}
		if dbSortBy, ok := allowedSortBy[sortBy]; ok {
			// Проверка направления сортировки
			if strings.ToUpper(sortOrder) != "DESC" {
				sortOrder = "ASC"
			}
			dataQuery += fmt.Sprintf(" ORDER BY %s %s", dbSortBy, sortOrder)
		}
	} else {
		// Сортировка по умолчанию
		dataQuery += " ORDER BY r.created_at DESC"
	}

	// Пагинация
	dataQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, limit, offset)

	rows, err := repo.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		log.Printf("Error listing all requests: %v. Query: %s", err, dataQuery)
		return nil, 0, fmt.Errorf("failed to list all requests: %w", err)
	}
	defer rows.Close()

	requests := make([]models.Request, 0, limit)
	for rows.Next() {
		var req models.Request
		var partner models.Partner
		var user models.User
		var client models.EndClient
		var clientName, endClientDetailsOverride sql.NullString
		var clientID sql.NullInt64

		err := rows.Scan(
			&req.ID, &req.CreatedAt, &req.Status, &req.ProjectName,
			&partner.ID, &partner.Name,
			&user.ID, &user.Name,
			&clientID, &clientName,
			&endClientDetailsOverride,
		)
		if err != nil {
			log.Printf("Error scanning request row: %v", err)
			continue
		}

		req.Partner = &partner
		req.User = &user

		if clientID.Valid {
			client.ID = int(clientID.Int64)
			if clientName.Valid {
				client.Name = clientName.String
			}
			req.EndClient = &client
		}
		if endClientDetailsOverride.Valid {
			req.EndClientDetailsOverride = &endClientDetailsOverride.String
		}

		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating over request rows: %v", err)
		return nil, 0, fmt.Errorf("failed to process request rows: %w", err)
	}

	return requests, total, nil
}

// CheckManagerAccess проверяет, имеет ли менеджер доступ к заявке.
// Доступ есть, если менеджер назначен ответственному за партнера, который создал заявку.
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

// ListRequestsForManager возвращает список заявок для партнеров, назначенных указанному менеджеру.
// Заменяет ListAllRequests.
func (repo *RequestRepository) ListRequestsForManager(
	ctx context.Context,
	managerID int,
	limit, offset int,
	statusFilter models.RequestStatus,
	partnerNameFilter string,
	clientFilter string,
	sortBy string,
	sortOrder string,
) ([]models.Request, int64, error) {
	baseQuery := `
		FROM requests r
		LEFT JOIN users u ON r.partner_user_id = u.id
		JOIN partners p ON r.partner_id = p.id
		LEFT JOIN end_clients ec ON r.end_client_id = ec.id
	`
	// Основное условие - фильтрация по ответственному менеджеру
	whereClauses := []string{"p.assigned_manager_id = $1"}
	args := []interface{}{managerID}
	argID := 2 // Начинаем нумерацию аргументов со 2

	// Дополнительные фильтры
	if statusFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.status = $%d", argID))
		args = append(args, statusFilter)
		argID++
	}
	// Фильтр по названию партнера
	if partnerNameFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("p.name ILIKE $%d", argID))
		args = append(args, "%"+partnerNameFilter+"%")
		argID++
	}
	// Фильтр по названию конечного клиента
	if clientFilter != "" {
		// Ищем как в названии клиента, так и в поле оверрайда
		whereClauses = append(whereClauses, fmt.Sprintf("(ec.name ILIKE $%d OR r.end_client_details_override ILIKE $%d)", argID, argID))
		args = append(args, "%"+clientFilter+"%")
		argID++
	}

	whereQuery := "WHERE " + strings.Join(whereClauses, " AND ")

	countQuery := "SELECT COUNT(*) " + baseQuery + whereQuery
	var total int64
	err := repo.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		log.Printf("Error counting requests for manager %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("failed to count requests for manager: %w", err)
	}
	if total == 0 {
		return []models.Request{}, 0, nil
	}

	dataQuery := `
		SELECT
			r.id, r.created_at, r.status, r.project_name,
			p.id as partner_id, p.name as partner_name,
			u.id as user_id, u.name as user_name,
			ec.id as client_id, ec.name as client_name,
			r.end_client_details_override
	` + baseQuery + whereQuery

	if sortBy != "" {
		allowedSortBy := map[string]string{
			"created_at": "r.created_at",
			"status":     "r.status",
			"partner":    "p.name",
			"client":     "ec.name",
			"project":    "r.project_name",
		}
		if dbSortBy, ok := allowedSortBy[sortBy]; ok {
			if strings.ToUpper(sortOrder) != "DESC" {
				sortOrder = "ASC"
			}
			dataQuery += fmt.Sprintf(" ORDER BY %s %s", dbSortBy, sortOrder)
		}
	} else {
		dataQuery += " ORDER BY r.created_at DESC"
	}

	dataQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, limit, offset)

	rows, err := repo.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		log.Printf("Error listing requests for manager %d: %v. Query: %s", managerID, err, dataQuery)
		return nil, 0, fmt.Errorf("failed to list requests for manager: %w", err)
	}
	defer rows.Close()

	requests := make([]models.Request, 0, limit)
	for rows.Next() {
		var req models.Request
		var partner models.Partner
		var user models.User
		var client models.EndClient
		var clientName, endClientDetailsOverride sql.NullString
		var clientID sql.NullInt64

		err := rows.Scan(
			&req.ID, &req.CreatedAt, &req.Status, &req.ProjectName,
			&partner.ID, &partner.Name,
			&user.ID, &user.Name,
			&clientID, &clientName,
			&endClientDetailsOverride,
		)
		if err != nil {
			log.Printf("Error scanning request row for manager %d: %v", managerID, err)
			continue
		}

		req.Partner = &partner
		req.User = &user

		if clientID.Valid {
			client.ID = int(clientID.Int64)
			if clientName.Valid {
				client.Name = clientName.String
			}
			req.EndClient = &client
		}
		if endClientDetailsOverride.Valid {
			req.EndClientDetailsOverride = &endClientDetailsOverride.String
		}

		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating over request rows for manager %d: %v", managerID, err)
		return nil, 0, fmt.Errorf("failed to process request rows for manager: %w", err)
	}

	return requests, total, nil
}
