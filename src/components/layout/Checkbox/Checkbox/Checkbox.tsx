import React from 'react';
import {
  Checkbox as AriaCheckbox,
  CheckboxProps as AriaCheckboxProps,
} from 'react-aria-components';
import styles from './Checkbox.module.scss';

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'children' | 'className'> {
  label?: React.ReactNode;
  /** `md` matches the 1.75rem icon buttons, `sm` (1.5rem) sits next to a label. Defaults to `sm` when a label is given. */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * Checkbox styled like the icon buttons. Only the check shows the state, faint when
 * unticked and full when ticked; a highlighted frame is reserved for toggle buttons.
 * Without a label, pass `aria-label`.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  size = label !== undefined ? 'sm' : 'md',
  className = '',
  ...props
}) => {
  return (
    <AriaCheckbox
      {...props}
      className={`${styles.checkbox} ${styles[size]} ${className}`}
    >
      <span className={styles.box}>
        <svg viewBox="0 0 18 18" className={styles.check} aria-hidden="true">
          <polyline points="1 9 7 14 17 4" />
        </svg>
      </span>
      {label !== undefined && <span className={styles.label}>{label}</span>}
    </AriaCheckbox>
  );
};
