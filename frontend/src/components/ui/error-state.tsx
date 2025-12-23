import { ReactNode } from 'react';
import { AlertCircle, WifiOff, ServerCrash, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './button';

export type ErrorVariant = 'default' | 'network' | 'server';

interface ErrorStateProps {
  title?: string;
  message?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  isRetrying?: boolean;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

const variantConfig = {
  default: {
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection Error',
    defaultMessage: 'Unable to connect to the server. Please check your internet connection.',
  },
  server: {
    icon: ServerCrash,
    defaultTitle: 'Server Error',
    defaultMessage: 'The server encountered an error. Please try again later.',
  },
};

export function ErrorState({
  title,
  message,
  variant = 'default',
  onRetry,
  isRetrying = false,
  children,
  className = '',
  compact = false,
}: ErrorStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayMessage = message || config.defaultMessage;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 ${className}`}>
        <Icon className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-destructive font-medium truncate">{displayTitle}</p>
          {message && (
            <p className="text-xs text-destructive/80 truncate">{message}</p>
          )}
        </div>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-shrink-0"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <Icon className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{displayTitle}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
        {displayMessage}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-2"
        >
          {isRetrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </>
          )}
        </Button>
      )}
      {children}
    </div>
  );
}

// Helper to detect network errors
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('net::') ||
      message.includes('timeout') ||
      message.includes('econnrefused')
    );
  }
  return false;
}

// Helper to detect server errors (5xx)
export function isServerError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status?: number } };
    const status = axiosError.response?.status;
    return status !== undefined && status >= 500 && status < 600;
  }
  return false;
}

// Helper to get appropriate error variant
export function getErrorVariant(error: unknown): ErrorVariant {
  if (isNetworkError(error)) return 'network';
  if (isServerError(error)) return 'server';
  return 'default';
}
