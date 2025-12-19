import React, { useState, useMemo} from "react";
import { ListBox, ListBoxItem, Text, Selection } from 'react-aria-components';
import { useLayerContext } from '../../../../utils/context/LayerContext';
import { DataAvailability } from '../../../../types/dataSource';
import { DataSourceBadge } from '../../../ui/DataSourceBadge/DataSourceBadge';
import { DataSourceLegend } from '../../../ui/DataSourceLegend/DataSourceLegend';
import styles from './Compound.module.scss';

interface CompoundData {
  formula: string;
  name: string;
  dataType: DataAvailability;
  row: number;
  column: number;
}

const compounds: CompoundData[] = [
  { formula: "H₂O", name: "Water ice", dataType: 'map+ground', row: 1, column: 1 },
  { formula: "FeO", name: "Iron(II) oxide", dataType: 'map+ground', row: 1, column: 2 },
  { formula: "TiO₂", name: "Titanium dioxide", dataType: 'map+ground', row: 1, column: 3 },
  { formula: "Al₂O₃", name: "Aluminum oxide", dataType: 'map+ground', row: 1, column: 4 },
  { formula: "MgO", name: "Magnesium oxide", dataType: 'map+ground', row: 2, column: 1 },
  { formula: "CaO", name: "Calcium oxide", dataType: 'map+ground', row: 2, column: 2 },
  { formula: "SiO₂", name: "Silicon dioxide", dataType: 'map+ground', row: 2, column: 3 },
  { formula: "CO₂", name: "Carbon dioxide", dataType: 'ground', row: 2, column: 4 },
  { formula: "NH₃", name: "Ammonia", dataType: 'ground', row: 3, column: 1 },
  { formula: "CH₄", name: "Methane", dataType: 'ground', row: 3, column: 2 },
  { formula: "SO₂", name: "Sulfur dioxide", dataType: 'ground', row: 3, column: 3 },
  { formula: "H₂S", name: "Hydrogen sulfide", dataType: 'ground', row: 3, column: 4 },
  { formula: "C₂H₄", name: "Ethylene", dataType: 'ground', row: 4, column: 1 },
  { formula: "CH₃OH", name: "Methanol", dataType: 'ground', row: 4, column: 2 },
  { formula: "CO", name: "Carbon monoxide", dataType: 'ground', row: 4, column: 3 },
  { formula: "H₂", name: "Hydrogen", dataType: 'ground', row: 4, column: 4 }
];

// Mapping from compound formula to layer ID and metadata
const COMPOUND_LAYER_MAP: Record<string, { id: string; displayName: string }> = {
  'H₂O': { id: 'h2o', displayName: 'Water ice (H₂O)' },
  'FeO': { id: 'feo', displayName: 'Iron(II) oxide (FeO)' },
  'TiO₂': { id: 'tio2', displayName: 'Titanium dioxide (TiO₂)' },
  'Al₂O₃': { id: 'al2o3', displayName: 'Aluminum oxide (Al₂O₃)' },
  'MgO': { id: 'mgo', displayName: 'Magnesium oxide (MgO)' },
  'CaO': { id: 'cao', displayName: 'Calcium oxide (CaO)' },
  'SiO₂': { id: 'sio2', displayName: 'Silicon dioxide (SiO₂)' },
  'CO₂': { id: 'co2', displayName: 'Carbon dioxide (CO₂)' },
  'NH₃': { id: 'nh3', displayName: 'Ammonia (NH₃)' },
  'CH₄': { id: 'ch4', displayName: 'Methane (CH₄)' },
  'SO₂': { id: 'so2', displayName: 'Sulfur dioxide (SO₂)' },
  'H₂S': { id: 'h2s', displayName: 'Hydrogen sulfide (H₂S)' },
  'C₂H₄': { id: 'c2h4', displayName: 'Ethylene (C₂H₄)' },
  'CH₃OH': { id: 'ch3oh', displayName: 'Methanol (CH₃OH)' },
  'CO': { id: 'co', displayName: 'Carbon monoxide (CO)' },
  'H₂': { id: 'h2', displayName: 'Hydrogen (H₂)' }
};

// Create 4x4 grid structure
const GRID: (CompoundData | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));

// Populate grid with compounds based on their row/column positions
compounds.forEach(compound => {
  GRID[compound.row - 1][compound.column - 1] = compound;
});

// Disabled keys - last compound (Hydrogen at position 4-4)
const DISABLED_KEYS = new Set(['4-4']);

const CompoundCell = React.memo(({
  item,
  cellKey
}: {
  item: CompoundData | null,
  cellKey: string,
}) => {
  return (
    <ListBoxItem
      key={cellKey}
      id={cellKey}
      textValue={item ? `${item.name} ${item.formula}` : 'Empty'}
      className={styles.compoundItem}
    >
      {item ? (
        <div className={styles.compoundItemContent}>
          {/* Data Source Badge */}
          <DataSourceBadge dataType={item.dataType} />

          {/* Name */}
          <Text slot="description" className={styles.name}>
            {item.name}
          </Text>

          {/* Formula */}
          <Text slot="description" className={styles.formula}>
            {item.formula}
          </Text>
        </div>
      ) : (
        <div className={styles.emptyCell}></div>
      )}
    </ListBoxItem>
  );
});

export interface CompoundProps {
  // Placeholder (onCompoundSelect callback for map integration)
}

const Compound: React.FC<CompoundProps> = () => {
  const [selectedCompounds, setSelectedCompounds] = useState<Selection>(new Set());
  const { addLayer, removeLayer } = useLayerContext();

  // Convert formula-based selection to grid-based keys
  const selectedKeys = useMemo(() =>
    new Set(
      Array.from(selectedCompounds).map(formula => {
        const compound = compounds.find(c => c.formula === formula);
        return compound ? `${compound.row}-${compound.column}` : '';
      }).filter(Boolean)
    ),
    [selectedCompounds]
  );

  return (
    <div className={styles.compound}>

      {/* Legend */}
      <div className={styles.stateInfo}>
        <span className={styles.stateInfoItem}>
          <span className={`${styles.stateInfoRectangle} ${styles.stateInfoRectangleSelected}`}></span>
          Selected
        </span>

        {/* Separator */}
        <div className={styles.legendSeparator}></div>

        {/* Data Source Legend */}
        <DataSourceLegend />
      </div>

      <ListBox
        aria-label="Chemical Compounds"
        layout="grid"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          const oldFormulas = new Set(selectedCompounds);
          const newFormulas = new Set<string>();

          Array.from(keys).forEach(key => {
            const [row, col] = (key as string).split('-').map(Number);
            const compound = GRID[row - 1][col - 1];
            if (compound) newFormulas.add(compound.formula);
          });

          // Add newly selected compounds with metadata
          newFormulas.forEach(formula => {
            if (!oldFormulas.has(formula)) {
              const layerInfo = COMPOUND_LAYER_MAP[formula];
              if (layerInfo) {
                addLayer(layerInfo.id, {
                  displayName: layerInfo.displayName,
                  category: 'compound'
                });
              }
            }
          });

          // Remove deselected compounds
          oldFormulas.forEach(formula => {
            if (!newFormulas.has(formula as string)) {
              const layerInfo = COMPOUND_LAYER_MAP[formula as string];
              if (layerInfo) removeLayer(layerInfo.id);
            }
          });

          setSelectedCompounds(newFormulas);
        }}
        className={styles.compoundGrid}
        disabledKeys={DISABLED_KEYS}
      >
        {GRID.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((item, colIndex) => {
              const cellKey = `${rowIndex + 1}-${colIndex + 1}`;
              return (
                <CompoundCell
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

export default Compound;