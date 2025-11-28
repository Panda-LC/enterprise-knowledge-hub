import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text,
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} text-primary-600 animate-spin`} />
      {text && (
        <p className="text-sm text-slate-600">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
};

// Skeleton loader for content
export const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
};

// Card skeleton
export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      <SkeletonLoader className="h-6 w-3/4" />
      <SkeletonLoader className="h-4 w-full" />
      <SkeletonLoader className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <SkeletonLoader className="h-8 w-20" />
        <SkeletonLoader className="h-8 w-20" />
      </div>
    </div>
  );
};

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <SkeletonLoader className="h-10 w-10 rounded" />
          <SkeletonLoader className="h-4 flex-1" />
          <SkeletonLoader className="h-4 w-24" />
          <SkeletonLoader className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
};
