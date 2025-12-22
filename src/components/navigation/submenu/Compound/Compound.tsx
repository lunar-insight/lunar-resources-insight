import React, { useState, useMemo, useCallback } from "react";
import { ListBox, ListBoxItem, Text, Selection } from 'react-aria-components';
import { useLayerContext } from '../../../../utils/context/LayerContext';
import { DataSourceBadge } from '../../../ui/DataSourceBadge/DataSourceBadge';
import { DataSourceLegend } from '../../../ui/DataSourceLegend/DataSourceLegend';
import InfoButton from '../../../layout/Button/InfoButton/InfoButton';
import { COMPOUNDS, COMPOUND_LAYER_MAP, CATEGORY_INFO, DISABLED_COMPOUND_KEYS, Compound } from './data';
import styles from './Compound.module.scss';

export interface CompoundProps {
  // Placeholder (onCompoundSelect callback for map integration)
}

const CompoundComponent: React.FC<CompoundProps> = () => {
  const [selectedCompounds, setSelectedCompounds] = useState<Selection>(new Set());
  const { addLayer, removeLayer } = useLayerContext();

  // Group compounds by category
  const iceCompounds = useMemo(
    () => COMPOUNDS.filter(c => c.category === 'ice'),
    []
  );
  const lunarSoilOxides = useMemo(
    () => COMPOUNDS.filter(c => c.category === 'lunar-soil-oxides'),
    []
  );
  const gasesVolatiles = useMemo(
    () => COMPOUNDS.filter(c => c.category === 'gases-volatiles'),
    []
  );

  // Selection handler
  const handleCompoundSelection = useCallback((keys: Selection) => {
    setSelectedCompounds(prevSelectedCompounds => {
      const oldCompounds = new Set(prevSelectedCompounds);
      const newCompounds = new Set(keys);

      // Add newly selected compounds with metadata
      newCompounds.forEach(compoundId => {
        if (!oldCompounds.has(compoundId)) {
          const layerInfo = COMPOUND_LAYER_MAP[compoundId as string];
          if (layerInfo) {
            addLayer(layerInfo.id, {
              displayName: layerInfo.displayName,
              category: 'compound'
            });
          }
        }
      });

      // Remove deselected compounds
      oldCompounds.forEach(compoundId => {
        if (!newCompounds.has(compoundId)) {
          const layerInfo = COMPOUND_LAYER_MAP[compoundId as string];
          if (layerInfo) removeLayer(layerInfo.id);
        }
      });

      return keys;
    });
  }, [addLayer, removeLayer]);

  // Compound item renderer
  const renderCompoundItem = useCallback((compound: Compound) => {
    return (
      <ListBoxItem
        key={compound.id}
        id={compound.id}
        textValue={`${compound.name} ${compound.formula}`}
        className={styles.compoundItem}
      >
        <div className={styles.compoundItemContent}>
          <DataSourceBadge dataType={compound.dataType} />
          <Text slot="description" className={styles.name}>
            {compound.name}
          </Text>
          <Text slot="description" className={styles.formula}>
            {compound.formula}
          </Text>
        </div>
      </ListBoxItem>
    );
  }, []);

  // Category section renderer
  const renderCategorySection = (
    categoryKey: keyof typeof CATEGORY_INFO,
    compounds: Compound[],
    ariaLabel: string
  ) => {
    const categoryInfo = CATEGORY_INFO[categoryKey];

    return (
      <div className={styles.categorySection}>
        <div className={styles.categoryTitleContainer}>
          <h3 className={styles.categoryTitle}>{categoryInfo.title}</h3>
          <InfoButton
            tooltipText="More information"
            popoverTitle={categoryInfo.title}
            popoverBody={categoryInfo.description}
            placement="top"
            className={styles.categoryInfoButton}
          />
        </div>
        <ListBox
          aria-label={ariaLabel}
          className={styles.compoundGrid}
          layout="grid"
          selectionMode="multiple"
          selectedKeys={selectedCompounds}
          onSelectionChange={handleCompoundSelection}
          disabledKeys={DISABLED_COMPOUND_KEYS}
        >
          {compounds.map(renderCompoundItem)}
        </ListBox>
      </div>
    );
  };

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

      {/* Category sections */}
      <div className={styles.compoundGridContainer}>
        {renderCategorySection('ice', iceCompounds, 'Ice Compounds')}
        {renderCategorySection('lunar-soil-oxides', lunarSoilOxides, 'Lunar Soil Oxides')}
        {renderCategorySection('gases-volatiles', gasesVolatiles, 'Gases and Volatiles')}
      </div>
    </div>
  );
};

export default CompoundComponent;
