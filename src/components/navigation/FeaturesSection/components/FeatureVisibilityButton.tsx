import React from 'react';
import { ToggleButton } from 'react-aria-components';
import styles from './FeatureVisibilityButton.module.scss';

interface FeatureVisibilityButtonProps {
  isVisible: boolean;
  onChange: (visible: boolean) => void;
}

export const FeatureVisibilityButton: React.FC<FeatureVisibilityButtonProps> = ({
  isVisible,
  onChange,
}) => {
  return (
    <ToggleButton
      isSelected={isVisible}
      onChange={onChange}
      aria-label="Feature Visibility"
      className={styles.visibilityButton}
    >
      <span className={`material-symbols-outlined ${styles.icon} ${isVisible ? styles.visible : styles.hidden}`}>
        {isVisible ? 'visibility' : 'visibility_off'}
      </span>
    </ToggleButton>
  );
};
