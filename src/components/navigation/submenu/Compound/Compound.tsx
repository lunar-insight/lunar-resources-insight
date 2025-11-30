import React, { useState} from "react";
import { GridList, GridListItem, Text, Selection } from 'react-aria-components';
import styles from './Compound.module.scss';

interface CompoundData {
  formula: string;
  name: string;
  hasMap: boolean;
}

const compounds: CompoundData[] = [
  // With global map
  { formula: "H₂O", name: "Water ice", hasMap: true },
  { formula: "FeO", name: "Iron(II) oxide", hasMap: true },
  { formula: "TiO₂", name: "Titanium dioxide", hasMap: true },
  { formula: "Al₂O₃", name: "Aluminum oxide", hasMap: true },
  { formula: "MgO", name: "Magnesium oxide", hasMap: true },
  { formula: "CaO", name: "Calcium oxide", hasMap: true },
  { formula: "SiO₂", name: "Silicon dioxide", hasMap: true },
  // Only ground truth
  { formula: "CO₂", name: "Carbon dioxide", hasMap: false },
  { formula: "NH₃", name: "Ammonia", hasMap: false },
  { formula: "CH₄", name: "Methane", hasMap: false },
  { formula: "SO₂", name: "Sulfur dioxide", hasMap: false },
  { formula: "H₂S", name: "Hydrogen sulfide", hasMap: false },
  { formula: "C₂H₄", name: "Ethylene", hasMap: false },
  { formula: "CH₃OH", name: "Methanol", hasMap: false },
  { formula: "CO", name: "Carbon monoxide", hasMap: false },
  { formula: "H₂", name: "Hydrogen", hasMap: false }
];


export interface CompoundProps {
  // Placeholder (onCompoundSelect callback for map integration)
}

const Compound: React.FC<CompoundProps> = () => {
  const [selectedCompounds, setSelectedCompounds] = useState<Selection>(new Set());

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

      <GridList
        aria-label="Chemical Compounds"
        selectionMode="multiple"
        selectedKeys={selectedCompounds}
        onSelectionChange={setSelectedCompounds}
        className={styles.compoundGrid}
      >
        {compounds.map((compound) => (
          <GridListItem
            key={compound.formula}
            id={compound.formula}
            textValue={`${compound.name} ${compound.formula}`}
            className={styles.compoundItem}
          >
            <div className={styles.compoundItemContent}>
              {/* Coverage Badge */}
              <span className={`${styles.badge} ${compound.hasMap ? styles.badgeGlobal : styles.badgeLocal}`}>
                {compound.hasMap ? "Global" : "Local"}
              </span>

              {/* Name */}
              <Text slot="description" className={styles.name}>
                {compound.name}
              </Text>

              {/* Formula */}
              <Text slot="description" className={styles.formula}>
                {compound.formula}
              </Text>
            </div>
          </GridListItem>
        ))}
      </GridList>
    </div>
  );
};

export default Compound;