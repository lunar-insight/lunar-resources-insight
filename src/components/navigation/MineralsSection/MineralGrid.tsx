import React from 'react';
import { ListBox, ListBoxItem, Text } from 'react-aria-components';
import { DataSourceBadge } from '../../ui/DataSourceBadge/DataSourceBadge';
import { MineralGridProps } from './types';
import styles from './MineralGrid.module.scss';
import InfoButton from '../../layout/Button/InfoButton/InfoButton';

export const MineralGrid: React.FC<MineralGridProps> = ({
  minerals,
  selectedMinerals,
  onSelectionChange,
  highlightedMinerals,
  onMineralHover,
}) => {
  // Group minerals by category
  const silicates = minerals.filter((m) => m.category === 'silicate');
  const oxides = minerals.filter((m) => m.category === 'oxide');
  const moonDiscovered = minerals.filter((m) => m.category === 'moon-discovered');

  const renderMineralItem = (mineral: typeof minerals[0]) => {
    const isHighlighted = highlightedMinerals.has(mineral.id);
    const isMoonDiscovered = mineral.category === 'moon-discovered';

    return (
      <ListBoxItem
        key={mineral.id}
        id={mineral.id}
        textValue={mineral.name}
        className={`${styles.mineralItem} ${isHighlighted ? styles.highlighted : ''}`}
        onHoverStart={() => onMineralHover(mineral.id)}
        onHoverEnd={() => onMineralHover(null)}
      >
        <div className={styles.mineralItemContent}>
          {/* Data Source Badge */}
          <DataSourceBadge dataType={mineral.dataType} />

          {/* Mineral name */}
          <Text slot="description" className={styles.mineralName}>
            {mineral.name}
          </Text>

          {/* Mineral formula */}
          <Text slot="description" className={styles.mineralFormula}>
            {mineral.formula}
          </Text>

          {/* Mineral type for moon-discovered minerals */}
          {isMoonDiscovered && mineral.mineralType && (
            <Text slot="description" className={styles.mineralCategory}>
              ({mineral.mineralType})
            </Text>
          )}

          {/* Grouping indicator for mineral groups */}
          {mineral.grouping === 'group' && (
            <Text slot="description" className={styles.mineralGrouping}>
              (group)
            </Text>
          )}
        </div>
      </ListBoxItem>
    );
  };

  return (
    <div className={styles.mineralGridContainer}>
      {/* Silicates Section */}
      <div className={styles.categorySection}>
        <h3 className={styles.categoryTitle}>SILICATES</h3>
        <ListBox
          aria-label="Silicate Minerals"
          className={styles.mineralGrid}
          layout="grid"
          selectionMode="multiple"
          selectedKeys={selectedMinerals}
          onSelectionChange={onSelectionChange}
        >
          {silicates.map(renderMineralItem)}
        </ListBox>
      </div>

      {/* Oxides Section */}
      <div className={styles.categorySection}>
        <h3 className={styles.categoryTitle}>OXIDES</h3>
        <ListBox
          aria-label="Oxide Minerals"
          className={styles.mineralGrid}
          layout="grid"
          selectionMode="multiple"
          selectedKeys={selectedMinerals}
          onSelectionChange={onSelectionChange}
        >
          {oxides.map(renderMineralItem)}
        </ListBox>
      </div>

      {/* Moon-Discovered Section */}
      <div className={styles.categorySection}>
        <div className={styles.categoryTitleContainer}>
          <h3 className={styles.categoryTitle}>MOON-DISCOVERED MINERALS</h3>
          <InfoButton
            tooltipText="More information"
            popoverTitle="Moon-Discovered Minerals"
            popoverBody="These minerals were first identified in lunar samples returned to Earth. Although later found on Earth, these mineral species were unknown to science before lunar exploration. Each is named after its discovery mission or location (e.g., Tranquillityite from Tranquility Base, Armalcolite from Armstrong-Aldrin-Collins)."
            placement="top"
            className={styles.categoryInfoButton}
          />
        </div>
        <ListBox
          aria-label="Moon-Discovered Minerals"
          className={styles.mineralGrid}
          layout="grid"
          selectionMode="multiple"
          selectedKeys={selectedMinerals}
          onSelectionChange={onSelectionChange}
        >
          {moonDiscovered.map(renderMineralItem)}
        </ListBox>
      </div>
    </div>
  );
};
