
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  ...props
}) => {
  const baseStyle = "px-6 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";

  let variantStyle = '';
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400';
      break;
    case 'secondary':
      variantStyle = 'bg-slate-600 hover:bg-slate-700 text-slate-100 focus:ring-slate-500';
      break;
    case 'danger':
      variantStyle = 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400';
      break;
    case 'ghost':
      variantStyle = 'bg-transparent hover:bg-slate-700 text-slate-300 hover:text-slate-100 focus:ring-slate-500 border border-slate-600';
      break;
    default:
      variantStyle = 'bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400';
  }

  return (
    <button
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
