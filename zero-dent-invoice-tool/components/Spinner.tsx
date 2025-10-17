
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string; // Tailwind color class e.g., 'text-brand-primary'
  text?: string;
  textColor?: string; // Tailwind color class for text e.g., 'text-app-textSecondary'
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = 'text-brand-primary', 
  text,
  textColor = 'text-app-textSecondary'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-[6px]',
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`animate-spin rounded-full border-solid border-t-transparent ${sizeClasses[size]} ${color}`}
        style={{ borderColor: 'currentColor transparent currentColor transparent' }} 
      ></div>
      {text && <p className={`mt-2 ${textColor}`}>{text}</p>}
    </div>
  );
};