
import React from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      className={`ripple active:opacity-80 transition-opacity focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
