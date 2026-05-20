import { cn } from '@/lib/utils';

type Status =
  | 'pending_confirmation'
  | 'in_kitchen'
  | 'ready'
  | 'served'
  | 'paid'
  | 'cancelled';

interface Props {
  status: Status | string;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

const STYLE: Record<Status, string> = {
  pending_confirmation: 'bg-status-pending/15 text-status-pending-fg border-status-pending/30',
  in_kitchen: 'bg-status-kitchen/15 text-status-kitchen-fg border-status-kitchen/40',
  ready: 'bg-status-ready/20 text-status-ready-fg border-status-ready/40',
  served: 'bg-status-served/15 text-status-served-fg border-status-served/40',
  paid: 'bg-status-paid/20 text-status-paid-fg border-status-paid/40',
  cancelled: 'bg-status-cancelled/15 text-status-cancelled-fg border-status-cancelled/40',
};

const DOT: Record<Status, string> = {
  pending_confirmation: 'bg-status-pending',
  in_kitchen: 'bg-status-kitchen',
  ready: 'bg-status-ready',
  served: 'bg-status-served',
  paid: 'bg-status-paid',
  cancelled: 'bg-status-cancelled',
};

export function StatusPill({ status, label, size = 'md', className }: Props) {
  const style = STYLE[status as Status] ?? 'bg-muted text-muted-foreground border-border';
  const dot = DOT[status as Status] ?? 'bg-muted-foreground';
  const pulse = status === 'pending_confirmation' || status === 'in_kitchen';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        style,
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          dot,
          pulse && 'animate-pulse',
        )}
      />
      {label}
    </span>
  );
}
