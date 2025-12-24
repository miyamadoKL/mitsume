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

// =====================
// YoY/WoW/MoM Comparison Functions
// =====================

export type ComparisonType = 'yoy' | 'mom' | 'wow' | 'dod' | 'custom'

export interface ComparisonResult {
  currentValue: number
  previousValue: number | null
  absoluteChange: number | null
  percentChange: number | null
}

/**
 * Get the offset in milliseconds for a comparison type
 */
function getComparisonOffset(type: ComparisonType, customPeriods?: number): number {
  const DAY = 24 * 60 * 60 * 1000
  const WEEK = 7 * DAY

  switch (type) {
    case 'yoy': // Year over Year
      return 365 * DAY
    case 'mom': // Month over Month (approximately 30 days)
      return 30 * DAY
    case 'wow': // Week over Week
      return WEEK
    case 'dod': // Day over Day
      return DAY
    case 'custom':
      return (customPeriods || 1) * DAY
  }
}

/**
 * Calculate period-over-period comparison for time series data
 * Returns arrays of previous values and percent changes aligned with current values
 */
export function calculatePeriodComparison(
  xValues: unknown[],
  yValues: number[],
  comparisonType: ComparisonType,
  customPeriods?: number
): {
  previousValues: (number | null)[]
  absoluteChanges: (number | null)[]
  percentChanges: (number | null)[]
} {
  const offset = getComparisonOffset(comparisonType, customPeriods)

  // Parse all dates and create lookup map
  const dateValueMap = new Map<number, number>()
  const parsedDates: (Date | null)[] = []

  for (let i = 0; i < xValues.length; i++) {
    const date = parseDate(xValues[i])
    parsedDates.push(date)
    if (date) {
      dateValueMap.set(date.getTime(), yValues[i])
    }
  }

  const previousValues: (number | null)[] = []
  const absoluteChanges: (number | null)[] = []
  const percentChanges: (number | null)[] = []

  for (let i = 0; i < xValues.length; i++) {
    const currentDate = parsedDates[i]
    const currentValue = yValues[i]

    if (!currentDate) {
      previousValues.push(null)
      absoluteChanges.push(null)
      percentChanges.push(null)
      continue
    }

    // Find the value from the comparison period
    const previousTime = currentDate.getTime() - offset

    // Look for an exact match or closest match within tolerance
    let previousValue: number | null = null
    const tolerance = 12 * 60 * 60 * 1000 // 12 hours tolerance

    // Check exact match first
    if (dateValueMap.has(previousTime)) {
      previousValue = dateValueMap.get(previousTime)!
    } else {
      // Look for closest match within tolerance
      for (const [time, value] of dateValueMap) {
        if (Math.abs(time - previousTime) <= tolerance) {
          previousValue = value
          break
        }
      }
    }

    previousValues.push(previousValue)

    if (previousValue !== null) {
      const absChange = currentValue - previousValue
      absoluteChanges.push(absChange)
      percentChanges.push(
        previousValue !== 0 ? (absChange / previousValue) * 100 : null
      )
    } else {
      absoluteChanges.push(null)
      percentChanges.push(null)
    }
  }

  return { previousValues, absoluteChanges, percentChanges }
}

/**
 * Calculate a single comparison value for counter/KPI widgets
 */
export function calculateSingleComparison(
  currentValue: number,
  currentDate: Date,
  historicalData: Array<{ date: Date; value: number }>,
  comparisonType: ComparisonType,
  customPeriods?: number
): ComparisonResult {
  const offset = getComparisonOffset(comparisonType, customPeriods)
  const previousTime = currentDate.getTime() - offset
  const tolerance = 12 * 60 * 60 * 1000 // 12 hours

  // Find the closest historical value
  let previousValue: number | null = null
  let closestDiff = Infinity

  for (const item of historicalData) {
    const diff = Math.abs(item.date.getTime() - previousTime)
    if (diff < closestDiff && diff <= tolerance) {
      closestDiff = diff
      previousValue = item.value
    }
  }

  if (previousValue === null) {
    return {
      currentValue,
      previousValue: null,
      absoluteChange: null,
      percentChange: null,
    }
  }

  const absoluteChange = currentValue - previousValue
  const percentChange = previousValue !== 0 ? (absoluteChange / previousValue) * 100 : null

  return {
    currentValue,
    previousValue,
    absoluteChange,
    percentChange,
  }
}

/**
 * Format a comparison value for display
 */
export function formatComparisonChange(
  percentChange: number | null,
  absoluteChange: number | null,
  showPercent: boolean = true,
  showAbsolute: boolean = false
): string {
  const parts: string[] = []

  if (showPercent && percentChange !== null) {
    const sign = percentChange >= 0 ? '+' : ''
    parts.push(`${sign}${percentChange.toFixed(1)}%`)
  }

  if (showAbsolute && absoluteChange !== null) {
    const sign = absoluteChange >= 0 ? '+' : ''
    parts.push(`(${sign}${absoluteChange.toLocaleString()})`)
  }

  return parts.join(' ')
}

/**
 * Get display label for comparison type
 */
export function getComparisonLabel(type: ComparisonType): string {
  switch (type) {
    case 'yoy': return 'vs Last Year'
    case 'mom': return 'vs Last Month'
    case 'wow': return 'vs Last Week'
    case 'dod': return 'vs Yesterday'
    case 'custom': return 'vs Previous Period'
  }
}
