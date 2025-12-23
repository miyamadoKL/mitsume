import { describe, expect, it, vi } from 'vitest'
import { cn, downloadFile, formatDate, formatDuration } from './utils'

describe('utils', () => {
  it('cn merges class names without duplicates', () => {
    const result = cn('px-2', false && 'hidden', ['text-sm'], 'px-2')
    expect(result).toBe('text-sm px-2')
  })

  it('formatDuration formats milliseconds and seconds', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.50s')
  })

  it('formatDate formats ISO date string to ja-JP locale', () => {
    const isoDate = '2024-01-15T10:30:00Z'
    const result = formatDate(isoDate)

    // Check that it returns a non-empty string
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)

    // Check that it contains expected date components (year, month, day)
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/1/)
    expect(result).toMatch(/15/)
  })

  it('formatDate handles different date formats', () => {
    // ISO format with timezone
    expect(formatDate('2023-12-25T00:00:00Z')).toMatch(/2023/)

    // Date only format
    expect(formatDate('2024-06-01')).toMatch(/2024/)
  })

  it('downloadFile creates and clicks anchor then revokes URL', () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const mockUrl = 'blob:mock'
    URL.createObjectURL = vi.fn(() => mockUrl) as any
    URL.revokeObjectURL = vi.fn() as any

    const click = vi.fn()
    const remove = vi.spyOn(document.body, 'removeChild')
    const append = vi.spyOn(document.body, 'appendChild')

    const anchor = document.createElement('a')
    anchor.click = click
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadFile('hello', 'test.txt', 'text/plain')

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(anchor)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl)

    // restore
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })
})
