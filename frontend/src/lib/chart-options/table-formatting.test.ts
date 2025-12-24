import { describe, expect, it } from 'vitest'
import {
  evaluateRule,
  evaluateConditionalFormat,
  getFormatStyle,
  FORMAT_PRESETS,
  getConditionLabel,
  validateRule,
} from './table-formatting'
import type { ConditionalFormatRule } from '@/types'

describe('evaluateRule', () => {
  it('should evaluate greater than condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'gt',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule(60, rule)).toBe(true)
    expect(evaluateRule(50, rule)).toBe(false)
    expect(evaluateRule(40, rule)).toBe(false)
  })

  it('should evaluate less than condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'lt',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule(40, rule)).toBe(true)
    expect(evaluateRule(50, rule)).toBe(false)
    expect(evaluateRule(60, rule)).toBe(false)
  })

  it('should evaluate equal condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'eq',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule(50, rule)).toBe(true)
    expect(evaluateRule(49, rule)).toBe(false)
  })

  it('should evaluate greater than or equal condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'gte',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule(50, rule)).toBe(true)
    expect(evaluateRule(60, rule)).toBe(true)
    expect(evaluateRule(40, rule)).toBe(false)
  })

  it('should evaluate less than or equal condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'lte',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule(50, rule)).toBe(true)
    expect(evaluateRule(40, rule)).toBe(true)
    expect(evaluateRule(60, rule)).toBe(false)
  })

  it('should evaluate between condition', () => {
    const rule: ConditionalFormatRule = {
      condition: 'between',
      value: [25, 75],
      backgroundColor: '#fff',
    }
    expect(evaluateRule(50, rule)).toBe(true)
    expect(evaluateRule(25, rule)).toBe(true)
    expect(evaluateRule(75, rule)).toBe(true)
    expect(evaluateRule(20, rule)).toBe(false)
    expect(evaluateRule(80, rule)).toBe(false)
  })

  it('should return false for non-numeric values', () => {
    const rule: ConditionalFormatRule = {
      condition: 'gt',
      value: 50,
      backgroundColor: '#fff',
    }
    expect(evaluateRule('not a number', rule)).toBe(false)
    expect(evaluateRule(null, rule)).toBe(false)
    expect(evaluateRule(undefined, rule)).toBe(false)
  })
})

describe('evaluateConditionalFormat', () => {
  it('should return first matching rule format', () => {
    const rules: ConditionalFormatRule[] = [
      { condition: 'gt', value: 75, backgroundColor: '#green', textColor: '#darkgreen' },
      { condition: 'gt', value: 50, backgroundColor: '#yellow', textColor: '#darkyellow' },
      { condition: 'gte', value: 0, backgroundColor: '#red', textColor: '#darkred' },
    ]

    const result = evaluateConditionalFormat(80, rules)
    expect(result.backgroundColor).toBe('#green')
    expect(result.textColor).toBe('#darkgreen')
  })

  it('should return empty object when no rules match', () => {
    const rules: ConditionalFormatRule[] = [
      { condition: 'gt', value: 100, backgroundColor: '#green' },
    ]

    const result = evaluateConditionalFormat(50, rules)
    expect(result).toEqual({})
  })
})

describe('getFormatStyle', () => {
  it('should convert format to CSS style object', () => {
    const style = getFormatStyle({
      backgroundColor: '#fff',
      textColor: '#000',
    })

    expect(style.backgroundColor).toBe('#fff')
    expect(style.color).toBe('#000')
  })

  it('should handle partial format', () => {
    const style = getFormatStyle({
      backgroundColor: '#fff',
    })

    expect(style.backgroundColor).toBe('#fff')
    expect(style.color).toBeUndefined()
  })

  it('should return empty object for no format', () => {
    const style = getFormatStyle({})
    expect(style).toEqual({})
  })
})

describe('FORMAT_PRESETS', () => {
  it('should create traffic light rules', () => {
    const rules = FORMAT_PRESETS.trafficLight(30, 70)

    expect(rules).toHaveLength(3)
    expect(evaluateRule(20, rules[0])).toBe(true) // Low
    expect(evaluateRule(50, rules[1])).toBe(true) // Medium
    expect(evaluateRule(80, rules[2])).toBe(true) // High
  })

  it('should create positive/negative rules', () => {
    const rules = FORMAT_PRESETS.positiveNegative()

    expect(rules).toHaveLength(2)
    expect(evaluateRule(10, rules[0])).toBe(true) // Positive
    expect(evaluateRule(-10, rules[1])).toBe(true) // Negative
  })

  it('should create threshold rules', () => {
    const rulesAboveGood = FORMAT_PRESETS.threshold(50, true)
    const resultAbove = evaluateConditionalFormat(60, rulesAboveGood)
    expect(resultAbove.backgroundColor).toContain('c8e6c9') // Green

    const resultBelow = evaluateConditionalFormat(40, rulesAboveGood)
    expect(resultBelow.backgroundColor).toContain('ffcdd2') // Red
  })

  it('should create progress rules', () => {
    const rules = FORMAT_PRESETS.progress()

    expect(rules).toHaveLength(5)
    const result0 = evaluateConditionalFormat(10, rules)
    const result100 = evaluateConditionalFormat(100, rules)

    expect(result0.backgroundColor).toContain('ffcdd2') // Red for low
    expect(result100.backgroundColor).toBeDefined() // Green for 100%
  })
})

describe('getConditionLabel', () => {
  it('should return correct labels', () => {
    expect(getConditionLabel('gt')).toBe('Greater than')
    expect(getConditionLabel('lt')).toBe('Less than')
    expect(getConditionLabel('eq')).toBe('Equal to')
    expect(getConditionLabel('gte')).toBe('Greater than or equal to')
    expect(getConditionLabel('lte')).toBe('Less than or equal to')
    expect(getConditionLabel('between')).toBe('Between')
  })
})

describe('validateRule', () => {
  it('should validate complete rule', () => {
    const errors = validateRule({
      condition: 'gt',
      value: 50,
      backgroundColor: '#fff',
    })
    expect(errors).toHaveLength(0)
  })

  it('should require condition', () => {
    const errors = validateRule({
      value: 50,
      backgroundColor: '#fff',
    })
    expect(errors).toContain('Condition is required')
  })

  it('should require value', () => {
    const errors = validateRule({
      condition: 'gt',
      backgroundColor: '#fff',
    })
    expect(errors).toContain('Value is required')
  })

  it('should require at least one color', () => {
    const errors = validateRule({
      condition: 'gt',
      value: 50,
    })
    expect(errors).toContain('At least one of backgroundColor or textColor is required')
  })

  it('should validate between range', () => {
    const errorsInvalidRange = validateRule({
      condition: 'between',
      value: [80, 20], // Invalid: min > max
      backgroundColor: '#fff',
    })
    expect(errorsInvalidRange).toContain('Min value must be less than max value')

    const errorsNotArray = validateRule({
      condition: 'between',
      value: 50 as unknown as [number, number],
      backgroundColor: '#fff',
    })
    expect(errorsNotArray).toContain('Between condition requires a range [min, max]')
  })
})
