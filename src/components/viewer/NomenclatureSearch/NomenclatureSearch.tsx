import React, { useContext, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { ComboBox, ComboBoxStateContext, Input, ListBox, ListBoxItem, Popover, Button, TooltipTrigger, Focusable } from 'react-aria-components';
import { useFilter } from 'react-aria';
import { useViewer } from 'utils/context/ViewerContext';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useNomenclatureFeatures } from 'hooks/useNomenclatureFeatures';
import { parseCoordinateInput } from 'utils/coordinateParser';
import { createPointFeature } from 'services/drawing/PointDrawingService';
import { formatDegrees, formatCoordinateFeatureName } from 'utils/featurePointNaming';
import { Feature } from 'components/navigation/FeaturesSection/types';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import SearchResultCallout from './SearchResultCallout';
import SearchResultMarker from './SearchResultMarker';
import styles from './NomenclatureSearch.module.scss';

type SearchItem =
  | { id: string; kind: 'coordinate'; lat: number; lon: number; altitude?: number; label: string }
  | { id: string; kind: 'feature'; lon: number; lat: number; diameter: number; label: string };

const MAX_FEATURE_RESULTS = 50;
const MIN_FEATURE_ALTITUDE = 5000; // meters, mirrors flyToFeature's bounds-less fallback
const FEATURE_ALTITUDE_PADDING = 2; // mirrors calculateCameraDistance's padding factor

interface SearchInputProps {
  inputRef: React.RefObject<HTMLInputElement>;
  items: SearchItem[];
  onCommit: (id: string) => void;
  onCollapse: () => void;
}

// Reads the ComboBox's keyboard-focused option (only available to descendants
// of <ComboBox>) so Enter only falls back to the top result when the user
// hasn't arrow-navigated to a specific option.
const SearchInput: React.FC<SearchInputProps> = ({ inputRef, items, onCommit, onCollapse }) => {
  const comboBoxState = useContext(ComboBoxStateContext);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCollapse();
    } else if (event.key === 'Enter') {
      const hasFocusedOption = comboBoxState?.selectionManager.focusedKey != null;
      if (!hasFocusedOption && items.length > 0) {
        event.preventDefault();
        onCommit(items[0].id);
      }
    }
  };

  return <Input ref={inputRef} placeholder="Feature name or lat, lon[, altitude]" onKeyDown={handleKeyDown} />;
};

interface SavablePoint {
  lon: number;
  lat: number;
  name: string;
  sourceId: string;
}

