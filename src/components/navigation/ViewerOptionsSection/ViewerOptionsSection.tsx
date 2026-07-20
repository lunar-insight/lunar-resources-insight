import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from 'utils/context/ViewerContext';
import { layersConfig } from 'geoConfigExporter';
import { CheckboxWithInfo } from 'components/layout/Checkbox/CheckboxWithInfo/CheckboxWithInfo';
import styles from './ViewerOptionsSection.module.scss';

interface NomenclatureFeature {
  name: string;
  lon: number;
  lat: number;
  diameter: number;
  position: Cesium.Cartesian3;
  font: string;
  scale: number;
  outlineWidth: number;
  translucencyByDistance: Cesium.NearFarScalar;
}

// Camera height thresholds (meters) and the label set shown at each tier.
// Features are pre-sorted by diameter descending
const TIERS = [
  { minDiameter: 300, maxLabels: 200  },  // > 2000 km altitude: mare, large basins
  { minDiameter: 100, maxLabels: 500  },  // 800 km - 2000 km: large craters
  { minDiameter: 30,  maxLabels: 1000 },  // 300 km - 800 km: medium craters
  { minDiameter: 0,   maxLabels: 2000 },  // < 300 km: all features
];

// Each threshold matches the NearFarScalar `far` distance for the labels that tier
// adds, so labels enter and exit the collection at alpha 0.
function getTier(cameraHeight: number): number {
  if (cameraHeight > 2_500_000) return 0;
  if (cameraHeight > 950_000)   return 1;
  if (cameraHeight > 370_000)   return 2;
  return 3;
}


// Water-like IAU descriptors are shown in italic by cartographic convention
const WATER_LIKE_PREFIX = /^(Mare|Lacus|Sinus|Palus|Oceanus|Fretum)\s/;

// Shared NearFarScalar constants, one per diameter tier, allocated once at module load
const NFS_TIER0 = new Cesium.NearFarScalar(2_250_000, 1.0, 4_750_000, 0.0);
const NFS_TIER1 = new Cesium.NearFarScalar(  800_000, 1.0, 2_500_000, 0.0);
const NFS_TIER2 = new Cesium.NearFarScalar(  300_000, 1.0,   950_000, 0.0);
const NFS_TIER3 = new Cesium.NearFarScalar(  100_000, 1.0,   370_000, 0.0);

function getLabelStyle(diameter: number, name: string): {
  font: string;
  scale: number;
  outlineWidth: number;
  translucencyByDistance: Cesium.NearFarScalar;
} {
  // Render at 32px then scale down: produces a crisper canvas texture than
  // native small-px rendering (Cesium label quality workaround, issue #8474)
  const italic = WATER_LIKE_PREFIX.test(name) ? 'italic ' : '';
  if (diameter >= 300) return {
    font: `${italic}bold 32px sans-serif`,
    scale: 0.47,        // ~15px visual
    outlineWidth: 4,
    translucencyByDistance: NFS_TIER0,
  };
  if (diameter >= 100) return {
    font: `${italic}bold 32px sans-serif`,
    scale: 0.41,        // ~13px visual
    outlineWidth: 4,
    translucencyByDistance: NFS_TIER1,
  };
  if (diameter >= 30) return {
    font: `${italic}32px sans-serif`,
    scale: 0.35,        // ~11px visual
    outlineWidth: 3,
    translucencyByDistance: NFS_TIER2,
  };
  return {
    font: `${italic}32px sans-serif`,
    scale: 0.32,        // ~10px visual
    outlineWidth: 3,
    translucencyByDistance: NFS_TIER3,
  };
}

const REBUILD_DEBOUNCE_MS = 180;
const CHUNK_SIZE = 30;
const STEP1_BUDGET_MS = 6;

async function updateLabelsAsync(
  collection: Cesium.LabelCollection,
  features: NomenclatureFeature[],
  tier: number,
  cancelToken: { cancelled: boolean },
  cullingVolume: Cesium.CullingVolume,
  cameraPosition: Cesium.Cartesian3,
  moonRadiusSq: number,
  shownLabels: Map<number, Cesium.Label>
): Promise<void> {
  const { minDiameter, maxLabels } = TIERS[tier];
  const bs = new Cesium.BoundingSphere();

  // Step 1: compute new visible set, yielding every STEP1_BUDGET_MS to keep frames short
  const newVisible = new Set<number>();
  let count = 0;
  let deadline = performance.now() + STEP1_BUDGET_MS;
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (f.diameter < minDiameter || count >= maxLabels) break;
    if (Cesium.Cartesian3.dot(f.position, cameraPosition) <= moonRadiusSq) continue;
    bs.center = f.position;
    bs.radius = 0;
    if (cullingVolume.computeVisibility(bs) === Cesium.Intersect.OUTSIDE) continue;
    newVisible.add(i);
    count++;
    if (performance.now() > deadline) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (cancelToken.cancelled) return;
      deadline = performance.now() + STEP1_BUDGET_MS;
    }
  }

  if (cancelToken.cancelled) return;

  // Step 2: remove labels that left the view
  for (const [idx, label] of shownLabels) {
    if (!newVisible.has(idx)) {
      collection.remove(label);
      shownLabels.delete(idx);
    }
  }

  if (cancelToken.cancelled) return;

  // Step 3: add labels that entered the view (chunked to avoid long frames)
  let addCount = 0;
  for (const idx of newVisible) {
    if (shownLabels.has(idx)) continue;
    if (cancelToken.cancelled) return;
    const f = features[idx];
    const label = collection.add({
      text: f.name,
      position: f.position,
      font: f.font,
      scale: f.scale,
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: f.outlineWidth,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: 500000,
      translucencyByDistance: f.translucencyByDistance,
    });
    shownLabels.set(idx, label);
    addCount++;
    if (addCount % CHUNK_SIZE === 0) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  }
}

