
import React from 'react';
import { LucideIcon } from 'lucide-react';

// --- Card Components ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ title: string; icon?: LucideIcon; description?: string }> = ({ title, icon: Icon, description }) => (
  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
      <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
    </div>
    {description && <p className="text-sm text-gray-500 ml-7">{description}</p>}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

// --- Form Components ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${className}`}
      {...props}
    />
  </div>
);

// Componente que permite digitar ou selecionar via datalist
interface AutocompleteProps extends InputProps {
  options: string[];
  listId: string;
}

export const AutocompleteInput: React.FC<AutocompleteProps> = ({ label, options, listId, className = '', ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      list={listId}
      autoComplete="off"
      className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${className}`}
      {...props}
    />
    <datalist id={listId}>
      {options.map((opt, idx) => (
        <option key={`${listId}-${idx}`} value={opt} />
      ))}
    </datalist>
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <select
      className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white ${className}`}
      {...props}
    >
      {options.map((opt, idx) => (
        <option key={idx} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const Checkbox: React.FC<InputProps> = ({ label, ...props }) => (
  <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <input
      type="checkbox"
      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
      {...props}
    />
    <label className="text-sm font-medium text-gray-700 cursor-pointer flex-1" onClick={(e) => e.preventDefault()}>
      {label}
    </label>
  </div>
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <textarea
      className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${className}`}
      rows={3}
      {...props}
    />
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
