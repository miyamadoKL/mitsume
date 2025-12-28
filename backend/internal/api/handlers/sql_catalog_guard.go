package handlers

import (
	"context"
	"errors"
	"regexp"

	"github.com/google/uuid"
	"github.com/mitsume/backend/internal/services"
)

var (
	ErrCatalogAccessDenied   = errors.New("access denied to catalog")
	ErrShowCatalogsForbidden = errors.New("SHOW CATALOGS is not allowed; use the catalogs API instead")
)

var (
	showCatalogsPattern = regexp.MustCompile(`(?i)\bSHOW\s+CATALOGS\b`)

	// catalog.schema.table references (quoted or unquoted identifiers)
	catalogThreePartPattern = regexp.MustCompile(`(?i)([a-zA-Z_][a-zA-Z0-9_]*|"[^"]+")\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*|"[^"]+")\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*|"[^"]+")`)

	// Trino metadata statements
	showSchemasFromCatalogPattern = regexp.MustCompile(`(?i)\bSHOW\s+SCHEMAS\s+(?:FROM|IN)\s+("([^"]+)"|[a-zA-Z_][a-zA-Z0-9_]*)`)
	showTablesFromCatalogSchema   = regexp.MustCompile(`(?i)\bSHOW\s+TABLES\s+(?:FROM|IN)\s+("([^"]+)"|[a-zA-Z_][a-zA-Z0-9_]*)\s*\.`)
	useCatalogSchemaPattern       = regexp.MustCompile(`(?i)\bUSE\s+("([^"]+)"|[a-zA-Z_][a-zA-Z0-9_]*)\s*\.`)
)

func unquoteIdentifier(identifier string) string {
	if len(identifier) >= 2 && identifier[0] == '"' && identifier[len(identifier)-1] == '"' {
		return identifier[1 : len(identifier)-1]
	}
	return identifier
}

func extractReferencedCatalogs(query string) []string {
	seen := make(map[string]struct{})
	catalogs := make([]string, 0)

	add := func(catalog string) {
		if catalog == "" {
			return
		}
		if _, ok := seen[catalog]; ok {
			return
		}
		seen[catalog] = struct{}{}
		catalogs = append(catalogs, catalog)
	}

	for _, match := range catalogThreePartPattern.FindAllStringSubmatch(query, -1) {
		if len(match) > 1 {
			add(unquoteIdentifier(match[1]))
		}
	}
	for _, match := range showSchemasFromCatalogPattern.FindAllStringSubmatch(query, -1) {
		if len(match) > 2 && match[2] != "" {
			add(match[2])
			continue
		}
		if len(match) > 1 {
			add(unquoteIdentifier(match[1]))
		}
	}
	for _, match := range showTablesFromCatalogSchema.FindAllStringSubmatch(query, -1) {
		if len(match) > 2 && match[2] != "" {
			add(match[2])
			continue
		}
		if len(match) > 1 {
			add(unquoteIdentifier(match[1]))
		}
	}
	for _, match := range useCatalogSchemaPattern.FindAllStringSubmatch(query, -1) {
		if len(match) > 2 && match[2] != "" {
			add(match[2])
			continue
		}
		if len(match) > 1 {
			add(unquoteIdentifier(match[1]))
		}
	}

	return catalogs
}

func userCanAccessCatalogs(allowedCatalogs []string, catalogs []string) bool {
	if len(catalogs) == 0 {
		return true
	}
	if allowedCatalogs == nil {
		return true
	}
	allowedSet := make(map[string]struct{}, len(allowedCatalogs))
	for _, c := range allowedCatalogs {
		allowedSet[c] = struct{}{}
	}

	for _, catalog := range catalogs {
		if _, ok := allowedSet[catalog]; !ok {
			return false
		}
	}
	return true
}

func enforceCatalogAccess(
	ctx context.Context,
	roleService *services.RoleService,
	userID uuid.UUID,
	query string,
	effectiveCatalog string,
) error {
	if roleService == nil {
		return nil
	}

	allowedCatalogs, err := roleService.GetUserAllowedCatalogs(ctx, userID)
	if err != nil {
		return err
	}

	// Block SHOW CATALOGS for non-admin users to avoid metadata leakage; use /catalogs instead.
	if allowedCatalogs != nil && showCatalogsPattern.MatchString(query) {
		return ErrShowCatalogsForbidden
	}

	requiredCatalogs := extractReferencedCatalogs(query)
	if effectiveCatalog != "" {
		requiredCatalogs = append(requiredCatalogs, effectiveCatalog)
	}

	// nil means admin has access to all catalogs
	if allowedCatalogs == nil {
		return nil
	}

	if !userCanAccessCatalogs(allowedCatalogs, requiredCatalogs) {
		return ErrCatalogAccessDenied
	}
	return nil
}
