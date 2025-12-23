import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { SavedQueries } from './SavedQueries'
import { useQueryStore } from '@/stores/queryStore'
import { mockSavedQueries } from '@/mocks/handlers'

describe('SavedQueries page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      savedQueries: mockSavedQueries,
      loadSavedQueries: vi.fn().mockResolvedValue(undefined),
      setQuery: vi.fn(),
      deleteQuery: vi.fn().mockResolvedValue(undefined),
    } as any)
  })

  it('renders saved queries list', async () => {
    render(
      <MemoryRouter>
        <SavedQueries />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Query 1')).toBeInTheDocument()
    })
    expect(screen.getByText('Test Query 2')).toBeInTheDocument()
  })
})
