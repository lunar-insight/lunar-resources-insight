import React, { useState } from 'react';
import { Checkbox } from 'components/layout/Checkbox/Checkbox/Checkbox';
import styles from './GradientLockCheckbox.module.scss';
import { useLayerContext } from 'utils/context/LayerContext';

interface GradientLockCheckboxProps {
  layerId?: string;
}

export const GradientLockCheckbox: React.FC<GradientLockCheckboxProps> = ({ layerId }) => {
  const [isChecked, setIsChecked] = useState(false);
  const { updateLayerGradientLock } = useLayerContext();

  const handleChange = (isSelected: boolean) => {
    if (!layerId) return;
    setIsChecked(isSelected);
    updateLayerGradientLock(layerId, isSelected);
  };

  return (
    <div className={styles.container}>
      <Checkbox
        label="Lock gradient to data range"
        isSelected={isChecked}
        onChange={handleChange}
        isDisabled={!layerId}
        className={styles.checkbox}
      />
    </div>
  );
};
