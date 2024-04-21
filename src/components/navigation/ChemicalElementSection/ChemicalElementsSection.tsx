import React from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';
import { useDialogWindowManagement } from '../../../utils/DialogWindowManagement';
import PeriodicTable from '../submenu/PeriodicTable/PeriodicTable'

const ChemicalElementsSection: React.FC = () => {
  const { openDialog, renderDialog, isDialogOpen } = useDialogWindowManagement([]);

  const handleOpenPeriodicTable = () => {
    openDialog('Periodic Table', <PeriodicTable />);
  };

  return (
    <>
      <Button 
        className="chemical-section__open-periodic-table-button"
        onPress={handleOpenPeriodicTable}  
      >
        Periodic Table
      </Button>
      {isDialogOpen('Periodic Table') && renderDialog({
        isOpen: true,
        title: 'Periodic Table',
        content: <PeriodicTable />,
      })}
    </>
  );
};

export default ChemicalElementsSection;