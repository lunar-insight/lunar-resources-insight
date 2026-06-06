import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from 'utils/context/ViewerContext';
import { layersConfig } from 'geoConfigExporter';
import { CheckboxWithInfo } from 'components/layout/Checkbox/CheckboxWithInfo/CheckboxWithInfo';
import styles from './ViewerOptionsSection.module.scss';

const ViewerOptionsSection: React.FC = () => {
  const { viewer } = useViewer();
  const [isConstraintDisabled, setIsConstraintDisabled] = useState(false);
  const [showLunarNomenclature, setShowLunarNomenclature] = useState(false);

  const dataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);

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

    if (!showLunarNomenclature) {
      if (dataSourceRef.current) {
        dataSourceRef.current.show = false;
      }
      return;
    }

    if (dataSourceRef.current) {
      dataSourceRef.current.show = true;
      return;
    }

    const geojsonUrl = `/${layersConfig.layers.iau_nomenclature.filename}`;

    fetch(geojsonUrl)
      .then(res => res.json())
      .then(data => {
        // Cesium only knows Earth CRS identifiers; the IAU_2015 name causes a
        // RuntimeError. Coordinates are already lon/lat degrees, so dropping
        // the key is safe: Cesium defaults to geographic lon/lat without it.
        delete data.crs;
        return Cesium.GeoJsonDataSource.load(data);
      })
      .then((dataSource) => {
        const now = Cesium.JulianDate.now();
        for (const entity of dataSource.entities.values) {
          const name = entity.properties?.name?.getValue(now) as string ?? entity.name ?? '';
          entity.billboard = undefined;
          entity.label = new Cesium.LabelGraphics({
            text: name,
            font: '11px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            translucencyByDistance: new Cesium.NearFarScalar(5e5, 1.0, 3e6, 0.0),
          });
        }
        viewer.dataSources.add(dataSource);
        dataSourceRef.current = dataSource;
      })
      .catch((err) => console.error('Failed to load nomenclature GeoJSON:', err));
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
