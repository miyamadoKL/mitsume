// Trino reserved words (common ones)
const TRINO_RESERVED_WORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'in', 'is', 'null',
  'true', 'false', 'as', 'on', 'join', 'left', 'right', 'inner', 'outer',
  'full', 'cross', 'group', 'by', 'order', 'having', 'limit', 'offset',
  'union', 'intersect', 'except', 'case', 'when', 'then', 'else', 'end',
  'cast', 'between', 'like', 'escape', 'exists', 'table', 'insert',
  'update', 'delete', 'create', 'drop', 'alter', 'index', 'view',
  'with', 'recursive', 'distinct', 'all', 'any', 'some',
])

/**
 * Quote an identifier if necessary (Trino uses double quotes)
 */
export function quoteIdentifier(name: string): string {
  // Lowercase letters, underscores at start, alphanumeric/underscores after
  // and not a reserved word - no quoting needed
  if (
    /^[a-z_][a-z0-9_]*$/.test(name) &&
    !TRINO_RESERVED_WORDS.has(name.toLowerCase())
  ) {
    return name
  }

  // Escape double quotes by doubling them
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Build a fully qualified name
 */
export function buildFullyQualifiedName(
  catalog: string,
  schema: string,
  table: string,
  column?: string
): string {
  const parts = [catalog, schema, table]
  if (column) parts.push(column)
  return parts.map(quoteIdentifier).join('.')
}
