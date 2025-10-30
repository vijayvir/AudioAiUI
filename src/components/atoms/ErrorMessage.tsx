import React from 'react';
import Icon from './Icon';
import Button from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  onDismiss,
  variant = 'error',
  className = ''
}) => {
  const variantStyles = {
    error: {
      container: 'bg-red-900/20 border-red-500/50',
      icon: 'text-red-400',
      title: 'text-red-300',
      message: 'text-red-200'
    },
    warning: {
      container: 'bg-yellow-900/20 border-yellow-500/50',
      icon: 'text-yellow-400',
      title: 'text-yellow-300',
      message: 'text-yellow-200'
    },
    info: {
      container: 'bg-blue-900/20 border-blue-500/50',
      icon: 'text-blue-400',
      title: 'text-blue-300',
      message: 'text-blue-200'
    }
  };

  const styles = variantStyles[variant];
  const iconName = variant === 'error' ? 'x' : variant === 'warning' ? 'alert' : 'info';

  return (
    <div 
      className={`rounded-lg border p-4 ${styles.container} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <Icon name={iconName} size={20} aria-hidden={true} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {title}
          </h3>
          <p className={`mt-1 text-sm ${styles.message}`}>
            {message}
          </p>
          
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="text-gray-300 hover:text-white"
                  aria-label="Retry the failed operation"
                >
                  Try again
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-gray-400 hover:text-gray-300"
                  aria-label="Dismiss this error message"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ${styles.icon} hover:opacity-75 transition-opacity`}
            aria-label="Close error message"
          >
            <Icon name="x" size={16} aria-hidden={true} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;