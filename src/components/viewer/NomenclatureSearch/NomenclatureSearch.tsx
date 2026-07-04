import React, { useContext, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { ComboBox, ComboBoxStateContext, Input, ListBox, ListBoxItem, Popover, Button } from 'react-aria-components';
import { useFilter } from 'react-aria';
import { useViewer } from 'utils/context/ViewerContext';
import { useNomenclatureFeatures } from 'hooks/useNomenclatureFeatures';
import { parseCoordinateInput } from 'utils/coordinateParser';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';
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

const NomenclatureSearch: React.FC = () => {
  const { viewer } = useViewer();
  const { features } = useNomenclatureFeatures();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
        label: `Fly to Lat ${coordinate.lat.toFixed(4)}°, Lon ${coordinate.lon.toFixed(4)}°${altitudeLabel}`,
      });
    }

    for (const feature of features) {
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
  }, [inputValue, features, contains]);

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

  const handleSelection = (key: React.Key | null) => {
    if (!viewer || key === null) return;
    const item = items.find((candidate) => candidate.id === key);
    if (!item) return;

    if (item.kind === 'coordinate') {
      const altitude = item.altitude ?? viewer.camera.positionCartographic.height;
      flyTo(Cesium.Cartesian3.fromDegrees(item.lon, item.lat, altitude));
    } else {
      const altitude = Math.max(item.diameter * 1000 * FEATURE_ALTITUDE_PADDING, MIN_FEATURE_ALTITUDE);
      flyTo(Cesium.Cartesian3.fromDegrees(item.lon, item.lat, altitude));
    }

    collapse();
  };

  if (!isExpanded) {
    return (
      <ViewerIconButton
        icon="search"
        ariaLabel="Search for a lunar feature or coordinate"
        tooltipText="Search feature or coordinate"
        tooltipPlacement="right"
        className={styles.collapsedButton}
        onPress={expand}
      />
    );
  }

  return (
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
            {(item: SearchItem) => (
              <ListBoxItem
                id={item.id}
                textValue={item.label}
                className={`${styles.listBoxItem} ${item.kind === 'coordinate' ? styles.coordinateItem : ''}`}
              >
                {item.kind === 'coordinate' && (
                  <span aria-hidden="true" className={`material-symbols-outlined ${styles.itemIcon}`}>near_me</span>
                )}
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      <Button aria-label="Close search" className={styles.closeButton} onPress={collapse}>
        <span className="material-symbols-outlined">close</span>
      </Button>
    </div>
  );
};

export default NomenclatureSearch;
