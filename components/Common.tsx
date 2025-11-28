
import React from 'react';
import { Loader2, X } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading, 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700",
    ghost: "hover:bg-slate-100 text-slate-600",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-6 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' | 'outline'; className?: string }> = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: "bg-slate-100 text-slate-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
    outline: "border border-slate-200 text-slate-600"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- Input ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

// --- Label ---
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className = '', children, ...props }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block text-slate-700 ${className}`} {...props}>
    {children}
  </label>
);

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div className={`relative z-50 w-full ${maxWidth} transform overflow-hidden rounded-lg bg-white shadow-2xl transition-all p-6 m-4`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold leading-6 text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2">
          {children}
        </div>
        {footer && (
          <div className="mt-6 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
