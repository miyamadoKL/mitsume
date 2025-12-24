/**
 * Color scheme definitions for charts
 * Each scheme is an array of colors used for series/categories
 */

export type ColorSchemeName =
  | 'default'
  | 'pastel'
  | 'vivid'
  | 'earth'
  | 'ocean'
  | 'sunset'
  | 'monochrome'
  | 'rainbow'
  | 'business'
  | 'nature'

export interface ColorScheme {
  name: ColorSchemeName
  label: string
  colors: string[]
  description?: string
}

/**
 * All available color schemes
 */
export const COLOR_SCHEMES: Record<ColorSchemeName, ColorScheme> = {
  default: {
    name: 'default',
    label: 'Default',
    description: 'Standard ECharts color palette',
    colors: [
      '#5470c6', '#91cc75', '#fac858', '#ee6666',
      '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
      '#ea7ccc',
    ],
  },

  pastel: {
    name: 'pastel',
    label: 'Pastel',
    description: 'Soft, muted colors',
    colors: [
      '#b3e5fc', '#c8e6c9', '#fff9c4', '#ffcdd2',
      '#e1bee7', '#ffe0b2', '#d7ccc8', '#cfd8dc',
      '#f0f4c3',
    ],
  },

  vivid: {
    name: 'vivid',
    label: 'Vivid',
    description: 'Bright, saturated colors',
    colors: [
      '#1976d2', '#388e3c', '#fbc02d', '#d32f2f',
      '#7b1fa2', '#f57c00', '#00796b', '#512da8',
      '#c2185b',
    ],
  },

  earth: {
    name: 'earth',
    label: 'Earth',
    description: 'Natural, earthy tones',
    colors: [
      '#8d6e63', '#a1887f', '#bcaaa4', '#795548',
      '#6d4c41', '#5d4037', '#4e342e', '#3e2723',
      '#d7ccc8',
    ],
  },

  ocean: {
    name: 'ocean',
    label: 'Ocean',
    description: 'Blue and teal shades',
    colors: [
      '#0288d1', '#03a9f4', '#4fc3f7', '#00acc1',
      '#26c6da', '#4dd0e1', '#80deea', '#00838f',
      '#006064',
    ],
  },

  sunset: {
    name: 'sunset',
    label: 'Sunset',
    description: 'Warm orange and red tones',
    colors: [
      '#ff7043', '#ff5722', '#f4511e', '#e64a19',
      '#ffab91', '#ff8a65', '#ff7043', '#bf360c',
      '#ffd180',
    ],
  },

  monochrome: {
    name: 'monochrome',
    label: 'Monochrome',
    description: 'Shades of gray',
    colors: [
      '#212121', '#424242', '#616161', '#757575',
      '#9e9e9e', '#bdbdbd', '#e0e0e0', '#eeeeee',
      '#f5f5f5',
    ],
  },

  rainbow: {
    name: 'rainbow',
    label: 'Rainbow',
    description: 'Full spectrum colors',
    colors: [
      '#f44336', '#ff9800', '#ffeb3b', '#4caf50',
      '#2196f3', '#3f51b5', '#9c27b0', '#e91e63',
      '#00bcd4',
    ],
  },

  business: {
    name: 'business',
    label: 'Business',
    description: 'Professional, corporate colors',
    colors: [
      '#1a237e', '#283593', '#303f9f', '#3949ab',
      '#3f51b5', '#5c6bc0', '#7986cb', '#9fa8da',
      '#c5cae9',
    ],
  },

  nature: {
    name: 'nature',
    label: 'Nature',
    description: 'Green and natural tones',
    colors: [
      '#1b5e20', '#2e7d32', '#388e3c', '#43a047',
      '#4caf50', '#66bb6a', '#81c784', '#a5d6a7',
      '#c8e6c9',
    ],
  },
}

/**
 * Get a color scheme by name
 */
export function getColorScheme(name: ColorSchemeName): ColorScheme {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.default
}

/**
 * Get all available color scheme options for UI dropdowns
 */
export function getColorSchemeOptions(): { value: ColorSchemeName; label: string }[] {
  return Object.values(COLOR_SCHEMES).map(scheme => ({
    value: scheme.name,
    label: scheme.label,
  }))
}

/**
 * Get colors array from scheme name, or use custom colors
 */
export function resolveColors(
  schemeName?: string,
  customColors?: string[]
): string[] {
  if (customColors && customColors.length > 0) {
    return customColors
  }

  if (schemeName && schemeName in COLOR_SCHEMES) {
    return COLOR_SCHEMES[schemeName as ColorSchemeName].colors
  }

  return COLOR_SCHEMES.default.colors
}

/**
 * Get a single color from a scheme by index (wraps around)
 */
export function getColorByIndex(
  index: number,
  schemeName?: ColorSchemeName,
  customColors?: string[]
): string {
  const colors = resolveColors(schemeName, customColors)
  return colors[index % colors.length]
}

/**
 * Generate a gradient color scheme from a base color
 */
export function generateGradientScheme(
  baseColor: string,
  count: number = 5
): string[] {
  // Simple implementation - adjust lightness
  // In production, you'd want a proper color manipulation library
  const colors: string[] = []

  for (let i = 0; i < count; i++) {
    const factor = 0.5 + (i / count) * 0.5
    colors.push(adjustBrightness(baseColor, factor))
  }

  return colors
}

/**
 * Adjust brightness of a hex color
 */
function adjustBrightness(hex: string, factor: number): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Parse RGB
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  // Adjust brightness
  const adjust = (c: number) => Math.min(255, Math.round(c * factor))

  // Convert back to hex
  const toHex = (c: number) => c.toString(16).padStart(2, '0')

  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`
}

/**
 * Heatmap color schemes
 */
export const HEATMAP_COLOR_SCHEMES = {
  blue: ['#e3f2fd', '#1976d2'],
  green: ['#e8f5e9', '#2e7d32'],
  red: ['#ffebee', '#c62828'],
  orange: ['#fff3e0', '#e65100'],
  purple: ['#f3e5f5', '#7b1fa2'],
  diverging: ['#d32f2f', '#fff9c4', '#388e3c'], // Red-Yellow-Green
}

/**
 * Get heatmap colors by scheme name
 */
export function getHeatmapColors(scheme: string): string[] {
  return HEATMAP_COLOR_SCHEMES[scheme as keyof typeof HEATMAP_COLOR_SCHEMES]
    || HEATMAP_COLOR_SCHEMES.blue
}
