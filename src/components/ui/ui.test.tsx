// @vitest-environment jsdom
// UIX-01 Task 2: primitives batch 1 — Chip, Card, Stat, Button, Tabs,
// SectionHeader, EmptyState, Skeleton. Assertions pin the semantic token
// classes (bg-accent-soft etc.), never raw palette values.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Chip } from './Chip'
import { Card } from './Card'
import { Stat } from './Stat'
import { Button } from './Button'
import { Tabs } from './Tabs'
import { SectionHeader } from './SectionHeader'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

describe('Chip', () => {
  it.each([
    ['neutral', 'bg-surface-2'],
    ['accent', 'bg-accent-soft'],
    ['positive', 'bg-positive-soft'],
    ['warning', 'bg-warning-soft'],
    ['negative', 'bg-negative-soft'],
  ] as const)('intent %s renders its semantic class fragment', (intent, cls) => {
    render(<Chip intent={intent}>X</Chip>)
    expect(screen.getByText('X').className).toContain(cls)
  })

  it('defaults to neutral intent', () => {
    render(<Chip>X</Chip>)
    expect(screen.getByText('X').className).toContain('bg-surface-2')
  })

  it('passes title through', () => {
    render(<Chip title="explains the chip">X</Chip>)
    expect(screen.getByText('X')).toHaveAttribute('title', 'explains the chip')
  })

  it('sizes: sm uses text-data, md uses text-body', () => {
    const { rerender } = render(<Chip size="sm">X</Chip>)
    expect(screen.getByText('X').className).toContain('text-data')
    rerender(<Chip size="md">X</Chip>)
    expect(screen.getByText('X').className).toContain('text-body')
  })
})

describe('Card', () => {
  it('renders title, subtitle and action', () => {
    render(
      <Card title="My Title" subtitle="My subtitle" action={<button>Act</button>}>
        body
      </Card>
    )
    expect(screen.getByText('My Title')).toBeTruthy()
    expect(screen.getByText('My subtitle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Act' })).toBeTruthy()
  })

  it('uses surface-1 card chrome', () => {
    const { container } = render(<Card>body</Card>)
    const section = container.querySelector('section')!
    expect(section.className).toContain('bg-surface-1')
    expect(section.className).toContain('border-line')
    expect(section.className).toContain('rounded-lg')
  })

  it('padding none leaves the body without a p- class', () => {
    render(
      <Card padding="none">
        <div data-testid="child">flush</div>
      </Card>
    )
    const body = screen.getByTestId('child').parentElement!
    expect(body.className).not.toMatch(/\bp-/)
  })

  it('padding md applies p-4, sm applies p-3', () => {
    const { rerender } = render(
      <Card padding="md">
        <div data-testid="child">x</div>
      </Card>
    )
    expect(screen.getByTestId('child').parentElement!.className).toContain('p-4')
    rerender(
      <Card padding="sm">
        <div data-testid="child">x</div>
      </Card>
    )
    expect(screen.getByTestId('child').parentElement!.className).toContain('p-3')
  })
})

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="xPts" value="6.42" />)
    expect(screen.getByText('xPts')).toBeTruthy()
    expect(screen.getByText('6.42')).toBeTruthy()
  })

  it('value is a big tabular number', () => {
    render(<Stat label="xPts" value="6.42" />)
    const value = screen.getByText('6.42')
    expect(value.className).toContain('text-h3')
    expect(value.className).toContain('tabular')
    expect(value.className).toContain('text-ink')
  })

  it('intent applies the matching ink colour to the value', () => {
    render(<Stat label="Δ" value="+1.2" intent="positive" />)
    expect(screen.getByText('+1.2').className).toContain('text-positive')
  })

  it('renders optional sub line', () => {
    render(<Stat label="xPts" value="6.42" sub="vs 5.1 last GW" />)
    expect(screen.getByText('vs 5.1 last GW')).toBeTruthy()
  })
})

