import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { DashboardDetail } from './DashboardDetail'
import { dashboardApi, queryApi } from '@/services/api'
import { mockDashboards, mockSavedQueries, mockWidgets } from '@/mocks/handlers'

vi.mock('@/services/api', () => ({
  dashboardApi: {
    getById: vi.fn(),
    createWidget: vi.fn(),
    deleteWidget: vi.fn(),
    updateWidget: vi.fn(),
  },
  queryApi: {
    getSaved: vi.fn(),
    getSavedById: vi.fn(),
  },
}))

describe('DashboardDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dashboardApi.getById).mockResolvedValue({
      ...mockDashboards[0],
      widgets: mockWidgets,
    })
    vi.mocked(queryApi.getSaved).mockResolvedValue(mockSavedQueries)
    vi.mocked(queryApi.getSavedById).mockImplementation(async (id: string) => {
      const found = mockSavedQueries.find((q) => q.id === id)
      if (!found) throw new Error('not found')
      return found
    })
  })

  it('renders widgets after load', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboards/dashboard-1']}>
        <Routes>
          <Route path="/dashboards/:id" element={<DashboardDetail />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument()
    })
    expect(screen.getByText('Test Widget')).toBeInTheDocument()
  })
})
