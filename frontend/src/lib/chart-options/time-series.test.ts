import { describe, expect, it } from 'vitest'
import {
  calculateRollingWindow,
  calculateCumulative,
  applyTimeSeriesTransform,
  aggregateByGranularity,
  isTimeAxis,
} from './time-series'

describe('calculateRollingWindow', () => {
  it('should calculate rolling mean', () => {
    const values = [10, 20, 30, 40, 50]
    const result = calculateRollingWindow(values, 3, 'mean')

    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).toBe(20) // (10 + 20 + 30) / 3
    expect(result[3]).toBe(30) // (20 + 30 + 40) / 3
    expect(result[4]).toBe(40) // (30 + 40 + 50) / 3
  })

  it('should calculate rolling sum', () => {
    const values = [10, 20, 30, 40, 50]
    const result = calculateRollingWindow(values, 3, 'sum')

    expect(result[2]).toBe(60) // 10 + 20 + 30
    expect(result[3]).toBe(90) // 20 + 30 + 40
    expect(result[4]).toBe(120) // 30 + 40 + 50
  })

  it('should calculate rolling min', () => {
    const values = [30, 10, 20, 5, 50]
    const result = calculateRollingWindow(values, 3, 'min')

    expect(result[2]).toBe(10) // min(30, 10, 20)
    expect(result[3]).toBe(5) // min(10, 20, 5)
    expect(result[4]).toBe(5) // min(20, 5, 50)
  })

  it('should calculate rolling max', () => {
    const values = [30, 10, 20, 5, 50]
    const result = calculateRollingWindow(values, 3, 'max')

    expect(result[2]).toBe(30) // max(30, 10, 20)
    expect(result[3]).toBe(20) // max(10, 20, 5)
    expect(result[4]).toBe(50) // max(20, 5, 50)
  })

  it('should return null for first (periods - 1) values', () => {
    const values = [10, 20, 30, 40, 50]
    const result = calculateRollingWindow(values, 4, 'mean')

    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).toBeNull()
    expect(result[3]).toBe(25) // (10 + 20 + 30 + 40) / 4
  })
})

describe('calculateCumulative', () => {
  it('should calculate cumulative sum', () => {
    const values = [10, 20, 30, 40, 50]
    const result = calculateCumulative(values)

    expect(result[0]).toBe(10)
    expect(result[1]).toBe(30) // 10 + 20
    expect(result[2]).toBe(60) // 10 + 20 + 30
    expect(result[3]).toBe(100) // 10 + 20 + 30 + 40
    expect(result[4]).toBe(150) // 10 + 20 + 30 + 40 + 50
  })

  it('should handle empty array', () => {
    const result = calculateCumulative([])
    expect(result).toEqual([])
  })
})

describe('applyTimeSeriesTransform', () => {
  it('should apply cumulative when enabled', () => {
    const values = [10, 20, 30]
    const result = applyTimeSeriesTransform(values, {
      cumulative: { enabled: true },
    })

    expect(result).toEqual([10, 30, 60])
  })

  it('should apply rolling window when enabled', () => {
    const values = [10, 20, 30, 40]
    const result = applyTimeSeriesTransform(values, {
      rollingWindow: { enabled: true, periods: 2, function: 'mean' },
    })

    expect(result[0]).toBeNull()
    expect(result[1]).toBe(15) // (10 + 20) / 2
    expect(result[2]).toBe(25) // (20 + 30) / 2
    expect(result[3]).toBe(35) // (30 + 40) / 2
  })

  it('should apply cumulative before rolling', () => {
    const values = [10, 20, 30]
    const result = applyTimeSeriesTransform(values, {
      cumulative: { enabled: true },
      rollingWindow: { enabled: true, periods: 2, function: 'mean' },
    })

    // Cumulative: [10, 30, 60]
    // Rolling mean of 2: [null, 20, 45]
    expect(result[0]).toBeNull()
    expect(result[1]).toBe(20) // (10 + 30) / 2
    expect(result[2]).toBe(45) // (30 + 60) / 2
  })
})

