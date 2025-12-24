import { vi, expect, beforeAll, afterAll, afterEach } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'

// Initialize i18n for tests
import '@/i18n'

// Silence noisy React Router v7 future flag warnings in tests
const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return
  }
  originalWarn(...args)
}

// Prevent unexpected navigation attempts from jsdom anchor clicks
if (!vi.isMockFunction(HTMLAnchorElement.prototype.click)) {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  localStorage.clear()
  sessionStorage.clear()
})
afterAll(() => server.close())

// Stub window.location.assign/href to avoid jsdom navigation errors
const originalLocation = window.location
Object.defineProperty(window, 'location', {
  value: {
    ...originalLocation,
    assign: vi.fn(),
    replace: vi.fn(),
  },
})

// Extend Vitest with jest-dom matchers (guard for environments where expect may be undefined)
if (typeof expect !== 'undefined') {
  expect.extend(matchers)
}

export const localStorageData: Record<string, string> = {}

export function setupLocalStorageMock() {
  for (const key of Object.keys(localStorageData)) {
    delete localStorageData[key]
  }

  const mockStorage = {
    getItem: vi.fn((key: string) => localStorageData[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageData[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageData[key]
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(localStorageData)) {
        delete localStorageData[key]
      }
    }),
  }

  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    writable: true,
  })
}
