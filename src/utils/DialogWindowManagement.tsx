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
   * Creates a new dialog object with the given title and content.
   * @param {string} title - The title of the dialog
   * @param {React.ReactNode} content - The content of the dialog.
   * @returns {Dialog} - The created dialog object. 
   */
  const createDialog = (title: string, content: React.ReactNode): Dialog => ({
    isOpen: false,
    title,
    content,
  });

  /**
   * Opens the dialog with the specified title.
   * @param {string} title - The title of the dialog to open. 
   */
  const openDialog = (title: string) => {
    const newDialogs = dialogs.map(dialog =>
      dialog.title === title ? { ...dialog, isOpen: true } : dialog
    );
    setDialogs(newDialogs);
  };

  /**
   * Closes the dialog with the specified title.
   * @param {string} title - The title of the dialog to close.
   */
  const closeDialog = (title: string) => {
    const newDialogs = dialogs.map(dialog =>
      dialog.title === title ? { ...dialog, isOpen: false } : dialog
    );
    setDialogs(newDialogs);
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
    createDialog,
    openDialog,
    closeDialog,
    renderDialog,
    isDialogOpen,
  };
};