import React, { createContext, useContext, useState } from 'react';
import { DraggableContentContainer } from '../components/layout/DraggableContentContainer/DraggableContentContainer';
import { useBoundaryRef } from '../components/reference/BoundaryRefProvider';

interface Dialog {
  id: string;
  isOpen: boolean;
  title: string;
  content: React.ReactNode | (() => React.ReactNode);
}

interface DialogContextValue {
  dialogsState: Dialog[];
  openDialog: (id: string, content?: React.ReactNode) => void;
  closeDialog: (id: string) => void;
  isDialogOpen: (id: string) => boolean;
  renderDialog: (dialog: Dialog) => React.ReactElement;
  addDialog: (dialog: Dialog) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return context;
}

const DialogRenderer: React.FC = () => {
  const { dialogsState, renderDialog } = useDialogContext();

  return (
    <>
       {dialogsState.map((dialog) => renderDialog(dialog))}
    </>
  );
};

const DialogProvider: React.FC<{ children: React.ReactNode; dialogs: Dialog[] }> = ({ children, dialogs }) => {
  const [dialogsState, setDialogsState] = useState<Dialog[]>(dialogs);
  const boundaryRef = useBoundaryRef();

  const openDialog = (id: string, content?: React.ReactNode) => {
    setDialogsState(prevDialogs => {
      const existingDialogs = prevDialogs.find(dialog => dialog.id === id);
      if (existingDialogs) {
        return prevDialogs.map(dialog =>
          dialog.id === id ? { ...dialog, isOpen: true } : dialog
        );
      } else {
        const newDialog: Dialog = { id, isOpen: true, title: '', content: content || ''};
        return [...prevDialogs, newDialog];
      }
    });
  };

  const closeDialog = (id: string) => {
    setDialogsState(prevDialogs =>
      prevDialogs.map(dialog =>
        dialog.id === id ? { ...dialog, isOpen: false } : dialog
      )
    );
  };

  const isDialogOpen = (id: string) => {
    return dialogsState.some(dialog => dialog.id === id && dialog.isOpen);
  };

  const renderDialog = (dialog: Dialog): React.ReactElement => (
    <DraggableContentContainer
      key={dialog.id}
      id={dialog.id}
      title={dialog.title}
      isOpen={dialog.isOpen}
      onClose={() => closeDialog(dialog.id)}
      boundaryRef={boundaryRef}
    >
      {typeof dialog.content === 'function' ? dialog.content() : dialog.content}
    </DraggableContentContainer>
  );

  const addDialog = (dialog: Dialog) => {
    setDialogsState(prevDialogs => {
      const existingDialog = prevDialogs.find(d => d.id === dialog.id);
      if (existingDialog) {
        return prevDialogs;
      } else {
        return [...prevDialogs, { ...dialog, isOpen: false }];
      }
    });
  };

  return (
    <DialogContext.Provider value={{ 
      dialogsState, 
      openDialog, 
      closeDialog, 
      isDialogOpen, 
      renderDialog, 
      addDialog
    }}>
      {children}
    </DialogContext.Provider>
  );
};

export { useDialogContext, DialogProvider, DialogRenderer };