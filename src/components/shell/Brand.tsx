// §5: shared brand lockup — a volt "Fx" badge (fill + dark ink, both themes)
// beside the "FPLx" wordmark in Inter semibold. Replaces the two duplicated
// Honk-font wordmarks (Sidebar top + TopBar mobile). The Honk font stays
// defined in globals.css; only these two logo usages drop it.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className ?? ''}`}>
      <span className="bg-volt text-on-volt rounded-md px-1.5 py-1 text-body font-bold leading-none">
        Fx
      </span>
      <span className="text-h4 font-semibold text-ink leading-none">FPLx</span>
    </span>
  )
}
