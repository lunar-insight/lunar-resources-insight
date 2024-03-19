import React, { useState } from 'react';
import { DraggableContentContainer } from './../../layout/DraggableContentContainer/DraggableContentContainer';

const SectionNavigation = ({ boundaryRef }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => setIsOpen(true);
  const closeDialog = () => setIsOpen (false);

  return (
    <div>
      <button onClick={openDialog}>Open Dialog</button>
      <DraggableContentContainer
        title="Dialog title"
        isOpen={isOpen}
        onClose={closeDialog}
        boundaryRef={boundaryRef}
      >
        Dialog content goes here.
      </DraggableContentContainer>
    </div>
  )
}

export default SectionNavigation;