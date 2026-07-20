import React, { useMemo, useCallback } from 'react';
import { ListBox, ListBoxItem, Text } from 'react-aria-components';
import { DataSourceBadge } from 'components/ui/DataSourceBadge/DataSourceBadge';
import { DataSourceLegend } from 'components/ui/DataSourceLegend/DataSourceLegend';
import { layersConfig } from 'geoConfigExporter';
import type { Selection } from '@react-types/shared';
import styles from './PeriodicTable.module.scss';
import { DataAvailability } from 'types/dataSource';
import { Element, elements, lanthanides, actinides } from 'constants/periodicTableData';

export interface PeriodicTableProps {
  onElementSelect: (element: Element) => void;
  selectedElements: Element[];
}

// Derive element availability from layersConfig at module load time
const elementAvailabilityMap = new Map<string, DataAvailability>();

Object.values(layersConfig.layers).forEach(layer => {
  if (layer.category === 'chemical' && layer.element) {
    const name = layer.element.toLowerCase();
    const isPoint = layer.layerType === 'point';
    const existing = elementAvailabilityMap.get(name);

    if (!existing) {
      elementAvailabilityMap.set(name, isPoint ? 'ground' : 'map');
    } else if (existing === 'map' && isPoint) {
      elementAvailabilityMap.set(name, 'map+ground');
    } else if (existing === 'ground' && !isPoint) {
      elementAvailabilityMap.set(name, 'map+ground');
    }
  }
})

export const ALL_ELEMENTS_FLAT = [...elements, ...lanthanides, ...actinides];

const ALL_ELEMENTS = ALL_ELEMENTS_FLAT.map(el => {
  const availability = elementAvailabilityMap.get(el.name.toLowerCase());
  return {
    ...el,
    dataExist: !!availability, // converts undefined (element not found in the map) to false, and any DataAvailability string to true
    dataType: availability
  };
});

const GRID: (Element | null)[][] = Array(10).fill(null).map(() => Array(18).fill(null));

ALL_ELEMENTS.forEach(element => {
  GRID[element.row - 1][element.column - 1] = element;
});

const DISABLED_KEYS = new Set<string>();
GRID.forEach((row, rowIndex) => {
  row.forEach((element, colIndex) => {
    if (element === null || (element && !element.dataExist)) {
      DISABLED_KEYS.add(`${rowIndex + 1}-${colIndex + 1}`);
    }
  });
});

const ElementCell = React.memo(({
  item,
  cellKey
}: {
  item: Element | null,
  cellKey: string,
}) => {
  return (
    <ListBoxItem
      key={cellKey}
      id={cellKey}
      textValue={item?.name || 'Empty'}
      className={`${styles.cell} ${item && !item.dataExist ? styles.cellUnavailable : ''}`}
    >
      {item ? (
        <div className={`${styles.element} ${!item.dataExist ? styles.elementUnavailable : ''}`}>
          {/* Data Source Badge, only show on available elements with dataType */}
          {item.dataExist && item.dataType && (
            <DataSourceBadge dataType={item.dataType} className={styles.elementBadge} iconOnly />
          )}

          <div className={styles.top}>
            <Text slot='description' className={styles.atomicNumber}>
              {item.atomicNumber}
            </Text>
          </div>
          <Text slot="label" className={styles.symbol}>
            {item.symbol}
          </Text>
          <div className={styles.bottom}>
            <Text slot="description" className={styles.name}>
              {item.name}
            </Text>
          </div>
        </div>
      ) : (
        <div className={styles.emptyCell}></div>
      )}
    </ListBoxItem>
  )
})


const PeriodicTable: React.FC<PeriodicTableProps> = ({ onElementSelect, selectedElements }) => {
  const selectedKeys = useMemo(() =>
    new Set(selectedElements.map(el => `${el.row}-${el.column}`)),
    [selectedElements]
  );

  const handleSelectionChange = useCallback((keys: Selection) => {
    const newKeys = new Set(keys);
    ALL_ELEMENTS.forEach(element => {
      const elementKey = `${element.row}-${element.column}`;

      if (newKeys.has(elementKey) !== selectedKeys.has(elementKey)) {
        onElementSelect(element);
      }
    });
  }, [selectedKeys, onElementSelect]);

  return (
    <div className={styles.periodicTable}>
      <div className={styles.stateInfo}>
        <span className={styles.stateInfoItem}>
          <span className={`${styles.stateInfoRectangle} ${styles.stateInfoRectangleSelectable}`}></span>
          Selectable
        </span>
        <span className={styles.stateInfoItem}>
          <span className={`${styles.stateInfoRectangle} ${styles.stateInfoRectangleSelected}`}></span>
          Selected
        </span>
        <span className={styles.stateInfoItem}>
          <span className={`${styles.stateInfoRectangle} ${styles.stateInfoRectangleUnavailable}`}></span>
          Unavailable
        </span>

        {/* Separator */}
        <div className={styles.legendSeparator}></div>

        {/* Data Source Legend */}
        <DataSourceLegend />
      </div>

      <ListBox
        aria-label="Periodic Table of Element"
        layout="grid"
        items={ALL_ELEMENTS}
        selectionMode="multiple"
        className={styles.grid}
        disabledKeys={DISABLED_KEYS}
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
      >
        {GRID.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((item, colIndex) => {
              const cellKey = `${rowIndex + 1}-${colIndex + 1}`;
              return (
                <ElementCell
                  key={cellKey}
                  item={item}
                  cellKey={cellKey}
                />
              );
            })}
          </React.Fragment>
        ))}
      </ListBox>
    </div>
  );
};

export default PeriodicTable;