const ViewerOptionsSection: React.FC = () => {
  const { viewer } = useViewer();
  const [isConstraintDisabled, setIsConstraintDisabled] = useState(false);
  const [showLunarNomenclature, setShowLunarNomenclature] = useState(true);

  const labelCollectionRef = useRef<Cesium.LabelCollection | null>(null);
  const featuresRef = useRef<NomenclatureFeature[] | null>(null);
  const currentTierRef = useRef<number>(-1);
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const shownLabelsRef = useRef<Map<number, Cesium.Label>>(new Map());
  const moonRadiusSqRef = useRef<number>(0);

  // Apply constraint setting to camera
  useEffect(() => {
    if (!viewer) return;

    if (isConstraintDisabled) {
      viewer.camera.constrainedAxis = undefined;
    } else {
      viewer.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
    }
  }, [viewer, isConstraintDisabled]);

  // Apply nomenclature visibility setting
  useEffect(() => {
    if (!viewer) return;

    if (!showLunarNomenclature) {
      if (labelCollectionRef.current) {
        labelCollectionRef.current.show = false;
      }
      return;
    }

    const scheduleRebuild = (
      collection: Cesium.LabelCollection,
      features: NomenclatureFeature[]
    ) => {
      if (rebuildTimerRef.current !== null) {
        clearTimeout(rebuildTimerRef.current);
        rebuildTimerRef.current = null;
      }
      cancelTokenRef.current.cancelled = true;

      rebuildTimerRef.current = setTimeout(() => {
        rebuildTimerRef.current = null;
        const latestTier = getTier(viewer.camera.positionCartographic.height);
        currentTierRef.current = latestTier;
        const token = { cancelled: false };
        cancelTokenRef.current = token;
        const camPos = viewer.camera.position.clone();
        const cullingVolume = (viewer.camera.frustum as Cesium.PerspectiveFrustum)
          .computeCullingVolume(camPos, viewer.camera.direction, viewer.camera.up);
        updateLabelsAsync(collection, features, latestTier, token, cullingVolume, camPos, moonRadiusSqRef.current, shownLabelsRef.current);
      }, REBUILD_DEBOUNCE_MS);
    };

    // Re-enable: show collection and rebuild for current camera height
    if (labelCollectionRef.current && featuresRef.current) {
      labelCollectionRef.current.show = true;
      currentTierRef.current = getTier(viewer.camera.positionCartographic.height);
      scheduleRebuild(labelCollectionRef.current, featuresRef.current);
      return;
    }

    // First load: fetch compact array, create LabelCollection
    const compactUrl = `/${layersConfig.layers.iau_nomenclature.filename}`;

    fetch(compactUrl)
      .then(res => res.json())
      .then((rows: [string, number, number, number][]) => {
        const ellipsoid = viewer.scene.globe.ellipsoid;
        moonRadiusSqRef.current = ellipsoid.maximumRadius * ellipsoid.maximumRadius;
        const features: NomenclatureFeature[] = rows.map(([name, lon, lat, diameter]) => ({
          name, lon, lat, diameter,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid),
          ...getLabelStyle(diameter, name),
        }));

        featuresRef.current = features;

        const collection = new Cesium.LabelCollection({ scene: viewer.scene });
        viewer.scene.primitives.add(collection);
        labelCollectionRef.current = collection;

        const startLabels = () => {
          currentTierRef.current = getTier(viewer.camera.positionCartographic.height);
          scheduleRebuild(collection, features);
          const onCameraUpdate = () => {
            if (!collection.show) return;
            scheduleRebuild(collection, features);
          };
          viewer.camera.changed.addEventListener(onCameraUpdate);
          viewer.camera.moveEnd.addEventListener(onCameraUpdate);
        };

        if (viewer.scene.globe.tilesLoaded) {
          startLabels();
        } else {
          let peak = 0;
          const removeProgressListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
            (remaining: number) => {
              peak = Math.max(peak, remaining);
              if (peak > 0 && remaining < peak) {
                removeProgressListener();
                startLabels();
              }
            }
          );
        }
      })
      .catch(err => console.error('Failed to load nomenclature GeoJSON:', err));
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
