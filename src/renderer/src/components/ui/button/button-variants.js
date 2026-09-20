import { cva } from 'class-variance-authority'

/**
 * 按钮视觉变体（shadcn-vue / Tailwind 3 路线）。
 * 业务组件通过 Button / IconButton 使用，不直接复制这些类。
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md',
    'font-medium outline-none transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50'
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        sm: 'h-control-sm px-2 text-xs',
        default: 'h-control-md px-3 text-sm',
        lg: 'h-control-lg px-4 text-sm',
        icon: 'h-control-md w-control-md p-0',
        'icon-sm': 'h-control-sm w-control-sm p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
