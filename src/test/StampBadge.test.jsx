import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StampBadge from '../components/StampBadge'

describe('StampBadge', () => {
  it('renders PENDING text for Pending status', () => {
    render(<StampBadge status="Pending" />)
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('renders RELEASED text for Released status', () => {
    render(<StampBadge status="Released" />)
    expect(screen.getByText('RELEASED')).toBeInTheDocument()
  })

  it('falls back to Pending style for unknown status', () => {
    render(<StampBadge status="SomethingWeird" />)
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })
})
