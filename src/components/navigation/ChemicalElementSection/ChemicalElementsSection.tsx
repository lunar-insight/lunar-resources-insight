import React from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';
import { useDialogContext } from '../../../utils/DialogWindowManagement';
import PeriodicTable from '../submenu/PeriodicTable/PeriodicTable'

const ChemicalElementsSection: React.FC = () => {
  const { openDialog, addDialog, dialogsState } = useDialogContext();

  const handleOpenPeriodicTable = () => {
    const dialogId = 'periodic-table-dialog';
    const dialogExists = dialogsState.some(d => d.id === dialogId);

    if (!dialogExists) { // Necessary check
      addDialog({
        id: dialogId,
        isOpen: false,
        title: 'Periodic Table',
        content: <PeriodicTable />,
      });
    }
    openDialog(dialogId)
  };

  return (
    
      <Button 
        className="chemical-section__open-periodic-table-button"
        onPress={handleOpenPeriodicTable}  
      >
        Periodic Table
      </Button>
  );
};

export default ChemicalElementsSection;