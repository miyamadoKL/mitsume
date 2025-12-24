import { describe, it, expect } from 'vitest'
import {
  extractParameters,
  replaceParameters,
  extractAllParameters,
  hasUnresolvedParameters,
  containsSqlInjection,
  escapeSqlValue,
  sanitizeParameterValue,
  ParameterValidationError,
} from './params'

describe('extractParameters', () => {
  it('should extract single parameter', () => {
    const query = 'SELECT * FROM users WHERE date = {{date}}'
    expect(extractParameters(query)).toEqual(['date'])
  })

  it('should extract multiple parameters', () => {
    const query = 'SELECT * FROM sales WHERE date = {{date}} AND region = {{region}}'
    expect(extractParameters(query)).toEqual(['date', 'region'])
  })

  it('should return unique parameters only', () => {
    const query = 'SELECT * FROM sales WHERE start_date = {{date}} AND end_date = {{date}}'
    expect(extractParameters(query)).toEqual(['date'])
  })

  it('should handle parameters with underscores and numbers', () => {
    const query = 'SELECT * FROM data WHERE col1 = {{param_1}} AND col2 = {{my_param_2}}'
    expect(extractParameters(query)).toEqual(['param_1', 'my_param_2'])
  })

  it('should return empty array when no parameters', () => {
    const query = 'SELECT * FROM users'
    expect(extractParameters(query)).toEqual([])
  })

  it('should not match invalid parameter names', () => {
    const query = 'SELECT * FROM users WHERE id = {{123invalid}}'
    expect(extractParameters(query)).toEqual([])
  })

  it('should handle multiline queries', () => {
    const query = `
      SELECT *
      FROM orders
      WHERE date = {{order_date}}
      AND status = {{status}}
    `
    expect(extractParameters(query)).toEqual(['order_date', 'status'])
  })
})

describe('replaceParameters', () => {
  it('should replace single parameter', () => {
    const query = 'SELECT * FROM users WHERE date = {{date}}'
    const result = replaceParameters(query, { date: '2024-01-01' })
    expect(result).toBe("SELECT * FROM users WHERE date = 2024-01-01")
  })

  it('should replace multiple parameters', () => {
    const query = 'SELECT * FROM sales WHERE date = {{date}} AND region = {{region}}'
    const result = replaceParameters(query, { date: '2024-01-01', region: 'Asia' })
    expect(result).toBe("SELECT * FROM sales WHERE date = 2024-01-01 AND region = Asia")
  })

  it('should replace same parameter multiple times', () => {
    const query = 'SELECT * FROM sales WHERE start_date = {{date}} AND end_date = {{date}}'
    const result = replaceParameters(query, { date: '2024-01-01' })
    expect(result).toBe("SELECT * FROM sales WHERE start_date = 2024-01-01 AND end_date = 2024-01-01")
  })

  it('should keep placeholder when parameter value is not provided', () => {
    const query = 'SELECT * FROM sales WHERE date = {{date}} AND region = {{region}}'
    const result = replaceParameters(query, { date: '2024-01-01' })
    expect(result).toBe("SELECT * FROM sales WHERE date = 2024-01-01 AND region = {{region}}")
  })

  it('should handle empty params object', () => {
    const query = 'SELECT * FROM users WHERE date = {{date}}'
    const result = replaceParameters(query, {})
    expect(result).toBe('SELECT * FROM users WHERE date = {{date}}')
  })

  it('should handle query without parameters', () => {
    const query = 'SELECT * FROM users'
    const result = replaceParameters(query, { date: '2024-01-01' })
    expect(result).toBe('SELECT * FROM users')
  })
})

