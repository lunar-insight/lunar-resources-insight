import React, { useState, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from '../../../utils/context/ViewerContext';
import { CheckboxWithInfo } from '../../layout/Checkbox/CheckboxWithInfo/CheckboxWithInfo';
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
        <CheckboxWithInfo
          label="Remove rotation lock at poles"
          isSelected={isConstraintDisabled}
          onChange={handleConstraintToggle}
          infoTooltipText="Learn about rotation lock"
          infoPopoverTitle="Rotation Lock at Poles"
          infoPopoverBody={`Controls camera rotation lock at the lunar poles.\n\nUnchecked: Rotation lock enabled (standard navigation mode).\n\nChecked: Rotation lock removed, allows full camera movement in all directions at polar regions.`}
          infoPlacement="right"
        />
      </div>
    </div>
  );
};

export default ViewerOptionsSection;
