import React, { forwardRef, InputHTMLAttributes } from 'react';
import { FieldError } from 'react-hook-form';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
  id: string;
  description?: string;
  required?: boolean;
}

/**
 * Premium form input component with elegant light theme styling
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, id, description, required, className = '', ...props }, ref) => {
    return (
      <div className="mb-1">
        <label 
          htmlFor={id} 
          className="block text-sm font-medium mb-2 text-gray-700"
        >
          {label}
          {required && <span className="text-amber-600 ml-1" aria-hidden="true">*</span>}
        </label>
        
        {description && (
          <p className="text-gray-500 text-xs mb-2">{description}</p>
        )}
        
        <input
          ref={ref}
          id={id}
          className={`
            w-full px-4 py-3 
            bg-white 
            border border-gray-200 
            rounded-lg
            text-gray-800
            placeholder-gray-400
            transition-all duration-200
            hover:border-gray-300
            focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-required={required}
          {...props}
        />
        
        {error && (
          <p 
            id={`${id}-error`} 
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: FieldError;
  id: string;
  options: { value: string; label: string }[];
  description?: string;
  required?: boolean;
}

/**
 * Premium form select component with elegant light theme styling
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, id, options, description, required, className = '', ...props }, ref) => {
    return (
      <div className="mb-1">
        <label 
          htmlFor={id} 
          className="block text-sm font-medium mb-2 text-gray-700"
        >
          {label}
          {required && <span className="text-amber-600 ml-1" aria-hidden="true">*</span>}
        </label>
        
        {description && (
          <p className="text-gray-500 text-xs mb-2">{description}</p>
        )}
        
        <select
          ref={ref}
          id={id}
          className={`
            w-full px-4 py-3 
            bg-white 
            border border-gray-200 
            rounded-lg
            text-gray-800
            transition-all duration-200
            hover:border-gray-300
            focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500
            cursor-pointer
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-required={required}
          {...props}
        >
          <option value="" className="text-gray-400">Select...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {error && (
          <p 
            id={`${id}-error`} 
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {error.message}
          </p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';
