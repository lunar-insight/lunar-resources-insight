import React, { useMemo, useCallback } from 'react';
import { ListBox, ListBoxItem, Selection, Key } from 'react-aria-components';
import { useLayerContext } from 'utils/context/LayerContext';
import { getLayersByCompound } from 'geoConfigExporter';
import { compoundToFormula } from 'utils/colorUtils';
import InfoButton from 'components/layout/Button/InfoButton/InfoButton';
import { DERIVED_INDICES, DERIVED_INDEX_LAYER_MAP } from './data';
import styles from './DerivedIndices.module.scss';

const DISABLED_INDEX_KEYS = new Set(
  DERIVED_INDICES.filter(i => i.disabled).map(i => i.id)
);

const DerivedIndices: React.FC = () => {
  const { selectedLayers, addLayer, removeLayer } = useLayerContext();

  const selectedLayerSet = useMemo(() => new Set(selectedLayers), [selectedLayers]);

  const selectedKeys = useMemo(() => new Set<Key>(
    DERIVED_INDICES
      .filter(index => index.layerId && selectedLayerSet.has(index.layerId))
      .map(index => index.id)
  ), [selectedLayerSet]);

  const isInputLoaded = (compoundId: string): boolean => {
    const layerIds = getLayersByCompound(compoundId);
    return layerIds.some(id => selectedLayerSet.has(id));
  };

  // Select all would load every index at once, so it changes nothing
  const handleSelectionChange = useCallback((keys: Selection) => {
    if (keys === 'all') return;
    DERIVED_INDICES.forEach(({ id, layerId }) => {
      if (!layerId) return;
      if (keys.has(id) && !selectedKeys.has(id)) {
        addLayer(layerId, { displayName: DERIVED_INDEX_LAYER_MAP[id].displayName, category: 'derived-index' });
      } else if (!keys.has(id) && selectedKeys.has(id)) {
        removeLayer(layerId);
      }
    });
  }, [selectedKeys, addLayer, removeLayer]);

  return (
    <ListBox
      aria-label="Derived indices"
      className={styles.derivedIndices}
      layout="grid"
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      disabledKeys={DISABLED_INDEX_KEYS}
    >
      {DERIVED_INDICES.map(index => (
        <ListBoxItem
          key={index.id}
          id={index.id}
          textValue={`${index.symbol} ${index.name}`}
          className={({ isSelected, isDisabled }) =>
            [
              styles.card,
              isSelected ? styles.active : '',
              isDisabled ? styles.disabled : '',
            ].filter(Boolean).join(' ')
          }
        >
          <div className={styles.cardHeader}>
            <span className={styles.symbol}>{index.symbol}</span>
            <span className={styles.name}>{index.name}</span>
            <InfoButton
              tooltipText="More information"
              popoverTitle={index.info.title}
              popoverBody={index.info.body}
              placement="top"
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.formulaRow}>
            <span className={styles.rowLabel}>Formula</span>
            <span className={styles.formulaValue}>{index.formula}</span>
          </div>

          <div className={styles.inputsRow}>
            <span className={styles.rowLabel}>Inputs</span>
            <div className={styles.chips}>
              {index.inputs.map(compoundId => {
                const loaded = isInputLoaded(compoundId);
                return (
                  <span
                    key={compoundId}
                    className={`${styles.inputChip} ${loaded ? styles.loaded : ''}`}
                    title={loaded ? 'Layer loaded' : 'Layer not loaded'}
                  >
                    {compoundToFormula(compoundId)}
                    <span className={styles.chipStatus}>{loaded ? ' ✓' : ' ✗'}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className={styles.purposeRow}>
            <span className={styles.rowLabel}>Purpose</span>
            <span className={styles.purposeValue}>{index.purpose}</span>
          </div>
        </ListBoxItem>
      ))}
    </ListBox>
  );
};

export default DerivedIndices;
