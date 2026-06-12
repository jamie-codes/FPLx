'use client'
// UIX-01 primitive: the app's button. md hits the 44px touch target.
// primary/danger ink is the on-accent token (white in light, near-black in
// dark — dark accent/negative fills are light, so white ink failed AA) and
// hover is a dedicated darker/lighter token, not an alpha fade.
const VARIANT_CLS = {
  primary:   'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface-1 border border-line text-ink hover:bg-surface-2',
  ghost:     'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger:    'bg-negative text-on-accent hover:bg-negative-hover',
} as const

export type ButtonVariant = keyof typeof VARIANT_CLS

export function Button({
  variant,
  size = 'md',
  icon,
  className = '',
  type = 'button',
  children,
  ...rest
}: {
  variant: ButtonVariant
  size?: 'sm' | 'md'
  icon?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeCls =
    size === 'md' ? 'min-h-[44px] px-4 text-body' : 'min-h-[32px] px-3 text-data'
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLS[variant]} ${sizeCls} ${className}`}
      {...rest}>
      {icon != null && (
        <span aria-hidden className="shrink-0 inline-flex items-center">
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}
