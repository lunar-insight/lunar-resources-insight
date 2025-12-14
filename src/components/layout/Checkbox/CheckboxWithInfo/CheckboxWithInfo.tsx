import React, { useState } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import InfoButton from '../../Button/InfoButton/InfoButton';
import styles from './CheckboxWithInfo.module.scss';

interface CheckboxWithInfoProps {
  // Checkbox props
  label: string | React.ReactNode;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;

  // InfoButton props
  infoTooltipText: string;
  infoPopoverTitle: string;
  infoPopoverBody: string;
  infoPlacement?: 'top' | 'bottom' | 'left' | 'right';

  // Styling customization
  className?: string;
  checkboxClassName?: string;
  infoButtonClassName?: string;
}

export const CheckboxWithInfo: React.FC<CheckboxWithInfoProps> = ({
  label,
  isSelected,
  defaultSelected = false,
  onChange,
  isDisabled = false,
  infoTooltipText,
  infoPopoverTitle,
  infoPopoverBody,
  infoPlacement = 'right',
  className = '',
  checkboxClassName = '',
  infoButtonClassName = ''
}) => {
  // Internal state for uncontrolled mode
  const [internalSelected, setInternalSelected] = useState(defaultSelected);

  // Determine if controlled or uncontrolled
  const isControlled = isSelected !== undefined;
  const checked = isControlled ? isSelected : internalSelected;

  const handleChange = (newSelected: boolean) => {
    if (!isControlled) {
      setInternalSelected(newSelected);
    }
    onChange?.(newSelected);
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <Checkbox
        isSelected={checked}
        onChange={handleChange}
        isDisabled={isDisabled}
        className={`${styles.checkbox} ${checkboxClassName}`}
      >
        {({ isSelected }) => (
          <>
            <div className={styles.checkboxIndicator}>
              {isSelected && (
                <svg viewBox="0 0 18 18" className={styles.checkboxIcon}>
                  <polyline points="1 9 7 14 17 4" />
                </svg>
              )}
            </div>
            <Label className={styles.checkboxLabel}>
              {label}
            </Label>
          </>
        )}
      </Checkbox>

      <InfoButton
        tooltipText={infoTooltipText}
        popoverTitle={infoPopoverTitle}
        popoverBody={infoPopoverBody}
        placement={infoPlacement}
        className={`${styles.infoButton} ${infoButtonClassName}`}
      />
    </div>
  );
};