describe('Button', () => {
  it.each([
    ['primary', 'bg-accent'],
    ['secondary', 'bg-surface-1'],
    ['ghost', 'text-ink-muted'],
    ['danger', 'bg-negative'],
  ] as const)('variant %s renders its class fragment', (variant, cls) => {
    render(<Button variant={variant}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain(cls)
  })

  it('primary/danger use the on-accent ink and token hover fills (AA contrast)', () => {
    const { rerender } = render(<Button variant="primary">Go</Button>)
    let cls = screen.getByRole('button', { name: 'Go' }).className
    expect(cls).toContain('text-on-accent')
    expect(cls).toContain('hover:bg-accent-hover')
    expect(cls).not.toContain('text-white')
    rerender(<Button variant="danger">Go</Button>)
    cls = screen.getByRole('button', { name: 'Go' }).className
    expect(cls).toContain('text-on-accent')
    expect(cls).toContain('hover:bg-negative-hover')
    expect(cls).not.toContain('text-white')
  })

  it('md has the 44px touch target, sm has 32px', () => {
    const { rerender } = render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole('button').className).toContain('min-h-[44px]')
    rerender(
      <Button variant="primary" size="sm">
        Go
      </Button>
    )
    expect(screen.getByRole('button').className).toContain('min-h-[32px]')
  })

  it('disabled blocks onClick', () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Go
      </Button>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires onClick when enabled and renders the icon slot', () => {
    const onClick = vi.fn()
    render(
      <Button variant="secondary" icon={<span data-testid="ic" />} onClick={onClick}>
        Go
      </Button>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ic')).toBeTruthy()
  })
})

describe('Tabs', () => {
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' },
  ]

  it('renders every item inside a tablist', () => {
    render(<Tabs items={items} value="a" onChange={() => {}} />)
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('tabs are links with ?t=<id> hrefs (middle-click / open-in-new-tab works)', () => {
    render(<Tabs items={items} value="a" onChange={() => {}} />)
    const beta = screen.getByRole('tab', { name: 'Beta' })
    expect(beta.tagName).toBe('A')
    expect(beta.getAttribute('href')).toBe('?t=b')
  })

  it('marks the active tab with aria-selected and accent-soft fill', () => {
    render(<Tabs items={items} value="b" onChange={() => {}} />)
    const beta = screen.getByRole('tab', { name: 'Beta' })
    expect(beta).toHaveAttribute('aria-selected', 'true')
    expect(beta.className).toContain('bg-accent-soft')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false')
  })

  it('click fires onChange with the item id', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('ArrowRight moves selection AND DOM focus to the next item', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} value="a" onChange={onChange} />)
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('b')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Beta' }))
  })

  it('ArrowLeft wraps from the first item to the last and focuses it', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} value="a" onChange={onChange} />)
    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('c')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Gamma' }))
  })

  it('Home selects + focuses the first item, End the last', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} value="b" onChange={onChange} />)
    const beta = screen.getByRole('tab', { name: 'Beta' })
    beta.focus()
    fireEvent.keyDown(beta, { key: 'Home' })
    expect(onChange).toHaveBeenCalledWith('a')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Alpha' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Beta' }), { key: 'End' })
    expect(onChange).toHaveBeenCalledWith('c')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Gamma' }))
  })
})

describe('SectionHeader', () => {
  it('renders title, subtitle and action', () => {
    render(
      <SectionHeader title="Research" subtitle="Find your gems" action={<button>All</button>} />
    )
    const title = screen.getByText('Research')
    expect(title.className).toContain('text-h3')
    expect(title.className).toContain('font-semibold')
    expect(screen.getByText('Find your gems').className).toContain('text-ink-muted')
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
  })
})

describe('EmptyState', () => {
  it('renders title, hint and icon slot', () => {
    render(<EmptyState title="No data yet" hint="Check back after the deadline" icon={<span data-testid="ic" />} />)
    expect(screen.getByText('No data yet').className).toContain('text-h4')
    expect(screen.getByText('Check back after the deadline').className).toContain('text-ink-muted')
    expect(screen.getByTestId('ic')).toBeTruthy()
  })

  it('renders without optional props', () => {
    render(<EmptyState title="Off-season" />)
    expect(screen.getByText('Off-season')).toBeTruthy()
  })
})

describe('Skeleton', () => {
  it('renders the shimmer block and merges caller className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('bg-surface-2')
    expect(el.className).toContain('h-4 w-32')
  })
})
