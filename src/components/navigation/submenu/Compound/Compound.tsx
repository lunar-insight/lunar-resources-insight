import React, { useState, useMemo} from "react";
import { ListBox, ListBoxItem, Text, Selection } from 'react-aria-components';
import styles from './Compound.module.scss';

interface CompoundData {
  formula: string;
  name: string;
  hasMap: boolean;
  row: number;
  column: number;
}

const compounds: CompoundData[] = [
  { formula: "H₂O", name: "Water ice", hasMap: true, row: 1, column: 1 },
  { formula: "FeO", name: "Iron(II) oxide", hasMap: true, row: 1, column: 2 },
  { formula: "TiO₂", name: "Titanium dioxide", hasMap: true, row: 1, column: 3 },
  { formula: "Al₂O₃", name: "Aluminum oxide", hasMap: true, row: 1, column: 4 },
  { formula: "MgO", name: "Magnesium oxide", hasMap: true, row: 2, column: 1 },
  { formula: "CaO", name: "Calcium oxide", hasMap: true, row: 2, column: 2 },
  { formula: "SiO₂", name: "Silicon dioxide", hasMap: true, row: 2, column: 3 },
  { formula: "CO₂", name: "Carbon dioxide", hasMap: false, row: 2, column: 4 },
  { formula: "NH₃", name: "Ammonia", hasMap: false, row: 3, column: 1 },
  { formula: "CH₄", name: "Methane", hasMap: false, row: 3, column: 2 },
  { formula: "SO₂", name: "Sulfur dioxide", hasMap: false, row: 3, column: 3 },
  { formula: "H₂S", name: "Hydrogen sulfide", hasMap: false, row: 3, column: 4 },
  { formula: "C₂H₄", name: "Ethylene", hasMap: false, row: 4, column: 1 },
  { formula: "CH₃OH", name: "Methanol", hasMap: false, row: 4, column: 2 },
  { formula: "CO", name: "Carbon monoxide", hasMap: false, row: 4, column: 3 },
  { formula: "H₂", name: "Hydrogen", hasMap: false, row: 4, column: 4 }
];

// Create 4x4 grid structure
const GRID: (CompoundData | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));

// Populate grid with compounds based on their row/column positions
compounds.forEach(compound => {
  GRID[compound.row - 1][compound.column - 1] = compound;
});

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
          {/* Coverage Badge */}
          <span className={`${styles.badge} ${item.hasMap ? styles.badgeGlobal : styles.badgeLocal}`}>
            {item.hasMap ? "Global" : "Local"}
          </span>

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
        <span className={styles.stateInfoItem}>
          <span className={`${styles.badgeMini} ${styles.badgeMiniGlobal}`}>Global</span>
          Global coverage
        </span>
        <span className={styles.stateInfoItem}>
          <span className={`${styles.badgeMini} ${styles.badgeMiniLocal}`}>Local</span>
          Local coverage
        </span>
      </div>

      <ListBox
        aria-label="Chemical Compounds"
        layout="grid"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          const newFormulas = new Set<string>();
          Array.from(keys).forEach(key => {
            const [row, col] = (key as string).split('-').map(Number);
            const compound = GRID[row - 1][col - 1];
            if (compound) newFormulas.add(compound.formula);
          });
          setSelectedCompounds(newFormulas);
        }}
        className={styles.compoundGrid}
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