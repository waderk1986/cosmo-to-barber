import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GetStartedButtonProps {
  children: ReactNode
  href?: string
  className?: string
}

export function GetStartedButton({
  children,
  href,
  className,
}: GetStartedButtonProps) {
  const btnRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null)
  const [hovering, setHovering] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const sharedProps = {
    className: cn(
      'group relative isolate inline-flex items-center gap-3',
      'rounded-full px-8 py-4',
      'text-[0.95rem] font-bold tracking-[0.01em] leading-none',
      'text-white no-underline',
      'cursor-pointer select-none',
      'transition-all duration-300 ease-out',
      'hover:scale-[1.02] active:scale-[0.98]',
      className,
    ),
    style: {
      background: hovering
        ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(0,160,160,1) 0%, rgba(0,128,128,1) 50%, rgba(0,100,100,1) 100%)`
        : 'linear-gradient(135deg, rgba(0,128,128,1) 0%, rgba(0,100,100,1) 100%)',
      boxShadow: hovering
        ? '0 0 0 1px rgba(0,200,200,0.3), 0 4px 24px rgba(0,128,128,0.4), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)'
        : '0 0 0 1px rgba(0,128,128,0.2), 0 2px 12px rgba(0,128,128,0.2), 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
    } as React.CSSProperties,
    onMouseEnter: () => setHovering(true),
    onMouseLeave: () => setHovering(false),
    onMouseMove: handleMouseMove,
  }

  const inner = (
    <>
      {/* Shimmer sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
      >
        <span
          className="absolute inset-0 -translate-x-full transition-transform duration-700 ease-in-out group-hover:translate-x-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.12) 55%, transparent 100%)',
          }}
        />
      </span>

      {/* Subtle top highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
        }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-3">{children}</span>

      {/* Arrow */}
      <span className="relative z-10 transition-transform duration-300 ease-out group-hover:translate-x-0.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </>
  )

  if (href) {
    return (
      <a
        ref={btnRef as React.Ref<HTMLAnchorElement>}
        href={href}
        {...sharedProps}
      >
        {inner}
      </a>
    )
  }

  return (
    <button ref={btnRef as React.Ref<HTMLButtonElement>} {...sharedProps}>
      {inner}
    </button>
  )
}
