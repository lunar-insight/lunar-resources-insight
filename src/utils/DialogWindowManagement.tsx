import React, { useState } from 'react';
import { DraggableContentContainer } from '../components/layout/DraggableContentContainer/DraggableContentContainer';
import { useBoundaryRef } from '../components/reference/BoundaryRefProvider';

interface Dialog {
  isOpen: boolean;
  title: string;
  content: React.ReactNode;
}

export const useDialogWindowManagement = ( initialDialogs: Dialog[]) => {
  const [dialogs, setDialogs] = useState(initialDialogs);
  const boundaryRef = useBoundaryRef();

  const createDialog = (title: string, content: React.ReactNode): Dialog => ({
    isOpen: false,
    title,
    content,
  });

  const openDialog = (index: number) => {
    const newDialogs = [...dialogs];
    newDialogs[index].isOpen = true;
    setDialogs(newDialogs);
  };

  const closeDialog = (index: number) => {
    const newDialogs = [...dialogs];
    newDialogs[index].isOpen = false;
    setDialogs(newDialogs);
  };

  const renderDialog = (dialog: Dialog, index: number) => (
    <DraggableContentContainer
      key={dialog.title}
      title={dialog.title}
      isOpen={dialog.isOpen}
      onClose={() => closeDialog(index)}
      boundaryRef={boundaryRef}
    >
      {dialog.content}
    </DraggableContentContainer>
  );

  return {
    dialogs,
    createDialog,
    openDialog,
    closeDialog,
    renderDialog,
  };
};