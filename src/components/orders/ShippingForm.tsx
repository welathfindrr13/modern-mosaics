'use client';

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  shippingAddressSchema, 
  ShippingAddress, 
  countryOptions, 
  usStateOptions, 
  canadianProvinceOptions 
} from '@/schemas/shipping';
import { GelatoAddress } from '@/lib/gelato';

interface ShippingFormProps {
  defaultValues?: Partial<ShippingAddress>;
  onChange?: (data: GelatoAddress) => void;
  onValidChange?: (isValid: boolean) => void;
  onCountryChange?: (country: string) => void; // Early country change callback (before form is valid)
  initialCountry?: string; // Initial country from parent (auto-detected)
  className?: string;
}

// Map browser locale to country code
function getCountryFromLocale(): string {
  if (typeof navigator === 'undefined') return 'GB';
  
  const locale = navigator.language || 'en-GB';
  const parts = locale.split('-');
  const countryCode = parts[1]?.toUpperCase() || 'GB';
  
  // Check if country is in our list
  const validCountries = countryOptions.map(c => c.value);
  return validCountries.includes(countryCode) ? countryCode : 'GB';
}

/**
 * Premium shipping address form with dark theme styling
 * Uses initialCountry from parent (which auto-detects from locale)
 */
export default function ShippingForm({
  defaultValues,
  onChange,
  onValidChange,
  onCountryChange,
  initialCountry,
  className = '',
}: ShippingFormProps) {
  // Use parent-provided initialCountry, or detect locally as fallback
  const [detectedCountry, setDetectedCountry] = useState(initialCountry || 'GB');
  
  // Update from parent's initialCountry if provided
  useEffect(() => {
    if (initialCountry) {
      setDetectedCountry(initialCountry);
    }
  }, [initialCountry]);
  
  // Fallback: detect country on mount if no initialCountry
  useEffect(() => {
    if (!initialCountry) {
      const country = getCountryFromLocale();
      setDetectedCountry(country);
    }
  }, [initialCountry]);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid, isDirty }, 
    control,
    watch,
    getValues,
    setValue
  } = useForm<ShippingAddress>({
    resolver: zodResolver(shippingAddressSchema),
    mode: 'onChange',
    defaultValues: {
      country: defaultValues?.country || detectedCountry,
      ...defaultValues
    }
  });
  
  // Update country when detected
  useEffect(() => {
    if (!defaultValues?.country) {
      setValue('country', detectedCountry);
    }
  }, [detectedCountry, setValue, defaultValues?.country]);

  const country = watch('country');
  
  // Notify parent of country changes immediately (for early pricing)
  useEffect(() => {
    if (country && onCountryChange) {
      onCountryChange(country);
    }
  }, [country, onCountryChange]);

  const onSubmit = (data: ShippingAddress) => {
    if (onChange) {
      onChange(data as GelatoAddress);
    }
  };

  useEffect(() => {
    if (isDirty && isValid) {
      const currentValues = getValues();
      onChange?.(currentValues as GelatoAddress);
    }
    onValidChange?.(isValid);
  }, [isValid, isDirty, getValues, onChange, onValidChange]);
  
  const getStateOptions = () => {
    switch (country) {
      case 'US':
        return usStateOptions;
      case 'CA':
        return canadianProvinceOptions;
      default:
        return [];
    }
  };
  
  const isStateRequired = country === 'US' || country === 'CA';
  
  useEffect(() => {
    if (country !== 'US' && country !== 'CA') {
      setValue('state', '');
    }
  }, [country, setValue]);

  // Input styling for dark theme
  const inputClass = `
    w-full px-4 py-3 
    bg-dark-800/50 
    border border-white/10 
    rounded-xl
    text-white
    placeholder-dark-500
    transition-all duration-200
    hover:border-white/20
    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
  `;

  const labelClass = "block text-sm font-medium mb-2 text-dark-300";
  const errorClass = "mt-2 text-sm text-red-400";

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className={`space-y-5 ${className}`}
      aria-live="polite"
    >
      {/* Name Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            First Name <span className="text-brand-400">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            className={`${inputClass} ${errors.firstName ? 'border-red-500/50 focus:border-red-500' : ''}`}
            placeholder="John"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className={errorClass}>{errors.firstName.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Last Name <span className="text-brand-400">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            className={`${inputClass} ${errors.lastName ? 'border-red-500/50 focus:border-red-500' : ''}`}
            placeholder="Smith"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p className={errorClass}>{errors.lastName.message}</p>
          )}
        </div>
      </div>
      
      {/* Address Group */}
      <div>
        <label htmlFor="line1" className={labelClass}>
          Address <span className="text-brand-400">*</span>
        </label>
        <input
          id="line1"
          type="text"
          className={`${inputClass} ${errors.line1 ? 'border-red-500/50 focus:border-red-500' : ''}`}
          placeholder="123 Main Street"
          {...register('line1')}
        />
        {errors.line1 && (
          <p className={errorClass}>{errors.line1.message}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="line2" className={labelClass}>
          Address Line 2 <span className="text-dark-500">(optional)</span>
        </label>
        <input
          id="line2"
          type="text"
          className={inputClass}
          placeholder="Apartment, suite, floor, etc."
          {...register('line2')}
        />
      </div>
      
      {/* City & Country */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className={labelClass}>
            City <span className="text-brand-400">*</span>
          </label>
          <input
            id="city"
            type="text"
            className={`${inputClass} ${errors.city ? 'border-red-500/50 focus:border-red-500' : ''}`}
            placeholder="London"
            {...register('city')}
          />
          {errors.city && (
            <p className={errorClass}>{errors.city.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="country" className={labelClass}>
            Country <span className="text-brand-400">*</span>
          </label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <select
                id="country"
                className={`${inputClass} cursor-pointer ${errors.country ? 'border-red-500/50 focus:border-red-500' : ''}`}
                {...field}
              >
                {countryOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-dark-800 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.country && (
            <p className={errorClass}>{errors.country.message}</p>
          )}
        </div>
      </div>
      
      {/* State/Province & Postal Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(country === 'US' || country === 'CA') && (
          <div>
            <label htmlFor="state" className={labelClass}>
              {country === 'US' ? 'State' : 'Province'} <span className="text-brand-400">*</span>
            </label>
            <Controller
              name="state"
              control={control}
              rules={{ required: isStateRequired }}
              render={({ field }) => (
                <select
                  id="state"
                  className={`${inputClass} cursor-pointer ${errors.state ? 'border-red-500/50 focus:border-red-500' : ''}`}
                  {...field}
                >
                  <option value="" className="bg-dark-800 text-dark-500">Select...</option>
                  {getStateOptions().map((option) => (
                    <option key={option.value} value={option.value} className="bg-dark-800 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.state && (
              <p className={errorClass}>{errors.state.message}</p>
            )}
          </div>
        )}
        
        <div className={country !== 'US' && country !== 'CA' ? 'md:col-span-2' : ''}>
          <label htmlFor="postalCode" className={labelClass}>
            {country === 'US' ? 'ZIP Code' : 'Postcode'} <span className="text-brand-400">*</span>
          </label>
          <input
            id="postalCode"
            type="text"
            className={`${inputClass} ${errors.postalCode ? 'border-red-500/50 focus:border-red-500' : ''}`}
            placeholder={country === 'US' ? '10001' : country === 'GB' ? 'SW1A 1AA' : 'A1A 1A1'}
            {...register('postalCode')}
          />
          {errors.postalCode && (
            <p className={errorClass}>{errors.postalCode.message}</p>
          )}
        </div>
      </div>
      
      {/* Contact Info */}
      <div className="pt-4 border-t border-white/10">
        <p className="text-sm text-dark-400 mb-4">
          Contact details for delivery updates
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email <span className="text-dark-500">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              className={`${inputClass} ${errors.email ? 'border-red-500/50 focus:border-red-500' : ''}`}
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className={errorClass}>{errors.email.message}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone <span className="text-dark-500">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              className={`${inputClass} ${errors.phone ? 'border-red-500/50 focus:border-red-500' : ''}`}
              placeholder="+44 20 1234 5678"
              {...register('phone')}
            />
            {errors.phone && (
              <p className={errorClass}>{errors.phone.message}</p>
            )}
          </div>
        </div>
      </div>
      
      <button type="submit" className="sr-only" aria-hidden="true">
        Submit
      </button>
    </form>
  );
}