describe('aggregateByGranularity', () => {
  it('should aggregate by day', () => {
    const xValues = [
      '2024-01-15T09:00:00Z',
      '2024-01-15T14:00:00Z',
      '2024-01-16T10:00:00Z',
    ]
    const yValues = [10, 20, 30]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'sum')

    expect(result.x).toHaveLength(2)
    expect(result.y).toHaveLength(2)
    expect(result.x[0]).toBe('2024-01-15')
    expect(result.y[0]).toBe(30) // 10 + 20
    expect(result.x[1]).toBe('2024-01-16')
    expect(result.y[1]).toBe(30)
  })

  it('should aggregate by month', () => {
    const xValues = [
      '2024-01-15',
      '2024-01-20',
      '2024-02-10',
    ]
    const yValues = [10, 20, 30]

    const result = aggregateByGranularity(xValues, yValues, 'month', 'sum')

    expect(result.x).toHaveLength(2)
    expect(result.x[0]).toBe('2024-01')
    expect(result.y[0]).toBe(30) // 10 + 20
    expect(result.x[1]).toBe('2024-02')
    expect(result.y[1]).toBe(30)
  })

  it('should aggregate by hour', () => {
    const xValues = [
      '2024-01-15T09:15:00Z',
      '2024-01-15T09:45:00Z',
      '2024-01-15T10:00:00Z',
    ]
    const yValues = [10, 20, 30]

    const result = aggregateByGranularity(xValues, yValues, 'hour', 'sum')

    expect(result.x).toHaveLength(2)
    expect(result.y[0]).toBe(30) // 10 + 20 (both at 9:xx)
    expect(result.y[1]).toBe(30) // 30 (at 10:00)
  })

  it('should calculate average aggregation', () => {
    const xValues = ['2024-01-15', '2024-01-15', '2024-01-16']
    const yValues = [10, 30, 50]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'avg')

    expect(result.y[0]).toBe(20) // (10 + 30) / 2
    expect(result.y[1]).toBe(50)
  })

  it('should calculate min aggregation', () => {
    const xValues = ['2024-01-15', '2024-01-15', '2024-01-16']
    const yValues = [10, 30, 50]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'min')

    expect(result.y[0]).toBe(10)
    expect(result.y[1]).toBe(50)
  })

  it('should calculate max aggregation', () => {
    const xValues = ['2024-01-15', '2024-01-15', '2024-01-16']
    const yValues = [10, 30, 50]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'max')

    expect(result.y[0]).toBe(30)
    expect(result.y[1]).toBe(50)
  })

  it('should calculate count aggregation', () => {
    const xValues = ['2024-01-15', '2024-01-15', '2024-01-15', '2024-01-16']
    const yValues = [10, 30, 20, 50]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'count')

    expect(result.y[0]).toBe(3) // 3 values on Jan 15
    expect(result.y[1]).toBe(1) // 1 value on Jan 16
  })

  it('should sort results chronologically', () => {
    const xValues = ['2024-01-16', '2024-01-15', '2024-01-17']
    const yValues = [30, 10, 50]

    const result = aggregateByGranularity(xValues, yValues, 'day', 'sum')

    expect(result.x).toEqual(['2024-01-15', '2024-01-16', '2024-01-17'])
    expect(result.y).toEqual([10, 30, 50])
  })
})

describe('isTimeAxis', () => {
  it('should return true for ISO date strings', () => {
    const values = ['2024-01-15', '2024-01-16', '2024-01-17']
    expect(isTimeAxis(values)).toBe(true)
  })

  it('should return true for ISO datetime strings', () => {
    const values = ['2024-01-15T10:00:00Z', '2024-01-16T11:00:00Z']
    expect(isTimeAxis(values)).toBe(true)
  })

  it('should return true for Date objects', () => {
    const values = [new Date('2024-01-15'), new Date('2024-01-16')]
    expect(isTimeAxis(values)).toBe(true)
  })

  it('should return false for non-date strings', () => {
    const values = ['Category A', 'Category B', 'Category C']
    expect(isTimeAxis(values)).toBe(false)
  })

  it('should return true for numbers (Unix timestamps)', () => {
    // Numbers are interpreted as Unix timestamps (milliseconds since epoch)
    const values = [1704067200000, 1704153600000] // Jan 1, 2024 and Jan 2, 2024
    expect(isTimeAxis(values)).toBe(true)
  })

  it('should return false for empty array', () => {
    expect(isTimeAxis([])).toBe(false)
  })

  it('should handle mixed values with majority dates', () => {
    const values = ['2024-01-15', '2024-01-16', '2024-01-17', 'Invalid', null]
    expect(isTimeAxis(values)).toBe(true)
  })
})
