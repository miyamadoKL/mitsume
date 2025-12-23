import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { History } from './History'
import { useQueryStore } from '@/stores/queryStore'
import { mockQueryHistory } from '@/mocks/handlers'

describe('History page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      history: mockQueryHistory,
      loadHistory: vi.fn().mockResolvedValue(undefined),
      setQuery: vi.fn(),
    } as any)
  })

  it('renders query history list', async () => {
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
    })
    expect(screen.getByText(/SELECT \* FROM invalid/)).toBeInTheDocument()
  })
})
