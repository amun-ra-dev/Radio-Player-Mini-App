
import React from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`ripple active:opacity-80 transition-opacity focus:outline-none focus:ring-0 focus-visible:outline-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
