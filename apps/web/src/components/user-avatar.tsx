import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function initials(input: string | null | undefined) {
  if (!input) return '?';
  const parts = input.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

interface Props {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function UserAvatar({ src, name, email, size = 'md', className }: Props) {
  const label = name || email || '';
  return (
    <Avatar className={cn(SIZE[size], className)}>
      {src && <AvatarImage src={src} alt={label} />}
      <AvatarFallback>{initials(label)}</AvatarFallback>
    </Avatar>
  );
}
