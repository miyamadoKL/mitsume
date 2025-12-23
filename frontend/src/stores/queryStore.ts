import { AxiosError } from 'axios'
import { create } from 'zustand'
import type { QueryResult, SavedQuery, QueryHistory } from '@/types'
import { queryApi } from '@/services/api'

interface QueryState {
  currentQuery: string
  result: QueryResult | null
  isExecuting: boolean
  error: string | null
  savedQueries: SavedQuery[]
  history: QueryHistory[]
  setQuery: (query: string) => void
  executeQuery: (query: string) => Promise<void>
  loadSavedQueries: () => Promise<void>
  saveQuery: (name: string, description?: string) => Promise<void>
  deleteQuery: (id: string) => Promise<void>
  loadHistory: () => Promise<void>
  clearResult: () => void
}

export const useQueryStore = create<QueryState>((set, get) => ({
  currentQuery: 'SELECT 1 as test',
  result: null,
  isExecuting: false,
  error: null,
  savedQueries: [],
  history: [],

  setQuery: (query: string) => {
    set({ currentQuery: query })
  },

  executeQuery: async (query: string) => {
    set({ isExecuting: true, error: null })
    try {
      const result = await queryApi.execute(query)
      set({ result, isExecuting: false })
    } catch (err) {
      let message = 'Query execution failed'
      if (err instanceof AxiosError) {
        const data = err.response?.data as { error?: string }
        message = data?.error || err.message
      } else if (err instanceof Error) {
        message = err.message
      }
      set({ error: message, isExecuting: false })
    }
  },

  loadSavedQueries: async () => {
    try {
      const savedQueries = await queryApi.getSaved()
      set({ savedQueries })
    } catch (err) {
      console.error('Failed to load saved queries:', err)
    }
  },

  saveQuery: async (name: string, description?: string) => {
    const { currentQuery } = get()
    try {
      const saved = await queryApi.save(name, currentQuery, description)
      set((state) => ({ savedQueries: [saved, ...state.savedQueries] }))
    } catch (err) {
      console.error('Failed to save query:', err)
      throw err
    }
  },

  deleteQuery: async (id: string) => {
    try {
      await queryApi.delete(id)
      set((state) => ({
        savedQueries: state.savedQueries.filter((q) => q.id !== id),
      }))
    } catch (err) {
      console.error('Failed to delete query:', err)
      throw err
    }
  },

  loadHistory: async () => {
    try {
      const history = await queryApi.getHistory()
      set({ history })
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  },

  clearResult: () => {
    set({ result: null, error: null })
  },
}))
