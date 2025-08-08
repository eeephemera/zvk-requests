# ZVK Requests API Documentation

## Overview

ZVK Requests is a web application for managing business requests and deal registrations. The API provides endpoints for user authentication, request management, and business operations.

**Base URL:** `https://api.zvk-requests.ru`

## Authentication

The API uses JWT (JSON Web Token) authentication with HttpOnly cookies for security.

### Authentication Flow

1. **Register** - Create a new user account
2. **Login** - Authenticate and receive JWT token
3. **Protected Routes** - Use JWT token for authenticated requests
4. **Refresh** - Renew expired tokens
5. **Logout** - Invalidate current token

## API Endpoints

### Public Endpoints

#### Health Check
```
GET /health
```
Returns server health status.

**Response:**
```json
"OK"
```

#### User Registration
```
POST /api/register
```
Register a new user account.

**Request Body:**
```json
{
  "login": "string",
  "password": "string",
  "password_confirmation": "string (required)",
  "role": "string (optional, default: 'USER')",
  "partner_id": "integer (optional)",
  "name": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "login": "username",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "+1234567890",
    "role": "USER",
    "partner_id": 1,
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

#### User Login
```
POST /api/login
```
Authenticate user and receive JWT token.

**Rate Limit:** 10 requests per minute

**Request Body:**
```json
{
  "login": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "login": "username",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "+1234567890",
    "role": "USER",
    "partner_id": 1,
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

**Note:** JWT token is automatically set as an HttpOnly cookie.

#### User Logout
```
POST /api/logout
```
Logout user and invalidate JWT token.

**Response:**
```json
{
  "message": "Logout successful"
}
```

### Protected Endpoints

All protected endpoints require a valid JWT token in the Authorization header or cookie.

**Rate Limit:** 100 requests per minute for all authenticated endpoints

#### Get Current User
```
GET /api/me
```
Get current authenticated user information.

**Response:**
```json
{
  "id": 1,
  "login": "username",
  "name": "User Name",
  "email": "user@example.com",
  "phone": "+1234567890",
  "role": "USER",
  "partner_id": 1,
  "created_at": "2025-01-20T10:00:00Z",
  "partner": {
    "id": 1,
    "name": "Partner Name",
    "inn": "1234567890"
  }
}
```

#### Refresh Token
```
POST /api/refresh
```
Refresh expired JWT token.

**Response:**
```json
{
  "message": "Token refreshed successfully"
}
```

### Reference Data Endpoints

#### List Partners
```
GET /api/partners
```
Get list of all partners.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Partner Name",
    "inn": "1234567890"
  }
]
```

#### Search End Clients by INN
```
GET /api/end-clients/search?inn={inn}
```
Search for end clients by INN (Tax ID).

**Query Parameters:**
- `inn` (required): INN number (10-12 digits)

**Response:**
```json
{
  "id": 1,
  "name": "Client Name",
  "inn": "1234567890",
  "city": "Moscow",
  "full_address": "Full Address",
  "contact_details": "Contact Info"
}
```

### Request Management Endpoints

#### User Role Endpoints (USER)

##### Create Request
```
POST /api/requests
```
Create a new deal registration request.

**Request Body:**
```json
{
  "partner_id": 1,
  "distributor_id": 2,
  "end_client_id": 3,
  "end_client_inn": "1234567890",
  "end_client_name": "Client Name",
  "end_client_city": "Moscow",
  "end_client_full_address": "Full Address",
  "end_client_contact_details": "Contact Info",
  "end_client_details_override": "Override details",
  "partner_contact_override": "Override contact",
  "fz_law_type": "Law type",
  "mpt_registry_type": "Registry type",
  "partner_activities": "Activities description",
  "deal_state_description": "Deal description",
  "estimated_close_date": "2025-12-31T23:59:59Z",
  "project_name": "Project Name",
  "quantity": 100,
  "unit_price": "1000.50"
}
```

**File Upload:**
- Use `multipart/form-data`
- Field name: `overall_tz_files[]`
- Maximum file size: 32MB
- Multiple files supported

**Response:**
```json
{
  "id": 1,
  "partner_user_id": 1,
  "partner_id": 1,
  "end_client_id": 3,
  "status": "На рассмотрении",
  "created_at": "2025-01-20T10:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z"
}
```

##### List My Requests
```
GET /api/requests/my
```
Get list of current user's requests.

**Response:**
```json
[
  {
    "id": 1,
    "partner_user_id": 1,
    "partner_id": 1,
    "end_client_id": 3,
    "status": "На рассмотрении",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z",
    "partner": {
      "id": 1,
      "name": "Partner Name"
    },
    "end_client": {
      "id": 3,
      "name": "Client Name"
    }
  }
]
```

##### Get Request Details
```
GET /api/requests/my/{id}
```
Get detailed information about a specific request.

**Path Parameters:**
- `id` (required): Request ID

**Response:**
```json
{
  "id": 1,
  "partner_user_id": 1,
  "partner_id": 1,
  "end_client_id": 3,
  "status": "На рассмотрении",
  "deal_state_description": "Deal description",
  "estimated_close_date": "2025-12-31T23:59:59Z",
  "project_name": "Project Name",
  "quantity": 100,
  "unit_price": "1000.50",
  "total_price": "100050.00",
  "created_at": "2025-01-20T10:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z",
  "partner": {
    "id": 1,
    "name": "Partner Name"
  },
  "end_client": {
    "id": 3,
    "name": "Client Name"
  },
  "files": [
    {
      "id": 1,
      "filename": "document.pdf",
      "file_path": "/uploads/document.pdf",
      "uploaded_at": "2025-01-20T10:00:00Z"
    }
  ]
}
```

##### Download File
```
GET /api/requests/files/{fileID}
```
Download a file attached to a request.

**Path Parameters:**
- `fileID` (required): File ID

**Response:** File content with appropriate headers

#### Manager Role Endpoints (MANAGER)

##### List All Requests
```
GET /api/manager/requests
```
Get list of all requests for managers.

**Response:**
```json
[
  {
    "id": 1,
    "partner_user_id": 1,
    "partner_id": 1,
    "end_client_id": 3,
    "status": "На рассмотрении",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z",
    "partner": {
      "id": 1,
      "name": "Partner Name"
    },
    "end_client": {
      "id": 3,
      "name": "Client Name"
    },
    "user": {
      "id": 1,
      "login": "username",
      "name": "User Name"
    }
  }
]
```

##### Get Request Details (Manager)
```
GET /api/manager/requests/{id}
```
Get detailed information about a specific request for managers.

**Path Parameters:**
- `id` (required): Request ID

**Response:** Same as user endpoint but includes manager-specific fields

##### Update Request Status
```
PUT /api/manager/requests/{id}/status
```
Update the status of a request.

**Path Parameters:**
- `id` (required): Request ID

**Request Body:**
```json
{
  "status": "Одобрено",
  "manager_comment": "Request approved"
}
```

**Available Statuses:**
- `На рассмотрении` - Pending
- `Одобрено` - Approved
- `Отклонено` - Rejected
- `Требует уточнения` - Requires clarification
- `В работе` - In progress
- `Выполнено` - Completed

**Response:**
```json
{
  "id": 1,
  "status": "Одобрено",
  "manager_comment": "Request approved",
  "updated_at": "2025-01-20T10:00:00Z"
}
```

##### Delete Request
```
DELETE /api/manager/requests/{id}
```
Delete a request (managers only).

**Path Parameters:**
- `id` (required): Request ID

**Response:**
```json
{
  "message": "Request deleted successfully"
}
```

## Data Models

### User
```json
{
  "id": "integer",
  "login": "string",
  "name": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "role": "USER | MANAGER",
  "partner_id": "integer (optional)",
  "created_at": "datetime"
}
```

### Request
```json
{
  "id": "integer",
  "partner_user_id": "integer",
  "partner_id": "integer",
  "end_client_id": "integer (optional)",
  "end_client_details_override": "string (optional)",
  "distributor_id": "integer (optional)",
  "partner_contact_override": "string (optional)",
  "fz_law_type": "string (optional)",
  "mpt_registry_type": "string (optional)",
  "partner_activities": "string (optional)",
  "deal_state_description": "string",
  "estimated_close_date": "datetime (optional)",
  "status": "RequestStatus",
  "manager_comment": "string (optional)",
  "project_name": "string (optional)",
  "quantity": "integer (optional)",
  "unit_price": "decimal (optional)",
  "total_price": "decimal (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Partner
```json
{
  "id": "integer",
  "name": "string",
  "inn": "string"
}
```

### EndClient
```json
{
  "id": "integer",
  "name": "string",
  "inn": "string",
  "city": "string (optional)",
  "full_address": "string (optional)",
  "contact_details": "string (optional)"
}
```

### File
```json
{
  "id": "integer",
  "filename": "string",
  "file_path": "string",
  "uploaded_at": "datetime"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages in the following format:

```json
{
  "error": "Error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (Rate Limit)
- `500` - Internal Server Error

## Rate Limiting

- **Public endpoints:** No rate limiting
- **Login endpoint:** 10 requests per minute
- **All other endpoints:** 100 requests per minute

## Security Features

- JWT authentication with HttpOnly cookies
- Password hashing
- Role-based access control
- Rate limiting
- CORS protection (handled by Nginx)
- Input validation and sanitization

## Deployment Information

- **Frontend:** Hosted on Vercel
- **Backend:** Hosted on server with IP 178.208.92.34
- **Domain:** zvk-requests.ru
- **API Subdomain:** api.zvk-requests.ru
- **Database:** PostgreSQL
- **Reverse Proxy:** Nginx with SSL termination

## Support

For API support and questions, please contact the development team. 