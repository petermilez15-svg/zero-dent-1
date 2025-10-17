
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseStyles = "font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-app-background transition-colors duration-150 ease-in-out inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed tracking-wide";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  // Updated variant styles for the "Vibrant Lime & Deep Charcoal" theme
  const variantStyles = {
    primary: "bg-brand-primary text-textOnBrandPrimary hover:bg-brand-primaryDarker focus:ring-brand-primary",
    secondary: "bg-app-surface text-app-textPrimary hover:bg-neutral-700 focus:ring-neutral-600 border border-app-border", // hover:bg-gray-700 changed to neutral-700, focus:ring-gray-600 to neutral-600
    danger: "bg-danger text-white hover:bg-danger-hover focus:ring-red-700",
    outline: "bg-transparent text-brand-primary border border-brand-primary hover:bg-brand-primary hover:text-textOnBrandPrimary focus:ring-brand-primary"
  };

  return (
    <button
      type="button"
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};