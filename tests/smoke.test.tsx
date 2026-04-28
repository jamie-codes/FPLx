// TEMPORARY — delete in Phase 27 Wave 2
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('jsdom smoke', () => {
  it('can render a JSX element via @testing-library/react', () => {
    render(<div>hello</div>)
    expect(screen.getByText('hello')).toBeTruthy()
  })
})