describe('extractAllParameters', () => {
  it('should extract parameters from multiple queries', () => {
    const queries = [
      'SELECT * FROM users WHERE date = {{date}}',
      'SELECT * FROM orders WHERE region = {{region}}',
    ]
    expect(extractAllParameters(queries)).toEqual(['date', 'region'])
  })

  it('should return unique parameters across queries', () => {
    const queries = [
      'SELECT * FROM users WHERE date = {{date}}',
      'SELECT * FROM orders WHERE date = {{date}} AND region = {{region}}',
    ]
    expect(extractAllParameters(queries)).toEqual(['date', 'region'])
  })

  it('should handle empty array', () => {
    expect(extractAllParameters([])).toEqual([])
  })

  it('should handle queries without parameters', () => {
    const queries = [
      'SELECT * FROM users',
      'SELECT * FROM orders',
    ]
    expect(extractAllParameters(queries)).toEqual([])
  })
})

describe('hasUnresolvedParameters', () => {
  it('should return true when parameter has no value', () => {
    const query = 'SELECT * FROM users WHERE date = {{date}}'
    expect(hasUnresolvedParameters(query, {})).toBe(true)
  })

  it('should return true when parameter value is empty string', () => {
    const query = 'SELECT * FROM users WHERE date = {{date}}'
    expect(hasUnresolvedParameters(query, { date: '' })).toBe(true)
  })

  it('should return false when all parameters have values', () => {
    const query = 'SELECT * FROM sales WHERE date = {{date}} AND region = {{region}}'
    expect(hasUnresolvedParameters(query, { date: '2024-01-01', region: 'Asia' })).toBe(false)
  })

  it('should return true when some parameters are missing', () => {
    const query = 'SELECT * FROM sales WHERE date = {{date}} AND region = {{region}}'
    expect(hasUnresolvedParameters(query, { date: '2024-01-01' })).toBe(true)
  })

  it('should return false when query has no parameters', () => {
    const query = 'SELECT * FROM users'
    expect(hasUnresolvedParameters(query, {})).toBe(false)
  })
})

// =====================
// SQL Injection Prevention Tests
// =====================

describe('containsSqlInjection', () => {
  it('should detect DROP TABLE injection', () => {
    expect(containsSqlInjection("'; DROP TABLE users; --")).toBe(true)
    expect(containsSqlInjection("; DROP TABLE users")).toBe(true)
    expect(containsSqlInjection("test; DELETE FROM users")).toBe(true)
  })

  it('should detect UNION SELECT injection', () => {
    expect(containsSqlInjection("' UNION SELECT * FROM passwords --")).toBe(true)
    expect(containsSqlInjection("1 UNION ALL SELECT username, password FROM users")).toBe(true)
  })

  it('should detect OR-based injection', () => {
    expect(containsSqlInjection("' OR '1'='1")).toBe(true)
    expect(containsSqlInjection("' OR 1=1 --")).toBe(true)
  })

  it('should detect comment injection', () => {
    expect(containsSqlInjection("admin'--")).toBe(true)
    expect(containsSqlInjection("/* malicious */")).toBe(true)
  })

  it('should detect statement termination with dangerous commands', () => {
    expect(containsSqlInjection("; TRUNCATE TABLE users")).toBe(true)
    expect(containsSqlInjection("; ALTER TABLE users ADD COLUMN hacked VARCHAR")).toBe(true)
    expect(containsSqlInjection("; CREATE TABLE hacked (id INT)")).toBe(true)
    expect(containsSqlInjection("; INSERT INTO users VALUES (1, 'hacker')")).toBe(true)
    expect(containsSqlInjection("; UPDATE users SET admin=1")).toBe(true)
    expect(containsSqlInjection("; GRANT ALL ON users TO hacker")).toBe(true)
    expect(containsSqlInjection("; REVOKE ALL FROM user")).toBe(true)
  })

  it('should allow safe values', () => {
    expect(containsSqlInjection('2024-01-01')).toBe(false)
    expect(containsSqlInjection('Tokyo')).toBe(false)
    expect(containsSqlInjection("O'Brien")).toBe(false)  // Names with apostrophes are OK
    expect(containsSqlInjection('category-1')).toBe(false)
    expect(containsSqlInjection('100')).toBe(false)
    expect(containsSqlInjection('user@example.com')).toBe(false)
  })

  it('should allow SELECT in values (not dangerous by itself)', () => {
    expect(containsSqlInjection('SELECT')).toBe(false)
    expect(containsSqlInjection('my-SELECT-value')).toBe(false)
  })
})

