import React, { useState, useEffect } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from 'utils/context/ViewerContext';
import { CheckboxWithInfo } from 'components/layout/Checkbox/CheckboxWithInfo/CheckboxWithInfo';
import styles from './ViewerOptionsSection.module.scss';

const ViewerOptionsSection: React.FC = () => {
  const { viewer } = useViewer();
  const [isConstraintDisabled, setIsConstraintDisabled] = useState(false);
  const [showLunarNomenclature, setShowLunarNomenclature] = useState(false);

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

  // Apply nomenclature visibility setting
  useEffect(() => {
    if (!viewer) return;

    // TODO: Consider zoom level for label density management

  }, [viewer, showLunarNomenclature]);

  const handleConstraintToggle = (checked: boolean) => {
    setIsConstraintDisabled(checked);
  };

  const handleNomenclatureToggle = (checked: boolean) => {
    setShowLunarNomenclature(checked);
  };

  return (
    <>
      {/* Camera Settings Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Camera Settings</h3>

        <div className={styles.optionsContainer}>
          <CheckboxWithInfo
            label="Remove rotation lock at poles"
            isSelected={isConstraintDisabled}
            onChange={handleConstraintToggle}
            infoTooltipText="Info about rotation lock"
            infoPopoverTitle="Rotation Lock at Poles"
            infoPopoverBody={`Controls camera rotation lock at the lunar poles.\n\nUnchecked: Rotation lock enabled (standard navigation mode).\n\nChecked: Rotation lock removed, allows full camera movement in all directions at polar regions.`}
            infoPlacement="right"
          />
        </div>
      </div>

      {/* Labels Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Labels</h3>

        <div className={styles.optionsContainer}>
          <CheckboxWithInfo
            label="Show lunar names"
            isSelected={showLunarNomenclature}
            onChange={handleNomenclatureToggle}
            infoTooltipText="Info about lunar nomenclature"
            infoPopoverTitle="Lunar Nomenclature"
            infoPopoverBody={`Display official names of lunar features as designated by the International Astronomical Union (IAU).\n\nThe IAU is the internationally recognized authority for assigning designations to celestial bodies and their surface features.`}
            infoPlacement="right"
          />
        </div>
      </div>
    </>
  );
};

export default ViewerOptionsSection;
