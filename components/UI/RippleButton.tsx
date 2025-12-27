
import React from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({ children, className = '', ...props }) => {
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Forcefully remove focus from the element to prevent outlines on keyboard events
    e.currentTarget.blur();
    if (props.onPointerDown) props.onPointerDown(e);
  };

  return (
    <button
      {...props}
      onPointerDown={handlePointerDown}
      className={`ripple active:opacity-80 transition-opacity focus:outline-none focus:ring-0 focus-visible:outline-none ${className}`}
    >
      {children}
    </button>
  );
};
