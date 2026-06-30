import React, { useState } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import styles from './GradientLockCheckbox.module.scss';
import { useLayerContext } from 'utils/context/LayerContext';

interface GradientLockCheckboxProps {
  layerId?: string;
}

export const GradientLockCheckbox: React.FC<GradientLockCheckboxProps> = ({ layerId }) => {
  const [isChecked, setIsChecked] = useState(false);
  const { updateLayerGradientLock } = useLayerContext();

  if (!layerId) {
    return (
      <div className={styles.container}>
        <Checkbox isDisabled className={styles.checkbox}>
          {({ isSelected }) => (
            <>
              <div className={styles.indicator}>
                {isSelected && (
                  <svg viewBox="0 0 18 18">
                    <polyline points="1 9 7 14 17 4" />
                  </svg>
                )}
              </div>
              <Label>Lock gradient to data range</Label>
            </>
          )}
        </Checkbox>
      </div>
    );
  }

  const handleChange = (isSelected: boolean) => {
    setIsChecked(isSelected);
    updateLayerGradientLock(layerId, isSelected);
  };

  return (
    <div className={styles.container}>
      <Checkbox
        isSelected={isChecked}
        onChange={handleChange}
        className={styles.checkbox}
      >
        {({ isSelected }) => (
          <>
            <div className={styles.indicator}>
              {isSelected && (
                <svg viewBox="0 0 18 18">
                  <polyline points="1 9 7 14 17 4" />
                </svg>
              )}
            </div>
            <Label>Lock gradient to data range</Label>
          </>
        )}
      </Checkbox>
    </div>
  );
};
