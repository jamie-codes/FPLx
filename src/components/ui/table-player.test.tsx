// @vitest-environment jsdom
// UIX-01 Task 3: primitives batch 2 — table chrome (TableShell/Th/Td),
// KitIcon, PlayerCell. next/image is mocked to a plain <img> (no repo-wide
// mock exists yet); Next-only props are stripped so jsdom gets clean attrs.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableShell, Th, Td, TABLE_CLS, TR_CLS } from './Table'
import { KitIcon } from './KitIcon'
import { PlayerCell } from './PlayerCell'

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // Strip next/image-only props so React doesn't warn about unknown DOM attrs.
    const { unoptimized: _u, priority: _p, fill: _f, loader: _l, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />
  },
}))

describe('TableShell / Th / Td', () => {
  it('wraps a table with the card-style scroll container', () => {
    const { container } = render(
      <TableShell>
        <table className={TABLE_CLS}>
          <thead>
            <tr>
              <Th>Player</Th>
            </tr>
          </thead>
          <tbody>
            <tr className={TR_CLS}>
              <Td>Haaland</Td>
            </tr>
          </tbody>
        </table>
      </TableShell>
    )
    const shell = container.firstChild as HTMLElement
    expect(shell.className).toContain('overflow-x-auto')
    expect(shell.className).toContain('border-line')
    expect(shell.className).toContain('bg-surface-1')
  })

  it('stickyHeader adds the max-height scroll variant', () => {
    const { container } = render(
      <TableShell stickyHeader>
        <table />
      </TableShell>
    )
    expect((container.firstChild as HTMLElement).className).toContain('max-h-[70vh]')
  })

  it('Th carries header chrome and merges className + th attrs', () => {
    render(
      <table>
        <thead>
          <tr>
            <Th className="text-right" colSpan={2}>
              xPts
            </Th>
          </tr>
        </thead>
      </table>
    )
    const th = screen.getByText('xPts')
    expect(th.tagName).toBe('TH')
    expect(th.className).toContain('text-ink-muted')
    expect(th.className).toContain('border-line')
    expect(th.className).toContain('text-right')
    expect(th).toHaveAttribute('colspan', '2')
  })

  it('Td carries cell padding and merges className', () => {
    render(
      <table>
        <tbody>
          <tr>
            <Td className="text-right">6.4</Td>
          </tr>
        </tbody>
      </table>
    )
    const td = screen.getByText('6.4')
    expect(td.tagName).toBe('TD')
    expect(td.className).toContain('py-1.5')
    expect(td.className).toContain('text-right')
  })
})

describe('KitIcon', () => {
  it('renders the shirt image with explicit dimensions from size', () => {
    const { container } = render(<KitIcon teamCode={43} size={24} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe(
      'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_43-110.webp'
    )
    expect(img.getAttribute('width')).toBe('24')
    expect(img.getAttribute('height')).toBe('32')
  })

  it('renders a size-locked neutral placeholder after the image errors (zero CLS)', () => {
    const { container } = render(<KitIcon teamCode={43} size={24} />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    const placeholder = container.firstChild as HTMLElement
    expect(placeholder).not.toBeNull()
    expect(placeholder.className).toContain('bg-surface-2')
    expect(placeholder.className).toContain('rounded')
    // same box as the image: width=size, height=size*1.33
    expect(placeholder.style.width).toBe('24px')
    expect(placeholder.style.height).toBe('32px')
  })
})

describe('PlayerCell', () => {
  it('renders name and meta line', () => {
    render(
      <PlayerCell code={223094} webName="Haaland" teamCode={43} teamShort="MCI" pos="FWD" price="£14.2" />
    )
    expect(screen.getByText('Haaland')).toBeTruthy()
    expect(screen.getByText('FWD · MCI · £14.2')).toBeTruthy()
  })

  it('renders the photo when code is present', () => {
    const { container } = render(<PlayerCell code={223094} webName="Haaland" />)
    const photo = container.querySelector('img')!
    expect(photo.getAttribute('src')).toBe(
      'https://resources.premierleague.com/premierleague/photos/players/110x140/p223094.png'
    )
  })

  it('falls back to a two-letter initials avatar without code', () => {
    render(<PlayerCell webName="Bruno Fernandes" />)
    expect(screen.getByText('BF')).toBeTruthy()
  })

  it('single-word names get a single initial', () => {
    render(<PlayerCell webName="Haaland" />)
    expect(screen.getByText('H')).toBeTruthy()
  })

  it('photo error swaps to the initials avatar', () => {
    const { container } = render(<PlayerCell code={223094} webName="Bruno Fernandes" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('BF')).toBeTruthy()
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('renders the team badge when teamCode is present', () => {
    const { container } = render(
      <PlayerCell code={223094} webName="Haaland" teamCode={43} teamShort="MCI" />
    )
    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src'))
    expect(srcs).toContain('https://resources.premierleague.com/premierleague/badges/70/t43.png')
  })

  it('badge is optional — no teamCode renders only the photo', () => {
    const { container } = render(<PlayerCell code={223094} webName="Haaland" />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('badge error removes only the badge', () => {
    const { container } = render(
      <PlayerCell code={223094} webName="Haaland" teamCode={43} teamShort="MCI" />
    )
    const badge = Array.from(container.querySelectorAll('img')).find((i) =>
      i.getAttribute('src')!.includes('/badges/')
    )!
    fireEvent.error(badge)
    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src'))
    expect(srcs).toHaveLength(1)
    expect(srcs[0]).toContain('/photos/players/')
  })

  it('omits the meta line when no meta props given', () => {
    const { container } = render(<PlayerCell webName="Haaland" />)
    expect(container.textContent).toBe('HHaaland') // initials + name only
  })
})
