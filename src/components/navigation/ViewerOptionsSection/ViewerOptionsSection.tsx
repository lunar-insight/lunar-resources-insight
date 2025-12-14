import React, { useState, useEffect } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import * as Cesium from 'cesium';
import { useViewer } from '../../../utils/context/ViewerContext';
import InfoButton from '../../layout/Button/InfoButton/InfoButton';
import styles from './ViewerOptionsSection.module.scss';

const ViewerOptionsSection: React.FC = () => {
  const { viewer } = useViewer();
  const [isConstraintDisabled, setIsConstraintDisabled] = useState(false);

  // Apply constraint setting to camera
  useEffect(() => {
    if (!viewer) return;

    if (isConstraintDisabled) {
      // Remove constraint - free rotation
      viewer.camera.constrainedAxis = undefined;
    } else {
      // Apply constraint - Cesium default behavior
      viewer.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
    }
  }, [viewer, isConstraintDisabled]);

  const handleConstraintToggle = (checked: boolean) => {
    setIsConstraintDisabled(checked);
  };

  return (
    <div className={styles.section}>
      <div className={styles.info}>
        <h3 className={styles.title}>Camera Settings</h3>
        <p className={styles.description}>
          Configure camera behavior and controls.
        </p>
      </div>

      <div className={styles.optionsContainer}>
        <div className={styles.optionRow}>
          <Checkbox
            isSelected={isConstraintDisabled}
            onChange={handleConstraintToggle}
            className={styles.checkbox}
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
                  Remove rotation lock at poles
                </Label>
              </>
            )}
          </Checkbox>

          <InfoButton
            tooltipText="Learn about rotation lock"
            popoverTitle="Rotation Lock at Poles"
            popoverBody={`Controls camera rotation lock at the lunar poles.\n\nUnchecked: Rotation lock enabled (standard navigation mode).\n\nChecked: Rotation lock removed, allows full camera movement in all directions at polar regions.`}
            placement="right"
            className={styles.infoButton}
          />
        </div>
      </div>
    </div>
  );
};

export default ViewerOptionsSection;
