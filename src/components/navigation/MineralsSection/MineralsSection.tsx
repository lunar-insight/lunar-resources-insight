import React, { useState, useMemo, useCallback } from 'react';
import styles from './MineralsSection.module.scss';
import { Button, Key, Selection } from 'react-aria-components';
import ModalOverlayContainer from 'components/layout/ModalOverlayContainer/ModalOverlayContainer';
import { DataSourceLegend } from 'components/ui/DataSourceLegend/DataSourceLegend';
import { useZIndex } from 'utils/ZIndexProvider';
import { useLayerContext } from 'utils/context/LayerContext';
import { getLayersByMineral, layersConfig } from 'geoConfigExporter';
import { RockGrid } from './RockGrid';
import { MineralGrid } from './MineralGrid';
import { ROCKS, MINERALS } from './data';

// Layer ids loaded by a mineral entry, empty for ground-data-only minerals
function mapLayerIds(mineralId: string): string[] {
  const mineral = MINERALS.find(m => m.id === mineralId);
  return (mineral?.mapMinerals ?? []).flatMap(getLayersByMineral);
}

// An entry with no map layer cannot be selected
const DISABLED_MINERAL_KEYS = new Set(
  MINERALS.filter(m => mapLayerIds(m.id).length === 0).map(m => m.id)
);
const DISABLED_ROCK_KEYS = new Set(
  ROCKS.filter(r => !layersConfig.layers[r.id]).map(r => r.id)
);

const MineralsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { registerModal, unregisterModal } = useZIndex();
  const { selectedLayers, addLayer, removeLayer } = useLayerContext();

  // Hover state for bidirectional highlighting
  const [hoveredRockId, setHoveredRockId] = useState<string | null>(null);
  const [hoveredMineralId, setHoveredMineralId] = useState<string | null>(null);

  // Derived from the context, so a layer added or removed anywhere in the app shows here
  const selectedRocks = useMemo(
    () => new Set<Key>(ROCKS.filter(rock => selectedLayers.includes(rock.id)).map(rock => rock.id)),
    [selectedLayers]
  );
  const selectedMinerals = useMemo(
    () => new Set<Key>(
      MINERALS.filter(mineral => mapLayerIds(mineral.id).some(id => selectedLayers.includes(id))).map(mineral => mineral.id)
    ),
    [selectedLayers]
  );

  // Compute minerals to highlight when rock is hovered
  const highlightedMineralsFromRock = useMemo(() => {
    if (!hoveredRockId) return new Set<string>();
    return new Set(ROCKS.filter((rock) => rock.id === hoveredRockId).flatMap((rock) => rock.composition));
  }, [hoveredRockId]);

  // Compute rocks to highlight when mineral is hovered
  const highlightedRocksFromMineral = useMemo(() => {
    if (!hoveredMineralId) return new Set<string>();
    return new Set(
      ROCKS.filter((rock) => rock.composition.includes(hoveredMineralId)).map(
        (rock) => rock.id
      )
    );
  }, [hoveredMineralId]);

  const handleOpenMinerals = () => {
    setIsModalOpen(true);
    registerModal('minerals-modal');
  };

  const handleCloseMinerals = () => {
    setIsModalOpen(false);
    unregisterModal('minerals-modal');
  };

  const handleRockHover = (rockId: string | null) => {
    setHoveredRockId(rockId);
  };

  const handleMineralHover = (mineralId: string | null) => {
    setHoveredMineralId(mineralId);
  };

  // Select all gives 'all' for one list of several, which names no entries, so it changes nothing
  const handleRockSelection = useCallback((keys: Selection) => {
    if (keys === 'all') return;
    ROCKS.forEach(rock => {
      if (keys.has(rock.id) && !selectedRocks.has(rock.id)) {
        addLayer(rock.id, { displayName: rock.name, category: 'rock' });
      } else if (!keys.has(rock.id) && selectedRocks.has(rock.id)) {
        removeLayer(rock.id);
      }
    });
  }, [selectedRocks, addLayer, removeLayer]);

  const handleMineralSelection = useCallback((keys: Selection) => {
    if (keys === 'all') return;
    MINERALS.forEach(mineral => {
      if (keys.has(mineral.id) && !selectedMinerals.has(mineral.id)) {
        mapLayerIds(mineral.id).forEach(layerId => addLayer(layerId));
      } else if (!keys.has(mineral.id) && selectedMinerals.has(mineral.id)) {
        mapLayerIds(mineral.id).forEach(layerId => removeLayer(layerId));
      }
    });
  }, [selectedMinerals, addLayer, removeLayer]);

  return (
    <>
      <div className={styles.buttonsContainer}>
        <Button
          className={styles.mineralsButton}
          onPress={handleOpenMinerals}
        >
          Rocks & Minerals
        </Button>
      </div>

      <ModalOverlayContainer
        isOpen={isModalOpen}
        onOpenChange={handleCloseMinerals}
        title='Rocks & Minerals'
        modalId='minerals-modal'
      >
        <div className={styles.mineralsModal}>
          {/* Legend */}
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendRectangle} ${styles.legendSelected}`}
              ></span>
              <span>Selected</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendRectangle} ${styles.legendHighlighted}`}
              ></span>
              <span>Highlighted</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendRectangle} ${styles.legendSelectedHighlighted}`}
              ></span>
              <span>Selected + Highlighted</span>
            </div>

            {/* Separator */}
            <div className={styles.legendSeparator}></div>

            {/* Data Source Legend */}
            <DataSourceLegend />
          </div>

          {/* Rocks Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🪨 ROCKS</h2>
            <RockGrid
              rocks={ROCKS}
              selectedRocks={selectedRocks}
              onSelectionChange={handleRockSelection}
              highlightedRocks={highlightedRocksFromMineral}
              onRockHover={handleRockHover}
              disabledRocks={DISABLED_ROCK_KEYS}
            />
          </div>

          {/* Minerals Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>💎 MINERALS</h2>
            <MineralGrid
              minerals={MINERALS}
              selectedMinerals={selectedMinerals}
              onSelectionChange={handleMineralSelection}
              highlightedMinerals={highlightedMineralsFromRock}
              onMineralHover={handleMineralHover}
              disabledMinerals={DISABLED_MINERAL_KEYS}
            />
          </div>
        </div>
      </ModalOverlayContainer>
    </>
  );
};

export default MineralsSection;
