import { describe, expect, it } from 'vitest'
import {
  COLOR_SCHEMES,
  getColorScheme,
  getColorSchemeOptions,
  resolveColors,
  getColorByIndex,
  generateGradientScheme,
  HEATMAP_COLOR_SCHEMES,
  getHeatmapColors,
} from './color-schemes'

describe('COLOR_SCHEMES', () => {
  it('should have all required schemes', () => {
    const requiredSchemes = [
      'default', 'pastel', 'vivid', 'earth', 'ocean',
      'sunset', 'monochrome', 'rainbow', 'business', 'nature',
    ]

    for (const scheme of requiredSchemes) {
      expect(COLOR_SCHEMES).toHaveProperty(scheme)
    }
  })

  it('should have at least 5 colors in each scheme', () => {
    for (const scheme of Object.values(COLOR_SCHEMES)) {
      expect(scheme.colors.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('should have valid color values', () => {
    const colorRegex = /^#[0-9a-fA-F]{6}$/

    for (const scheme of Object.values(COLOR_SCHEMES)) {
      for (const color of scheme.colors) {
        expect(color).toMatch(colorRegex)
      }
    }
  })
})

describe('getColorScheme', () => {
  it('should return correct scheme by name', () => {
    const scheme = getColorScheme('vivid')
    expect(scheme.name).toBe('vivid')
    expect(scheme.label).toBe('Vivid')
  })

  it('should return default for unknown name', () => {
    const scheme = getColorScheme('nonexistent' as any)
    expect(scheme.name).toBe('default')
  })
})

describe('getColorSchemeOptions', () => {
  it('should return all schemes as options', () => {
    const options = getColorSchemeOptions()

    expect(options.length).toBe(Object.keys(COLOR_SCHEMES).length)
    expect(options.every(opt => opt.value && opt.label)).toBe(true)
  })

  it('should have unique values', () => {
    const options = getColorSchemeOptions()
    const values = options.map(opt => opt.value)
    const uniqueValues = new Set(values)

    expect(uniqueValues.size).toBe(values.length)
  })
})

describe('resolveColors', () => {
  it('should return custom colors when provided', () => {
    const customColors = ['#111', '#222', '#333']
    const result = resolveColors('default', customColors)

    expect(result).toEqual(customColors)
  })

  it('should return scheme colors when no custom colors', () => {
    const result = resolveColors('vivid')
    expect(result).toEqual(COLOR_SCHEMES.vivid.colors)
  })

  it('should return default colors when scheme not found', () => {
    const result = resolveColors('nonexistent')
    expect(result).toEqual(COLOR_SCHEMES.default.colors)
  })

  it('should return default colors when both undefined', () => {
    const result = resolveColors()
    expect(result).toEqual(COLOR_SCHEMES.default.colors)
  })

  it('should ignore empty custom colors array', () => {
    const result = resolveColors('vivid', [])
    expect(result).toEqual(COLOR_SCHEMES.vivid.colors)
  })
})

describe('getColorByIndex', () => {
  it('should return correct color by index', () => {
    const result = getColorByIndex(0, 'default')
    expect(result).toBe(COLOR_SCHEMES.default.colors[0])
  })

  it('should wrap around for large indices', () => {
    const colors = COLOR_SCHEMES.default.colors
    const index = colors.length + 2

    const result = getColorByIndex(index, 'default')
    expect(result).toBe(colors[2])
  })

  it('should use custom colors when provided', () => {
    const customColors = ['#aaa', '#bbb', '#ccc']
    const result = getColorByIndex(1, undefined, customColors)

    expect(result).toBe('#bbb')
  })
})

describe('generateGradientScheme', () => {
  it('should generate requested number of colors', () => {
    const result = generateGradientScheme('#4488cc', 5)
    expect(result).toHaveLength(5)
  })

  it('should generate valid hex colors', () => {
    const result = generateGradientScheme('#4488cc', 3)
    const colorRegex = /^#[0-9a-fA-F]{6}$/

    for (const color of result) {
      expect(color).toMatch(colorRegex)
    }
  })

  it('should default to 5 colors', () => {
    const result = generateGradientScheme('#4488cc')
    expect(result).toHaveLength(5)
  })
})

describe('HEATMAP_COLOR_SCHEMES', () => {
  it('should have all required heatmap schemes', () => {
    const requiredSchemes = ['blue', 'green', 'red', 'orange', 'purple', 'diverging']

    for (const scheme of requiredSchemes) {
      expect(HEATMAP_COLOR_SCHEMES).toHaveProperty(scheme)
    }
  })

  it('should have at least 2 colors per scheme', () => {
    for (const colors of Object.values(HEATMAP_COLOR_SCHEMES)) {
      expect(colors.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('getHeatmapColors', () => {
  it('should return correct heatmap colors', () => {
    const result = getHeatmapColors('blue')
    expect(result).toEqual(HEATMAP_COLOR_SCHEMES.blue)
  })

  it('should return blue as default for unknown scheme', () => {
    const result = getHeatmapColors('nonexistent')
    expect(result).toEqual(HEATMAP_COLOR_SCHEMES.blue)
  })

  it('should return diverging scheme with 3 colors', () => {
    const result = getHeatmapColors('diverging')
    expect(result).toHaveLength(3)
  })
})
