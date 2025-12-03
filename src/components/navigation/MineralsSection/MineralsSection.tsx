import React, { useState } from 'react';
import styles from './MineralsSection.module.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from '../../layout/ModalOverlayContainer/ModalOverlayContainer';
import { useZIndex } from '../../../utils/ZIndexProvider';

const MineralsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { registerModal, unregisterModal } = useZIndex();

  const handleOpenMinerals = () => {
    setIsModalOpen(true);
    registerModal('minerals-modal');
  };

  const handleCloseMinerals = () => {
    setIsModalOpen(false);
    unregisterModal('minerals-modal');
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
        {null}
      </ModalOverlayContainer>
    </>
  );
};

export default MineralsSection;
