import { describe, expect, it } from 'vitest'
import { quoteIdentifier, buildFullyQualifiedName } from './sql-utils'

describe('sql-utils', () => {
  describe('quoteIdentifier', () => {
    it('returns unquoted simple identifiers', () => {
      expect(quoteIdentifier('users')).toBe('users')
      expect(quoteIdentifier('my_table')).toBe('my_table')
      expect(quoteIdentifier('table123')).toBe('table123')
    })

    it('quotes identifiers starting with uppercase', () => {
      expect(quoteIdentifier('Users')).toBe('"Users"')
      expect(quoteIdentifier('MyTable')).toBe('"MyTable"')
    })

    it('quotes identifiers with special characters', () => {
      expect(quoteIdentifier('my-table')).toBe('"my-table"')
      expect(quoteIdentifier('my table')).toBe('"my table"')
      expect(quoteIdentifier('table.name')).toBe('"table.name"')
    })

    it('quotes reserved words', () => {
      expect(quoteIdentifier('select')).toBe('"select"')
      expect(quoteIdentifier('from')).toBe('"from"')
      expect(quoteIdentifier('table')).toBe('"table"')
      expect(quoteIdentifier('where')).toBe('"where"')
      expect(quoteIdentifier('order')).toBe('"order"')
    })

    it('escapes double quotes by doubling them', () => {
      expect(quoteIdentifier('my"table')).toBe('"my""table"')
      expect(quoteIdentifier('table""name')).toBe('"table""""name"')
    })

    it('quotes identifiers starting with numbers', () => {
      expect(quoteIdentifier('123table')).toBe('"123table"')
      expect(quoteIdentifier('1_users')).toBe('"1_users"')
    })
  })

  describe('buildFullyQualifiedName', () => {
    it('builds simple three-part name', () => {
      expect(buildFullyQualifiedName('memory', 'default', 'users'))
        .toBe('memory.default.users')
    })

    it('builds four-part name with column', () => {
      expect(buildFullyQualifiedName('memory', 'default', 'users', 'id'))
        .toBe('memory.default.users.id')
    })

    it('quotes parts with special characters', () => {
      expect(buildFullyQualifiedName('my-catalog', 'my schema', 'users'))
        .toBe('"my-catalog"."my schema".users')
    })

    it('quotes reserved word parts', () => {
      expect(buildFullyQualifiedName('catalog', 'select', 'table'))
        .toBe('catalog."select"."table"')
    })

    it('handles mixed quoting requirements', () => {
      expect(buildFullyQualifiedName('hive', 'default', 'Order-Items', 'order_id'))
        .toBe('hive.default."Order-Items".order_id')
    })
  })
})
