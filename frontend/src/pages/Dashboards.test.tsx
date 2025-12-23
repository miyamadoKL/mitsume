import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboards } from './Dashboards'
import { dashboardApi } from '@/services/api'
import { mockDashboards } from '@/mocks/handlers'

vi.mock('@/services/api', () => ({
  dashboardApi: {
    getAll: vi.fn(),
  },
}))

describe('Dashboards page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dashboardApi.getAll).mockResolvedValue(mockDashboards)
  })

  it('renders dashboard cards', async () => {
    render(
      <MemoryRouter>
        <Dashboards />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument()
    })
    expect(screen.getByText(/New Dashboard/i)).toBeInTheDocument()
  })
})
