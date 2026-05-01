import React, { useMemo, useCallback } from "react";
import { ListBox, ListBoxItem, Text, Selection, Key } from 'react-aria-components';
import { useLayerContext } from 'utils/context/LayerContext';
import { getLayersByCompound } from 'geoConfigExporter';
import { DataSourceBadge } from 'components/ui/DataSourceBadge/DataSourceBadge';
import { DataSourceLegend } from 'components/ui/DataSourceLegend/DataSourceLegend';
import InfoButton from 'components/layout/Button/InfoButton/InfoButton';
import { COMPOUNDS, COMPOUND_LAYER_MAP, CATEGORY_INFO, Compound } from './data';
import styles from './Compound.module.scss';

export interface CompoundProps {
  // Placeholder (onCompoundSelect callback for map integration)
}

const DISABLED_COMPOUND_KEYS = new Set(
  COMPOUNDS
    .filter(c => {
      const layerInfo = COMPOUND_LAYER_MAP[c.id];
      return !layerInfo || getLayersByCompound(layerInfo.id).length === 0;
    })
    .map(c => c.id)
);

const CompoundComponent: React.FC<CompoundProps> = () => {
  const { selectedLayers, addLayer, removeLayer } = useLayerContext();

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

  // Derive selected state from context so it persists across modal open/close
  const selectedCompounds = useMemo((): Selection => {
    const selected = new Set<Key>();
    COMPOUNDS.forEach(compound => {
      const layerInfo = COMPOUND_LAYER_MAP[compound.id];
      if (layerInfo) {
        const resolvedIds = getLayersByCompound(layerInfo.id);
        if (resolvedIds.length > 0 && resolvedIds.some(id => selectedLayers.includes(id))) {
          selected.add(compound.id);
        }
      }
    });
    return selected;
  }, [selectedLayers]);

  // Selection handler
  const handleCompoundSelection = useCallback((keys: Selection) => {
    const newCompounds = keys === 'all' ? new Set<string>() : new Set(keys as Set<string>);
    const currentCompounds = selectedCompounds === 'all'
      ? new Set<string>()
      : new Set(selectedCompounds as Set<string>);

    newCompounds.forEach(compoundId => {
      if (!currentCompounds.has(compoundId as string)) {
        const layerInfo = COMPOUND_LAYER_MAP[compoundId as string];
        if (layerInfo) {
          addLayer(layerInfo.id, { displayName: layerInfo.displayName, category: 'compound' });
        }
      }
    });

    currentCompounds.forEach(compoundId => {
      if (!newCompounds.has(compoundId)) {
        const layerInfo = COMPOUND_LAYER_MAP[compoundId];
        if (layerInfo) removeLayer(layerInfo.id);
      }
    });
  }, [selectedCompounds, addLayer, removeLayer]);

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
