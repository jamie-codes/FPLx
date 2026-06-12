'use client'
// UIX-01: table chrome. Wraps hand-rolled tables AND TanStack markup (skin only).
export const TABLE_CLS = 'w-full text-data tabular border-collapse'
export const TH_CLS = 'text-left font-medium text-ink-muted pb-1.5 px-2 border-b border-line whitespace-nowrap'
export const TD_CLS = 'py-1.5 px-2 whitespace-nowrap'
export const TR_CLS = 'even:bg-surface-0 hover:bg-surface-2 transition-colors duration-150'

export function TableShell({ children, stickyHeader = false }: {
  children: React.ReactNode; stickyHeader?: boolean
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-line bg-surface-1 ${stickyHeader ? 'max-h-[70vh] overflow-y-auto' : ''}`}>
      {children}
    </div>
  )
}
export function Th({ children, className = '', ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${TH_CLS} ${className}`} {...rest}>{children}</th>
}
export function Td({ children, className = '', ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`${TD_CLS} ${className}`} {...rest}>{children}</td>
}
