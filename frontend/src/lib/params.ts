/**
 * Query parameter utilities for {{param_name}} placeholder support
 */

const PARAM_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g

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
 * @param queryText - SQL query with {{param}} placeholders
 * @param params - Object mapping parameter names to values
 * @returns Query string with parameters replaced
 */
export function replaceParameters(
  queryText: string,
  params: Record<string, string>
): string {
  return queryText.replace(PARAM_REGEX, (match, paramName) => {
    const value = params[paramName]
    // If parameter has a value, use it; otherwise keep the placeholder
    return value !== undefined ? value : match
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
