import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useQueryStore } from './queryStore'
import { mockSavedQueries, mockQueryHistory, mockQueryResult } from '../mocks/handlers'
import { queryApi } from '../services/api'

vi.mock('../services/api', () => ({
  queryApi: {
    execute: vi.fn(),
    getSaved: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getHistory: vi.fn(),
  },
}))

describe('queryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryApi.execute).mockResolvedValue(mockQueryResult)
    vi.mocked(queryApi.getSaved).mockResolvedValue(mockSavedQueries)
    vi.mocked(queryApi.getHistory).mockResolvedValue(mockQueryHistory)
    vi.mocked(queryApi.save).mockImplementation(async (name, queryText, description) => ({
      id: `query-${Date.now()}`,
      user_id: 'user-1',
      name,
      description: description ?? null,
      query_text: queryText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    vi.mocked(queryApi.delete).mockResolvedValue(undefined)

    // Reset the store state before each test
    useQueryStore.setState({
      currentQuery: 'SELECT 1 as test',
      result: null,
      isExecuting: false,
      error: null,
      savedQueries: [],
      history: [],
    })
  })

  describe('setQuery', () => {
    it('should update currentQuery', () => {
      const { setQuery } = useQueryStore.getState()

      setQuery('SELECT * FROM users')

      const state = useQueryStore.getState()
      expect(state.currentQuery).toBe('SELECT * FROM users')
    })
  })

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const { executeQuery } = useQueryStore.getState()

      await executeQuery('SELECT 1')

      const state = useQueryStore.getState()
      expect(state.result).toEqual(mockQueryResult)
      expect(state.isExecuting).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set isExecuting to true while executing', async () => {
      const { executeQuery } = useQueryStore.getState()

      const promise = executeQuery('SELECT 1')
      expect(useQueryStore.getState().isExecuting).toBe(true)

      await promise
      expect(useQueryStore.getState().isExecuting).toBe(false)
    })

    it('should handle query error', async () => {
      vi.mocked(queryApi.execute).mockRejectedValueOnce(new Error('Query execution failed'))
      const { executeQuery } = useQueryStore.getState()

      await executeQuery('SELECT error')

      const state = useQueryStore.getState()
      expect(state.result).toBeNull()
      expect(state.isExecuting).toBe(false)
      expect(state.error).toBeTruthy()
    })
  })

  describe('loadSavedQueries', () => {
    it('should load saved queries', async () => {
      const { loadSavedQueries } = useQueryStore.getState()

      await loadSavedQueries()

      const state = useQueryStore.getState()
      expect(state.savedQueries).toEqual(mockSavedQueries)
    })
  })

  describe('saveQuery', () => {
    it('should save current query', async () => {
      useQueryStore.setState({ currentQuery: 'SELECT * FROM products' })
      const { saveQuery } = useQueryStore.getState()

      await saveQuery('My Query', 'Description')

      const state = useQueryStore.getState()
      expect(state.savedQueries.length).toBe(1)
      expect(state.savedQueries[0].name).toBe('My Query')
    })

    it('should prepend new query to savedQueries', async () => {
      useQueryStore.setState({
        currentQuery: 'SELECT * FROM orders',
        savedQueries: mockSavedQueries,
      })
      const { saveQuery } = useQueryStore.getState()

      await saveQuery('New Query')

      const state = useQueryStore.getState()
      expect(state.savedQueries.length).toBe(mockSavedQueries.length + 1)
      expect(state.savedQueries[0].name).toBe('New Query')
    })
  })

  describe('deleteQuery', () => {
    it('should remove query from savedQueries', async () => {
      useQueryStore.setState({ savedQueries: mockSavedQueries })
      const { deleteQuery } = useQueryStore.getState()

      await deleteQuery('query-1')

      const state = useQueryStore.getState()
      expect(state.savedQueries.find((q) => q.id === 'query-1')).toBeUndefined()
      expect(state.savedQueries.length).toBe(mockSavedQueries.length - 1)
    })
  })

  describe('loadHistory', () => {
    it('should load query history', async () => {
      const { loadHistory } = useQueryStore.getState()

      await loadHistory()

      const state = useQueryStore.getState()
      expect(state.history).toEqual(mockQueryHistory)
    })
  })

  describe('clearResult', () => {
    it('should clear result and error', () => {
      useQueryStore.setState({
        result: mockQueryResult,
        error: 'Some error',
      })
      const { clearResult } = useQueryStore.getState()

      clearResult()

      const state = useQueryStore.getState()
      expect(state.result).toBeNull()
      expect(state.error).toBeNull()
    })
  })
})