// Stops the option row underneath from treating this press as its own
// selection (which flies the camera there), the row commits on pointerup,
// not click, so every stage of the press sequence needs this.
const stopEventPropagation = (event: React.SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const NomenclatureSearch: React.FC = () => {
  const { viewer } = useViewer();
  const { features: nomenclatureFeatures } = useNomenclatureFeatures();
  const { features, addFeature, toggleFeatureInsights, showFeatures, showLabels } = useFeaturesContext();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeMarker, setActiveMarker] = useState<SavablePoint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search results already saved as a feature point are tracked by a stable
  // source key (distinct from the coordinate/feature's own precision-sensitive
  // values) so re-searching the same result doesn't create a duplicate.
  const savedSourceIds = useMemo(
    () => new Set(features.map((feature) => feature.metadata.sourceId).filter((id): id is string => !!id)),
    [features]
  );

  const items = useMemo<SearchItem[]>(() => {
    const trimmed = inputValue.trim();
    if (trimmed === '') return [];

    const results: SearchItem[] = [];

    const coordinate = parseCoordinateInput(trimmed);
    if (coordinate) {
      const altitudeLabel = coordinate.altitude !== undefined ? `, Alt ${coordinate.altitude.toFixed(0)}m` : '';
      results.push({
        id: 'coordinate',
        kind: 'coordinate',
        lat: coordinate.lat,
        lon: coordinate.lon,
        altitude: coordinate.altitude,
        label: `Fly to Lat ${formatDegrees(coordinate.lat)}°, Lon ${formatDegrees(coordinate.lon)}°${altitudeLabel}`,
      });
    }

    for (const feature of nomenclatureFeatures) {
      if (results.length >= MAX_FEATURE_RESULTS) break;
      if (contains(feature.name, trimmed)) {
        results.push({
          id: `${feature.name}-${feature.lon}-${feature.lat}`,
          kind: 'feature',
          lon: feature.lon,
          lat: feature.lat,
          diameter: feature.diameter,
          label: feature.name,
        });
      }
    }

    return results;
  }, [inputValue, nomenclatureFeatures, contains, savedSourceIds]);

  const collapse = () => {
    setIsExpanded(false);
    setInputValue('');
  };

  const expand = () => {
    setIsExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const flyTo = (destination: Cesium.Cartesian3) => {
    if (!viewer) return;
    viewer.camera.flyTo({
      destination,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
      easingFunction: Cesium.EasingFunction.CUBIC_OUT,
    });
  };

  // Stable identity for "has this exact result already been saved as a feature
  // point" checks, distinct from SearchItem.id, which is always the literal
  // 'coordinate' for typed coordinates and thus not unique per lat/lon.
  const getSourceId = (item: SearchItem): string =>
    item.kind === 'coordinate'
      ? `coordinate-${item.lat.toFixed(6)}-${item.lon.toFixed(6)}`
      : item.id;

  const toSavablePoint = (item: SearchItem): SavablePoint => ({
    lon: item.lon,
    lat: item.lat,
    name: item.kind === 'coordinate' ? formatCoordinateFeatureName(item.lon, item.lat) : item.label,
    sourceId: getSourceId(item),
  });

  const saveAsFeaturePoint = (point: SavablePoint): Feature | null => {
    if (!viewer || savedSourceIds.has(point.sourceId)) return null;
    const cartesian = Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0);
    const feature = createPointFeature(viewer, cartesian, point.name, showFeatures, showLabels, point.sourceId);
    addFeature(feature);
    return feature;
  };

  const handleSelection = (key: React.Key | null) => {
    if (!viewer || key === null) return;
    const item = items.find((candidate) => candidate.id === key);
    if (!item) return;

    const altitude = item.kind === 'coordinate'
      ? item.altitude ?? viewer.camera.positionCartographic.height
      : Math.max(item.diameter * 1000 * FEATURE_ALTITUDE_PADDING, MIN_FEATURE_ALTITUDE);
    flyTo(Cesium.Cartesian3.fromDegrees(item.lon, item.lat, altitude));

    setActiveMarker(toSavablePoint(item));

    collapse();
  };

  // Save silently from the dropdown for bookmarking several candidates in a row without interruption.
  const handleDropdownSave = (item: SearchItem) => {
    saveAsFeaturePoint(toSavablePoint(item));
  };

  // Save silently from the callout.
  const handleSaveFromCallout = () => {
    if (!activeMarker) return;
    saveAsFeaturePoint(activeMarker);
  };

  const handleAnalyze = () => {
    if (!activeMarker) return;
    const existing = features.find((feature) => feature.metadata.sourceId === activeMarker.sourceId);
    const feature = existing ?? saveAsFeaturePoint(activeMarker);
    if (feature) {
      toggleFeatureInsights(feature.id);
    }
    setActiveMarker(null);
  };

  const handleDismissMarker = () => {
    setActiveMarker(null);
  };

  const searchBox = !isExpanded ? (
    <ViewerIconButton
      icon="search"
      ariaLabel="Search for a lunar feature or coordinate"
      tooltipText="Search feature or coordinate"
      tooltipPlacement="right"
      className={styles.collapsedButton}
      onPress={expand}
    />
  ) : (
    <div className={styles.expandedContainer}>
      <ComboBox
        aria-label="Search for a lunar feature or coordinate"
        items={items}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onChange={handleSelection}
        menuTrigger="input"
        allowsEmptyCollection
        className={styles.comboBox}
      >
        <SearchInput inputRef={inputRef} items={items} onCommit={handleSelection} onCollapse={collapse} />
        <Popover className={styles.popover}>
          <ListBox
            className={styles.listBox}
            renderEmptyState={() => (
              <span className={styles.emptyState}>
                {inputValue.trim() === '' ? 'Type a feature name or coordinates' : 'No matches'}
              </span>
            )}
          >
            {(item: SearchItem) => {
              const alreadySaved = savedSourceIds.has(getSourceId(item));

              return (
                <ListBoxItem
                  id={item.id}
                  textValue={item.label}
                  className={`${styles.listBoxItem} ${item.kind === 'coordinate' ? styles.coordinateItem : ''}`}
                >
                  {item.kind === 'coordinate' && (
                    <span aria-hidden="true" className={`material-symbols-outlined ${styles.itemIcon}`}>near_me</span>
                  )}
                  <span className={styles.itemLabel}>{item.label}</span>
                  <TooltipTrigger>
                    <Focusable>
                      <button
                        type="button"
                        aria-label={alreadySaved ? 'Already saved as feature point' : 'Save as feature point'}
                        className={styles.saveButton}
                        disabled={alreadySaved}
                        data-saved={alreadySaved || undefined}
                        // The Option commits its selection (flying the camera there) on
                        // pointerup, not on click, so every stage of the press has to be
                        // stopped here, not just the click, to keep this a separate action.
                        onPointerDownCapture={stopEventPropagation}
                        onMouseDownCapture={stopEventPropagation}
                        onPointerUpCapture={stopEventPropagation}
                        onMouseUpCapture={stopEventPropagation}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          if (!alreadySaved) handleDropdownSave(item);
                        }}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {alreadySaved ? 'bookmark' : 'bookmark_add'}
                        </span>
                      </button>
                    </Focusable>
                    <ButtonTooltip placement="top">
                      {alreadySaved ? 'Already saved as feature point' : 'Save as feature point'}
                    </ButtonTooltip>
                  </TooltipTrigger>
                </ListBoxItem>
              );
            }}
          </ListBox>
        </Popover>
      </ComboBox>
      <Button aria-label="Close search" className={styles.closeButton} onPress={collapse}>
        <span className="material-symbols-outlined">close</span>
      </Button>
    </div>
  );

  return (
    <>
      {searchBox}
      {activeMarker && viewer && (
        <>
          <SearchResultMarker viewer={viewer} lon={activeMarker.lon} lat={activeMarker.lat} />
          <SearchResultCallout
            viewer={viewer}
            lon={activeMarker.lon}
            lat={activeMarker.lat}
            label={activeMarker.name}
            alreadySaved={savedSourceIds.has(activeMarker.sourceId)}
            onSave={handleSaveFromCallout}
            onAnalyze={handleAnalyze}
            onDismiss={handleDismissMarker}
          />
        </>
      )}
    </>
  );
};

export default NomenclatureSearch;
