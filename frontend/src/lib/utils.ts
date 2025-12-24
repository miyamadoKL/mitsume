import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDateTime } from './dateUtils'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export formatDateTime as formatDate for backward compatibility
export function formatDate(date: string): string {
  return formatDateTime(date)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate a timestamped filename for exports.
 * @param prefix - Optional prefix for the filename (default: 'query_result')
 * @returns Filename like 'query_result_20240101_120000'
 */
export function generateExportFilename(prefix = 'query_result'): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `${sanitizeFilename(prefix)}_${dateStr}_${timeStr}`
}

/**
 * Remove or replace characters that are invalid in filenames.
 * @param filename - The filename to sanitize
 * @returns Sanitized filename safe for use in file systems
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace invalid chars with underscore
    .replace(/\s+/g, '_') // Replace whitespace with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .slice(0, 200) // Limit length
}
