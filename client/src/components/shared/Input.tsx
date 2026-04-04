import { type InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={`${styles.field} ${error ? styles.hasError : ''} ${className}`}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {rest.required && <span className={styles.required}>*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          {...rest}
        />
        {hint && !error && <p className={styles.hint}>{hint}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