describe('escapeSqlValue', () => {
  it('should escape single quotes by doubling', () => {
    expect(escapeSqlValue("O'Brien")).toBe("O''Brien")
    expect(escapeSqlValue("It's a test")).toBe("It''s a test")
    expect(escapeSqlValue("''")).toBe("''''")
  })

  it('should not modify values without quotes', () => {
    expect(escapeSqlValue('2024-01-01')).toBe('2024-01-01')
    expect(escapeSqlValue('Tokyo')).toBe('Tokyo')
    expect(escapeSqlValue('123')).toBe('123')
  })

  it('should handle empty string', () => {
    expect(escapeSqlValue('')).toBe('')
  })
})

describe('sanitizeParameterValue', () => {
  it('should escape safe values with quotes', () => {
    expect(sanitizeParameterValue("O'Brien")).toBe("O''Brien")
    expect(sanitizeParameterValue("McDonald's")).toBe("McDonald''s")
  })

  it('should return safe values unchanged', () => {
    expect(sanitizeParameterValue('2024-01-01')).toBe('2024-01-01')
    expect(sanitizeParameterValue('Tokyo')).toBe('Tokyo')
  })

  it('should throw on dangerous patterns', () => {
    expect(() => sanitizeParameterValue("'; DROP TABLE users; --"))
      .toThrow(ParameterValidationError)
    expect(() => sanitizeParameterValue("' UNION SELECT * FROM passwords"))
      .toThrow(ParameterValidationError)
    expect(() => sanitizeParameterValue("' OR '1'='1"))
      .toThrow(ParameterValidationError)
  })
})

describe('replaceParameters with sanitization', () => {
  it('should escape single quotes in parameter values', () => {
    const query = "SELECT * FROM users WHERE name = '{{name}}'"
    const result = replaceParameters(query, { name: "O'Brien" })
    expect(result).toBe("SELECT * FROM users WHERE name = 'O''Brien'")
  })

  it('should throw on SQL injection attempt', () => {
    const query = "SELECT * FROM users WHERE id = {{id}}"
    expect(() => replaceParameters(query, { id: "'; DROP TABLE users; --" }))
      .toThrow(ParameterValidationError)
  })

  it('should throw on UNION injection attempt', () => {
    const query = "SELECT * FROM users WHERE id = {{id}}"
    expect(() => replaceParameters(query, { id: "1 UNION SELECT * FROM passwords" }))
      .toThrow(ParameterValidationError)
  })

  it('should allow safe values', () => {
    const query = "SELECT * FROM orders WHERE date = '{{date}}' AND region = '{{region}}'"
    const result = replaceParameters(query, { date: '2024-01-01', region: 'Asia-Pacific' })
    expect(result).toBe("SELECT * FROM orders WHERE date = '2024-01-01' AND region = 'Asia-Pacific'")
  })

  it('should handle multiple quotes in value', () => {
    const query = "SELECT * FROM products WHERE name = '{{name}}'"
    const result = replaceParameters(query, { name: "Test's \"Product\"" })
    expect(result).toBe("SELECT * FROM products WHERE name = 'Test''s \"Product\"'")
  })

  it('should allow skipSanitization option for internal use', () => {
    const query = "SELECT * FROM users WHERE id = {{id}}"
    // This should not throw even with dangerous pattern when skipSanitization is true
    const result = replaceParameters(
      query,
      { id: "test'; --" },
      { skipSanitization: true }
    )
    expect(result).toBe("SELECT * FROM users WHERE id = test'; --")
  })
})
