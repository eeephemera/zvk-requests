module github.com/eeephemera/zvk-requests/server

go 1.24.0

toolchain go1.24.2

require (
	github.com/jackc/pgx/v5 v5.7.6
	github.com/shopspring/decimal v1.4.0
)

require (
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/stretchr/testify v1.9.0 // indirect
	golang.org/x/sync v0.17.0 // indirect
)

require (
	github.com/golang-jwt/jwt/v5 v5.3.0
	github.com/gorilla/mux v1.8.1
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/joho/godotenv v1.5.1
	golang.org/x/crypto v0.43.0
	golang.org/x/text v0.30.0 // indirect
)

replace github.com/eeephemera/zvk-requests/server => ./
