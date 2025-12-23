import { describe, it, expect } from 'vitest'
import {
  extractParameters,
  replaceParameters,
  extractAllParameters,
  hasUnresolvedParameters,
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
