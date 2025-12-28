package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/mitsume/backend/internal/config"
	"github.com/mitsume/backend/internal/models"

	_ "github.com/trinodb/trino-go-client/trino"
)

type TrinoService struct {
	cfg *config.TrinoConfig
	dbs sync.Map
}

func NewTrinoService(cfg *config.TrinoConfig) *TrinoService {
	return &TrinoService{cfg: cfg}
}

func (s *TrinoService) getConnectionString(catalog, schema string) string {
	if catalog == "" {
		catalog = s.cfg.Catalog
	}
	if schema == "" {
		schema = s.cfg.Schema
	}
	return fmt.Sprintf("http://%s@%s:%s?catalog=%s&schema=%s",
		s.cfg.User, s.cfg.Host, s.cfg.Port, catalog, schema)
}

func (s *TrinoService) ExecuteQuery(ctx context.Context, query, catalog, schema string) (*models.QueryResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	startTime := time.Now()

	dsn := s.getConnectionString(catalog, schema)
	db, err := s.getDB(dsn)
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var result [][]interface{}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make([]interface{}, len(columns))
		for i, v := range values {
			row[i] = formatValue(v)
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	executionTime := time.Since(startTime).Milliseconds()

	return &models.QueryResult{
		Columns:         columns,
		Rows:            result,
		RowCount:        len(result),
		ExecutionTimeMs: executionTime,
	}, nil
}

func formatValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}

	switch val := v.(type) {
	case []byte:
		return string(val)
	case time.Time:
		return val.Format(time.RFC3339)
	default:
		return val
	}
}

func (s *TrinoService) GetCatalogs(ctx context.Context) ([]string, error) {
	result, err := s.ExecuteQuery(ctx, "SHOW CATALOGS", "", "")
	if err != nil {
		return nil, err
	}

	catalogs := make([]string, len(result.Rows))
	for i, row := range result.Rows {
		if len(row) > 0 {
			if catalog, ok := row[0].(string); ok {
				catalogs[i] = catalog
			}
		}
	}

	return catalogs, nil
}

func (s *TrinoService) GetSchemas(ctx context.Context, catalog string) ([]string, error) {
	if err := validateIdentifier(catalog); err != nil {
		return nil, err
	}

	query := fmt.Sprintf("SHOW SCHEMAS FROM %s", catalog)
	result, err := s.ExecuteQuery(ctx, query, catalog, "")
	if err != nil {
		return nil, err
	}

	schemas := make([]string, len(result.Rows))
	for i, row := range result.Rows {
		if len(row) > 0 {
			if schema, ok := row[0].(string); ok {
				schemas[i] = schema
			}
		}
	}

	return schemas, nil
}

func (s *TrinoService) GetTables(ctx context.Context, catalog, schema string) ([]string, error) {
	if err := validateIdentifier(catalog); err != nil {
		return nil, err
	}
	if err := validateIdentifier(schema); err != nil {
		return nil, err
	}

	query := fmt.Sprintf("SHOW TABLES FROM %s.%s", catalog, schema)
	result, err := s.ExecuteQuery(ctx, query, catalog, schema)
	if err != nil {
		return nil, err
	}

	tables := make([]string, len(result.Rows))
	for i, row := range result.Rows {
		if len(row) > 0 {
			if table, ok := row[0].(string); ok {
				tables[i] = table
			}
		}
	}

	return tables, nil
}

func (s *TrinoService) GetColumns(ctx context.Context, catalog, schema, table string) ([]models.ColumnInfo, error) {
	if err := validateIdentifier(catalog); err != nil {
		return nil, err
	}
	if err := validateIdentifier(schema); err != nil {
		return nil, err
	}
	if err := validateIdentifier(table); err != nil {
		return nil, err
	}

	// Query information_schema for column metadata
	// is_nullable returns 'YES' or 'NO' as string in Trino
	query := fmt.Sprintf(`
		SELECT
			column_name,
			data_type,
			is_nullable,
			comment,
			ordinal_position
		FROM "%s".information_schema.columns
		WHERE table_schema = '%s'
		  AND table_name = '%s'
		ORDER BY ordinal_position
	`, catalog, schema, table)

	result, err := s.ExecuteQuery(ctx, query, catalog, "information_schema")
	if err != nil {
		return nil, err
	}

	columns := make([]models.ColumnInfo, 0, len(result.Rows))
	for _, row := range result.Rows {
		if len(row) < 5 {
			continue
		}

		col := models.ColumnInfo{}

		// column_name
		if name, ok := row[0].(string); ok {
			col.Name = name
		}

		// data_type
		if dataType, ok := row[1].(string); ok {
			col.Type = dataType
		}

		// is_nullable ('YES' or 'NO')
		if isNullable, ok := row[2].(string); ok {
			col.Nullable = (isNullable == "YES")
		}

		// comment (may be nil)
		if row[3] != nil {
			if comment, ok := row[3].(string); ok {
				col.Comment = &comment
			}
		}

		// ordinal_position
		if pos, ok := row[4].(int64); ok {
			col.OrdinalPosition = int(pos)
		} else if pos, ok := row[4].(int); ok {
			col.OrdinalPosition = pos
		}

		columns = append(columns, col)
	}

	return columns, nil
}

