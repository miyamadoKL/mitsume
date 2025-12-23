import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest'
import api, { authApi } from './api'

const okResponse = (config: any) => ({
  data: {},
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

const unauthorizedError = (config: any) => {
  const error: any = new Error('Unauthorized')
  error.response = { status: 401, data: {}, config }
  error.config = config
  error.isAxiosError = true
  error.toJSON = () => ({})
  return error
}

describe('api service', () => {
  const token = 'mock-token'
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    api.defaults.adapter = vi.fn(async (config) => {
      if ((config as any).mockStatus === 401) {
        throw unauthorizedError(config)
      }
      return okResponse(config)
    })
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn(() => token),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '', assign: vi.fn() },
      writable: true,
    })
  })

  it('adds Authorization header when token exists', async () => {
    await authApi.me()
    const adapterMock = api.defaults.adapter as unknown as MockInstance
    expect(adapterMock).toHaveBeenCalled()
    const calledConfig = adapterMock.mock.calls.at(-1)?.[0] as any
    expect(calledConfig.headers?.Authorization).toBe(`Bearer ${token}`)
  })

  it('removes token and redirects on 401', async () => {
    api.defaults.adapter = async (config) => {
      throw unauthorizedError(config)
    }

    await expect(authApi.me()).rejects.toThrow()

    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
    // front-end redirect to /login is triggered by location.href assign
    expect((window.location as any).href).toBe('/login')
  })
})
