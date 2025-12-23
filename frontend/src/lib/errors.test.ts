import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('should extract error message from AxiosError with error field', () => {
    const error = new AxiosError('Request failed')
    error.response = {
      data: { error: 'Invalid credentials' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as any,
    }

    expect(getErrorMessage(error)).toBe('Invalid credentials')
  })

  it('should extract message from AxiosError with message field', () => {
    const error = new AxiosError('Request failed')
    error.response = {
      data: { message: 'Resource not found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: {} as any,
    }

    expect(getErrorMessage(error)).toBe('Resource not found')
  })

  it('should fall back to AxiosError message when no response data', () => {
    const error = new AxiosError('Network Error')

    expect(getErrorMessage(error)).toBe('Network Error')
  })

  it('should handle AxiosError with empty response data', () => {
    const error = new AxiosError('Request failed')
    error.response = {
      data: {},
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as any,
    }

    expect(getErrorMessage(error)).toBe('Request failed')
  })

  it('should extract message from standard Error', () => {
    const error = new Error('Something went wrong')

    expect(getErrorMessage(error)).toBe('Something went wrong')
  })

  it('should handle string errors', () => {
    expect(getErrorMessage('Direct error message')).toBe('Direct error message')
  })

  it('should handle unknown error types', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
    expect(getErrorMessage(42)).toBe('An unexpected error occurred')
    expect(getErrorMessage({ foo: 'bar' })).toBe('An unexpected error occurred')
  })
})