func (s *TrinoService) SearchMetadata(ctx context.Context, query, searchType string, catalogs []string, limit int) ([]models.MetadataSearchResult, error) {
	if query == "" {
		return []models.MetadataSearchResult{}, nil
	}

	if limit <= 0 || limit > 100 {
		limit = 50 // Default limit
	}

	// Escape single quotes for SQL and create search pattern
	escapedQuery := escapeSearchQuery(query)
	searchPattern := "%" + escapedQuery + "%"

	var results []models.MetadataSearchResult

	// Search through each allowed catalog
	for _, catalog := range catalogs {
		if err := validateIdentifier(catalog); err != nil {
			continue
		}

		// Search tables
		if searchType == "table" || searchType == "all" {
			tableQuery := fmt.Sprintf(`
				SELECT
					table_catalog,
					table_schema,
					table_name
				FROM "%s".information_schema.tables
				WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'sys')
				  AND LOWER(table_name) LIKE LOWER('%s')
				ORDER BY table_name
				LIMIT %d
			`, catalog, searchPattern, limit)

			result, err := s.ExecuteQuery(ctx, tableQuery, catalog, "information_schema")
			if err != nil {
				continue // Skip catalogs with errors
			}

			for _, row := range result.Rows {
				if len(row) < 3 {
					continue
				}
				tableCatalog, _ := row[0].(string)
				tableSchema, _ := row[1].(string)
				tableName, _ := row[2].(string)

				results = append(results, models.MetadataSearchResult{
					Catalog: tableCatalog,
					Schema:  tableSchema,
					Table:   tableName,
					Type:    "table",
				})
			}
		}

		// Search columns
		if searchType == "column" || searchType == "all" {
			columnQuery := fmt.Sprintf(`
				SELECT
					table_catalog,
					table_schema,
					table_name,
					column_name
				FROM "%s".information_schema.columns
				WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'sys')
				  AND LOWER(column_name) LIKE LOWER('%s')
				ORDER BY column_name
				LIMIT %d
			`, catalog, searchPattern, limit)

			result, err := s.ExecuteQuery(ctx, columnQuery, catalog, "information_schema")
			if err != nil {
				continue // Skip catalogs with errors
			}

			for _, row := range result.Rows {
				if len(row) < 4 {
					continue
				}
				tableCatalog, _ := row[0].(string)
				tableSchema, _ := row[1].(string)
				tableName, _ := row[2].(string)
				columnName, _ := row[3].(string)

				results = append(results, models.MetadataSearchResult{
					Catalog: tableCatalog,
					Schema:  tableSchema,
					Table:   tableName,
					Column:  columnName,
					Type:    "column",
				})
			}
		}

		// Stop if we have enough results
		if len(results) >= limit {
			results = results[:limit]
			break
		}
	}

	return results, nil
}

// escapeSearchQuery escapes special characters in search query to prevent SQL injection
func escapeSearchQuery(query string) string {
	// Escape single quotes by doubling them
	result := ""
	for _, c := range query {
		if c == '\'' {
			result += "''"
		} else if c == '%' {
			// Escape % in LIKE pattern
			result += "\\%"
		} else if c == '_' {
			// Escape _ in LIKE pattern
			result += "\\_"
		} else {
			result += string(c)
		}
	}
	return result
}

func (s *TrinoService) getDB(dsn string) (*sql.DB, error) {
	if db, ok := s.dbs.Load(dsn); ok {
		return db.(*sql.DB), nil
	}

	db, err := sql.Open("trino", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Trino: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping Trino: %w", err)
	}

	s.dbs.Store(dsn, db)
	return db, nil
}

var identifierPattern = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func validateIdentifier(identifier string) error {
	if identifier == "" {
		return errors.New("identifier is required")
	}
	if !identifierPattern.MatchString(identifier) {
		return errors.New("invalid identifier")
	}
	return nil
}
