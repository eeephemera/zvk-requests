# ZVK Requests

Web application for managing business requests and deal registrations.

## Features

- User authentication and authorization
- Deal registration form with real-time validation
- Manager dashboard for request management
- File attachments support
- Client search by INN (Tax ID)

## Tech Stack

### Frontend (Next.js)
- TypeScript
- React Query for data fetching
- TailwindCSS for styling
- Form handling with React Hook Form

### Backend (Go)
- Go standard library for HTTP server
- PostgreSQL database
- JWT authentication

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Go 1.21+
- PostgreSQL 15+
- Docker and Docker Compose (optional)

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/eeephemera/zvk-requests.git
cd zvk-requests
```

2. Install dependencies:
```bash
# Frontend
cd client
npm install

# Backend
cd ../server
go mod download
```

3. Set up environment variables:
```bash
# client/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080

# server/.env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=zvk_requests
JWT_SECRET=your_secret_key
```

4. Run the development servers:
```bash
# Frontend (in client directory)
npm run dev

# Backend (in server directory)
go run main.go
```

5. Open http://localhost:3000 in your browser

### Docker Setup

Alternatively, use Docker Compose:

```bash
docker-compose up -d
```

## Production Deployment

The application is configured for deployment on Vercel (frontend) and any container platform (backend).

## License

This project is proprietary software. All rights reserved.