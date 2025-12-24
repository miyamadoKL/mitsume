import type { ConditionalFormatRule } from '@/types'

/**
 * Result of evaluating a conditional format rule
 */
export interface FormatResult {
  backgroundColor?: string
  textColor?: string
}

/**
 * Evaluate a single conditional format rule against a value
 */
export function evaluateRule(
  value: unknown,
  rule: ConditionalFormatRule
): boolean {
  const numValue = Number(value)
  if (isNaN(numValue)) return false

  switch (rule.condition) {
    case 'gt':
      return numValue > (rule.value as number)
    case 'lt':
      return numValue < (rule.value as number)
    case 'eq':
      return numValue === (rule.value as number)
    case 'gte':
      return numValue >= (rule.value as number)
    case 'lte':
      return numValue <= (rule.value as number)
    case 'between': {
      const [min, max] = rule.value as [number, number]
      return numValue >= min && numValue <= max
    }
    default:
      return false
  }
}

/**
 * Evaluate all rules for a value and return the format to apply
 * First matching rule wins
 */
export function evaluateConditionalFormat(
  value: unknown,
  rules: ConditionalFormatRule[]
): FormatResult {
  for (const rule of rules) {
    if (evaluateRule(value, rule)) {
      return {
        backgroundColor: rule.backgroundColor,
        textColor: rule.textColor,
      }
    }
  }
  return {}
}

/**
 * Get CSS style object from format result
 */
export function getFormatStyle(format: FormatResult): React.CSSProperties {
  const style: React.CSSProperties = {}

  if (format.backgroundColor) {
    style.backgroundColor = format.backgroundColor
  }
  if (format.textColor) {
    style.color = format.textColor
  }

  return style
}

/**
 * Predefined conditional format presets
 */
export const FORMAT_PRESETS = {
  // Traffic light: red for low, yellow for medium, green for high
  trafficLight: (low: number, high: number): ConditionalFormatRule[] => [
    { condition: 'lt', value: low, backgroundColor: '#ffcdd2', textColor: '#c62828' },
    { condition: 'between', value: [low, high], backgroundColor: '#fff9c4', textColor: '#f9a825' },
    { condition: 'gt', value: high, backgroundColor: '#c8e6c9', textColor: '#2e7d32' },
  ],

  // Positive/negative: green for positive, red for negative
  positiveNegative: (): ConditionalFormatRule[] => [
    { condition: 'gt', value: 0, backgroundColor: '#c8e6c9', textColor: '#2e7d32' },
    { condition: 'lt', value: 0, backgroundColor: '#ffcdd2', textColor: '#c62828' },
  ],

  // Above/below threshold
  threshold: (threshold: number, aboveIsGood: boolean): ConditionalFormatRule[] => [
    {
      condition: 'gte',
      value: threshold,
      backgroundColor: aboveIsGood ? '#c8e6c9' : '#ffcdd2',
      textColor: aboveIsGood ? '#2e7d32' : '#c62828',
    },
    {
      condition: 'lt',
      value: threshold,
      backgroundColor: aboveIsGood ? '#ffcdd2' : '#c8e6c9',
      textColor: aboveIsGood ? '#c62828' : '#2e7d32',
    },
  ],

  // Progress: color gradient based on completion
  progress: (): ConditionalFormatRule[] => [
    { condition: 'lt', value: 25, backgroundColor: '#ffcdd2', textColor: '#c62828' },
    { condition: 'between', value: [25, 50], backgroundColor: '#ffe0b2', textColor: '#e65100' },
    { condition: 'between', value: [50, 75], backgroundColor: '#fff9c4', textColor: '#f9a825' },
    { condition: 'between', value: [75, 100], backgroundColor: '#dcedc8', textColor: '#558b2f' },
    { condition: 'gte', value: 100, backgroundColor: '#c8e6c9', textColor: '#2e7d32' },
  ],
}

/**
 * Get display label for condition operator
 */
export function getConditionLabel(condition: ConditionalFormatRule['condition']): string {
  switch (condition) {
    case 'gt': return 'Greater than'
    case 'lt': return 'Less than'
    case 'eq': return 'Equal to'
    case 'gte': return 'Greater than or equal to'
    case 'lte': return 'Less than or equal to'
    case 'between': return 'Between'
  }
}

/**
 * Validate a conditional format rule
 */
export function validateRule(rule: Partial<ConditionalFormatRule>): string[] {
  const errors: string[] = []

  if (!rule.condition) {
    errors.push('Condition is required')
  }

  if (rule.value === undefined || rule.value === null) {
    errors.push('Value is required')
  } else if (rule.condition === 'between') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      errors.push('Between condition requires a range [min, max]')
    } else if (rule.value[0] >= rule.value[1]) {
      errors.push('Min value must be less than max value')
    }
  } else if (typeof rule.value !== 'number') {
    errors.push('Value must be a number')
  }

  if (!rule.backgroundColor && !rule.textColor) {
    errors.push('At least one of backgroundColor or textColor is required')
  }

  return errors
}
