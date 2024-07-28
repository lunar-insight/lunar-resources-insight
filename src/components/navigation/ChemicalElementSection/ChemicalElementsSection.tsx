import React, { useState } from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from './../../layout/ModalOverlayContainer/ModalOverlayContainer';
import PeriodicTable from '../submenu/PeriodicTable/PeriodicTable'

const ChemicalElementsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenPeriodicTable = () => {
    setIsModalOpen(true);
  };

  const handleClosePeriodicTable = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Button 
        className="chemical-section__open-periodic-table-button"
        onPress={handleOpenPeriodicTable}  
      >
        Periodic Table
      </Button>
      <ModalOverlayContainer
        isOpen={isModalOpen}
        onOpenChange={handleClosePeriodicTable}
        title="Periodic Table of Elements"
      >
        <PeriodicTable />
      </ModalOverlayContainer>
    </>
  );
};

export default ChemicalElementsSection;