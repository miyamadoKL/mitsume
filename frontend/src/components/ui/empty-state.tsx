import { ReactNode } from 'react';
import { LucideIcon, FileQuestion, Database, Search, Inbox } from 'lucide-react';
import { Button } from './button';

export type EmptyStateVariant = 'default' | 'search' | 'data' | 'inbox';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: EmptyStateVariant;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  data: Database,
  inbox: Inbox,
};

export function EmptyState({
  title,
  description,
  icon,
  variant = 'default',
  action,
  children,
  className = '',
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
