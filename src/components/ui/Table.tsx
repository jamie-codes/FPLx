'use client'
// UIX-01: table chrome. Wraps hand-rolled tables AND TanStack markup (skin only).
//
// UIX-03 sticky-first-column contract (ports GemTable's load-bearing mechanics).
// z-tier stack (documented; spec is binding):
//   sticky td (z-10) < header cells (z-20) < sticky th (z-30) < floating hover cards (z-50)
// - Sticky cells use the OPAQUE surface-1 token bg — content scrolls beneath them.
//   Zebra rows: the sticky cell keeps bg-surface-1 (accepting the zebra seam
//   GemTable already has today).
// - `TableShell stickyFirstCol` is documentation-level only (the wrapper stays
//   `overflow-x-auto` exactly as before — hover cards inside the scroll container
//   must keep working); the mechanics live on the cells via `sticky`.
// - When a table uses BOTH stickyHeader and sticky cells, NON-sticky header
//   cells need z-20 so they layer above sticky td's: pass className="z-20" at
//   the call site (e.g. <Th className="z-20">…</Th>).
export const TABLE_CLS = 'w-full text-data tabular border-collapse'
export const TH_CLS = 'text-left font-medium text-ink-muted pb-1.5 px-2 border-b border-line whitespace-nowrap'
export const TD_CLS = 'py-1.5 px-2 whitespace-nowrap'
export const TR_CLS = 'even:bg-surface-0 hover:bg-surface-2 transition-colors duration-150'

const STICKY_TH_CLS = 'sticky left-0 z-30 bg-surface-1'
const STICKY_TD_CLS = 'sticky left-0 z-10 bg-surface-1'

export function TableShell({ children, stickyHeader = false, stickyFirstCol: _stickyFirstCol = false }: {
  children: React.ReactNode; stickyHeader?: boolean
  /** Documents that this table's first column is sticky (see contract above).
   *  No wrapper-level effect — set `sticky` on the first column's Th/Td. */
  stickyFirstCol?: boolean
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-line bg-surface-1 ${stickyHeader ? 'max-h-[70vh] overflow-y-auto' : ''}`}>
      {children}
    </div>
  )
}
export function Th({ children, className = '', sticky = false, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement> & { sticky?: boolean }) {
  return <th className={`${TH_CLS} ${sticky ? `${STICKY_TH_CLS} ` : ''}${className}`} {...rest}>{children}</th>
}
export function Td({ children, className = '', sticky = false, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement> & { sticky?: boolean }) {
  return <td className={`${TD_CLS} ${sticky ? `${STICKY_TD_CLS} ` : ''}${className}`} {...rest}>{children}</td>
}
