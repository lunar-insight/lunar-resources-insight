import React, { useState, useMemo } from 'react';
import styles from './MineralsSection.module.scss';
import { Button, Selection } from 'react-aria-components';
import ModalOverlayContainer from '../../layout/ModalOverlayContainer/ModalOverlayContainer';
import { useZIndex } from '../../../utils/ZIndexProvider';
import { RockGrid } from './RockGrid';
import { MineralGrid } from './MineralGrid';
import { ROCKS, MINERALS } from './data';

const MineralsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { registerModal, unregisterModal } = useZIndex();

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

  const handleRockSelection = (keys: Selection) => {
    setSelectedRocks(keys);
  };

  const handleMineralSelection = (keys: Selection) => {
    setSelectedMinerals(keys);
  };

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
                className={styles.legendRectangle}
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '2px solid rgba(59, 130, 246, 0.6)',
                }}
              ></span>
              <span>Selected</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendRectangle}
                style={{
                  backgroundColor: 'rgba(251, 146, 60, 0.2)',
                  border: '2px solid rgba(251, 146, 60, 0.7)',
                }}
              ></span>
              <span>Highlighted</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendRectangle}
                style={{
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  border: '2px solid rgba(147, 51, 234, 0.7)',
                }}
              ></span>
              <span>Selected + Highlighted</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.badgeMini} style={{ backgroundColor: 'rgba(16, 185, 129, 0.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                🗺️
              </span>
              <span>Map + Ground</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.badgeMini} style={{ backgroundColor: 'rgba(245, 158, 11, 0.55)', color: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                📍
              </span>
              <span>Ground only</span>
            </div>
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
            />
          </div>
        </div>
      </ModalOverlayContainer>
    </>
  );
};

export default MineralsSection;
