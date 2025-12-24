/**
 * Query parameter utilities for {{param_name}} placeholder support
 * Includes SQL injection prevention measures
 */

const PARAM_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g

/**
 * SQL injection prevention patterns
 * These patterns indicate potential injection attempts
 */
const DANGEROUS_PATTERNS = [
  /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|GRANT|REVOKE)/i,
  /;\s*--/,
  /'\s*OR\s+'?\d*'?\s*=\s*'?\d*'?/i,
  /'\s*OR\s+'[^']*'\s*=\s*'[^']*'/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /\/\*[\s\S]*?\*\//,
  /--\s*$/m,
]

/**
 * Check if a value contains potential SQL injection patterns
 */
export function containsSqlInjection(value: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(value))
}

/**
 * Escape special SQL characters in a string value
 * This escapes single quotes by doubling them (SQL standard)
 */
export function escapeSqlValue(value: string): string {
  // Escape single quotes by doubling them
  return value.replace(/'/g, "''")
}

/**
 * Sanitize a parameter value for safe SQL inclusion
 * Returns the sanitized value or throws if dangerous patterns detected
 */
export function sanitizeParameterValue(value: string): string {
  // Check for dangerous patterns
  if (containsSqlInjection(value)) {
    throw new ParameterValidationError(
      `Parameter value contains potentially dangerous SQL patterns: "${value.substring(0, 50)}..."`
    )
  }

  // Escape SQL special characters
  return escapeSqlValue(value)
}

/**
 * Custom error for parameter validation failures
 */
export class ParameterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParameterValidationError'
  }
}

/**
 * Extract parameter names from a query string.
 * @param queryText - SQL query with {{param}} placeholders
 * @returns Array of unique parameter names
 */
export function extractParameters(queryText: string): string[] {
  const params: string[] = []
  let match: RegExpExecArray | null

  while ((match = PARAM_REGEX.exec(queryText)) !== null) {
    const paramName = match[1]
    if (!params.includes(paramName)) {
      params.push(paramName)
    }
  }

  // Reset regex lastIndex for next use
  PARAM_REGEX.lastIndex = 0

  return params
}

/**
 * Replace parameter placeholders with actual values.
 * Values are sanitized to prevent SQL injection.
 * @param queryText - SQL query with {{param}} placeholders
 * @param params - Object mapping parameter names to values
 * @param options - Optional settings for parameter replacement
 * @returns Query string with parameters replaced (sanitized)
 * @throws ParameterValidationError if a value contains dangerous SQL patterns
 */
export function replaceParameters(
  queryText: string,
  params: Record<string, string>,
  options: { skipSanitization?: boolean } = {}
): string {
  return queryText.replace(PARAM_REGEX, (match, paramName) => {
    const value = params[paramName]
    // If parameter has a value, sanitize and use it; otherwise keep the placeholder
    if (value !== undefined) {
      // Skip sanitization only if explicitly requested (for internal use)
      if (options.skipSanitization) {
        return value
      }
      return sanitizeParameterValue(value)
    }
    return match
  })
}

/**
 * Extract all unique parameters from multiple queries.
 * @param queries - Array of SQL query strings
 * @returns Array of unique parameter names across all queries
 */
export function extractAllParameters(queries: string[]): string[] {
  const allParams: string[] = []

  for (const query of queries) {
    const params = extractParameters(query)
    for (const param of params) {
      if (!allParams.includes(param)) {
        allParams.push(param)
      }
    }
  }

  return allParams
}

/**
 * Check if a query has any unresolved parameters.
 * @param queryText - SQL query string
 * @param params - Object mapping parameter names to values
 * @returns True if there are parameters without values
 */
export function hasUnresolvedParameters(
  queryText: string,
  params: Record<string, string>
): boolean {
  const required = extractParameters(queryText)
  return required.some(param => params[param] === undefined || params[param] === '')
}
