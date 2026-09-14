import React, { useState, useMemo, useCallback } from 'react';
import styles from './MineralsSection.module.scss';
import { Button, Selection } from 'react-aria-components';
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
  const { addLayer, removeLayer } = useLayerContext();

  // Hover state for bidirectional highlighting
  const [hoveredRockId, setHoveredRockId] = useState<string | null>(null);
  const [hoveredMineralId, setHoveredMineralId] = useState<string | null>(null);

  // Selection state
  const [selectedRocks, setSelectedRocks] = useState<Selection>(new Set());
  const [selectedMinerals, setSelectedMinerals] = useState<Selection>(new Set());

  // Compute minerals to highlight when rock is hovered
  const highlightedMineralsFromRock = useMemo(() => {
    if (!hoveredRockId) return new Set<string>();
    const rock = ROCKS.find((r) => r.id === hoveredRockId);
    return new Set(rock?.composition || []);
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

  const handleRockSelection = useCallback((keys: Selection) => {
    setSelectedRocks(prevSelectedRocks => {
      const oldRocks = new Set(prevSelectedRocks);
      const newRocks = new Set(keys);

      // Add newly selected rocks with metadata
      newRocks.forEach(rockId => {
        if (!oldRocks.has(rockId)) {
          const rock = ROCKS.find(r => r.id === rockId);
          if (rock) {
            addLayer(rockId as string, {
              displayName: rock.name,
              category: 'rock'
            });
          }
        }
      });

      // Remove deselected rocks
      oldRocks.forEach(rockId => {
        if (!newRocks.has(rockId)) {
          removeLayer(rockId as string);
        }
      });

      return keys;
    });
  }, [addLayer, removeLayer]);

  const handleMineralSelection = useCallback((keys: Selection) => {
    setSelectedMinerals(prevSelectedMinerals => {
      const oldMinerals = new Set(prevSelectedMinerals);
      const newMinerals = new Set(keys);

      // A mineral with map layers loads those; one without is a ground-data-only entry
      newMinerals.forEach(mineralId => {
        if (!oldMinerals.has(mineralId)) {
          const mineral = MINERALS.find(m => m.id === mineralId);
          if (mineral) {
            const layerIds = mapLayerIds(mineral.id);
            if (layerIds.length > 0) {
              layerIds.forEach(layerId => addLayer(layerId));
            } else {
              addLayer(mineralId as string, {
                displayName: mineral.name,
                category: 'mineral'
              });
            }
          }
        }
      });

      oldMinerals.forEach(mineralId => {
        if (!newMinerals.has(mineralId)) {
          const layerIds = mapLayerIds(mineralId as string);
          if (layerIds.length > 0) {
            layerIds.forEach(layerId => removeLayer(layerId));
          } else {
            removeLayer(mineralId as string);
          }
        }
      });

      return keys;
    });
  }, [addLayer, removeLayer]);

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
