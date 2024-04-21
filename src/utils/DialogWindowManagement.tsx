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

  /**
   * Opens the dialog with the specified title, or creates a new one if it doesn't exist.
   * @param {string} title - The title of the dialog to open.
   * @param {React.ReactNode} content - The content of the dialog (only used when creating a new dialog).
   */
  const openDialog = (title: string, content?: React.ReactNode) => {
    setDialogs(prevDialogs => {
      const existingDialogs = prevDialogs.find(dialog => dialog.title === title);
      if (existingDialogs) {
        return prevDialogs.map(dialog =>
          dialog.title === title ? { ...dialog, isOpen: true } : dialog
        );
      } else {
        return [...prevDialogs, { isOpen: true, title, content }];
      }
    });
  };

  /**
   * Closes the dialog with the specified title.
   * @param {string} title - The title of the dialog to close.
   */
  const closeDialog = (title: string) => {
    setDialogs(prevDialogs =>
      prevDialogs.map(dialog =>
        dialog.title === title ? { ...dialog, isOpen: false } : dialog
      )
    );
  };

  /**
   * Checks if the dialog with the specified title is currently open.
   * @param {string} title - The title of the dialog to check. 
   * @returns {boolean} - True if the dialog is open, false otherwise.
   */
  const isDialogOpen = (title: string) => {
    return dialogs.some(dialog => dialog.title === title && dialog.isOpen);
  };

  /**
   * Renders the given dialog component.
   * @param {Dialog} dialog - The dialog object to render.
   * @returns {JSX.Element} - The rendered dialog component.
   */
  const renderDialog = (dialog: Dialog) => (
    <DraggableContentContainer
      key={dialog.title}
      title={dialog.title}
      isOpen={dialog.isOpen}
      onClose={() => closeDialog(dialog.title)}
      boundaryRef={boundaryRef}
    >
      {dialog.content}
    </DraggableContentContainer>
  );

  return {
    dialogs,
    openDialog,
    closeDialog,
    renderDialog,
    isDialogOpen,
  };
};