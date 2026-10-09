import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      type={type}
    />
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

export function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      {...props}
      className={`ui-badge ui-badge--${tone} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

export function StateMessage({
  children,
  className = '',
  role = 'status',
}: {
  children: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}) {
  return (
    <p className={`ui-state-message ${className}`.trim()} role={role}>
      {children}
    </p>
  );
}
