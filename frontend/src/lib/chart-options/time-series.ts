import type { TimeSeriesConfig } from '@/types'

/**
 * Calculate rolling window aggregate for a numeric series
 */
export function calculateRollingWindow(
  values: number[],
  periods: number,
  func: 'mean' | 'sum' | 'min' | 'max'
): (number | null)[] {
  const result: (number | null)[] = []

  for (let i = 0; i < values.length; i++) {
    if (i < periods - 1) {
      // Not enough data points for the window yet
      result.push(null)
      continue
    }

    const window = values.slice(i - periods + 1, i + 1)

    switch (func) {
      case 'mean':
        result.push(window.reduce((a, b) => a + b, 0) / window.length)
        break
      case 'sum':
        result.push(window.reduce((a, b) => a + b, 0))
        break
      case 'min':
        result.push(Math.min(...window))
        break
      case 'max':
        result.push(Math.max(...window))
        break
    }
  }

  return result
}

/**
 * Calculate cumulative sum for a numeric series
 */
export function calculateCumulative(values: number[]): number[] {
  const result: number[] = []
  let sum = 0

  for (const value of values) {
    sum += value
    result.push(sum)
  }

  return result
}

/**
 * Apply time series transformations to series data
 */
export function applyTimeSeriesTransform(
  data: number[],
  config: TimeSeriesConfig
): (number | null)[] {
  let result: (number | null)[] = [...data]

  // Apply cumulative first (before rolling)
  if (config.cumulative?.enabled) {
    result = calculateCumulative(data)
  }

  // Apply rolling window
  if (config.rollingWindow?.enabled) {
    const periods = config.rollingWindow.periods || 7
    const func = config.rollingWindow.function || 'mean'
    result = calculateRollingWindow(
      result.map(v => v ?? 0),
      periods,
      func
    )
  }

  return result
}

/**
 * Parse date/time values and aggregate by granularity
 */
export function aggregateByGranularity(
  xValues: unknown[],
  yValues: number[],
  granularity: TimeSeriesConfig['granularity'],
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count'
): { x: string[]; y: number[] } {
  const buckets = new Map<string, number[]>()

  for (let i = 0; i < xValues.length; i++) {
    const dateVal = parseDate(xValues[i])
    if (!dateVal) continue

    const bucketKey = getBucketKey(dateVal, granularity || 'day')

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, [])
    }
    buckets.get(bucketKey)!.push(yValues[i])
  }

  // Sort bucket keys chronologically
  const sortedKeys = Array.from(buckets.keys()).sort()
  const aggregatedX: string[] = []
  const aggregatedY: number[] = []

  for (const key of sortedKeys) {
    const values = buckets.get(key)!
    aggregatedX.push(key)
    aggregatedY.push(aggregate(values, aggregation))
  }

  return { x: aggregatedX, y: aggregatedY }
}

/**
 * Try to parse a value as a Date
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!isNaN(date.getTime())) return date
  }
  return null
}

/**
 * Get bucket key for a date based on granularity
 */
function getBucketKey(
  date: Date,
  granularity: NonNullable<TimeSeriesConfig['granularity']>
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')

  switch (granularity) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`
    case 'day':
      return `${year}-${month}-${day}`
    case 'week':
      // Get Monday of the week
      const dayOfWeek = date.getDay()
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(date)
      monday.setDate(diff)
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    case 'month':
      return `${year}-${month}`
    case 'quarter':
      const quarter = Math.ceil((date.getMonth() + 1) / 3)
      return `${year} Q${quarter}`
    case 'year':
      return String(year)
  }
}

/**
 * Aggregate an array of numbers
 */
function aggregate(
  values: number[],
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count'
): number {
  if (values.length === 0) return 0

  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'count':
      return values.length
  }
}

/**
 * Check if x-axis values appear to be time-based
 */
export function isTimeAxis(values: unknown[]): boolean {
  if (values.length === 0) return false

  // Check first few non-null values
  let dateCount = 0
  let checkCount = 0

  for (const val of values) {
    if (val === null || val === undefined) continue
    if (checkCount >= 5) break

    const parsed = parseDate(val)
    if (parsed) dateCount++
    checkCount++
  }

  return dateCount > checkCount / 2
}
