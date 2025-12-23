import { AxiosError } from 'axios'

/**
 * Extract a user-friendly error message from various error types.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined
    if (data?.error) return data.error
    if (data?.message) return data.message
    if (error.message) return error.message
    return 'A network error occurred'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}
