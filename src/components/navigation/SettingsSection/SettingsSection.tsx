import React from 'react';
import { useAppSettings } from 'utils/context/AppSettingsContext';
import { CheckboxWithInfo } from 'components/layout/Checkbox/CheckboxWithInfo/CheckboxWithInfo';
import styles from './SettingsSection.module.scss';

const SettingsSection: React.FC = () => {
  const { reduceMotion, setReduceMotion } = useAppSettings();

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>Accessibility</h3>

      <div className={styles.optionsContainer}>
        <CheckboxWithInfo
          label="Reduce motion"
          isSelected={reduceMotion}
          onChange={setReduceMotion}
          infoTooltipText="Info about reduced motion"
          infoPopoverTitle="Reduce Motion"
          infoPopoverBody={`Replaces moving animations with fades.`}
          infoPlacement="right"
        />
      </div>
    </div>
  );
};

export default SettingsSection;
