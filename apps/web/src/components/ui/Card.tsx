import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'elevated' | 'glass';
  className?: string;
  noPadding?: boolean;
}

export default function Card({
  children,
  variant = 'default',
  className = '',
  noPadding = false,
  ...props
}: CardProps) {
  const variantStyles = {
    default: 'bg-white border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] hover:border-slate-300/80',
    subtle: 'bg-slate-50/70 border border-slate-200/60',
    elevated: 'bg-white border border-slate-200 shadow-md shadow-slate-200/50',
    glass: 'bg-white/80 backdrop-blur-md border border-white/60 shadow-sm',
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${variantStyles[variant]} ${
        noPadding ? '' : 'p-5 sm:p-6'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
