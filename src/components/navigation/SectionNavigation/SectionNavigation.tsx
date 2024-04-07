import React, { useState, Fragment } from 'react';
import { DraggableContentContainer } from './../../layout/DraggableContentContainer/DraggableContentContainer';
import { Button } from 'react-aria-components';
import './SectionNavigation.scss';

interface Icon {
  id: string;
  name: string;
  label: string;
}

const SectionNavigation = ({ boundaryRef }) => {

  // TODO: change content type "string" to other type when specific components will be made
  const createDialog = (title: string, content: React.ReactNode) => ({
    isOpen: false,
    title,
    content
  });

  const icons: (Icon & { dialogTitle: string; dialogContent: React.ReactNode })[] = [
    { 
      id: 'HomeDialog', 
      name: 'home', 
      label: 'Home', 
      dialogTitle: 'Home Dialog', 
      dialogContent: 'Home dialog content goes here.' 
    },
    { 
      id: 'LayersDialog', 
      name: 'layers', 
      label: 'Layers',
      dialogTitle: 'Layers Dialog', 
      dialogContent: 'Layers dialog content goes here.'
    }
  ]

  const IconButton = ({ icon, label, onPress, onClose, isActive }) => (
    <Button 
      onPress={isActive ? onClose : onPress} 
      className={`section-navigation__icon-container ${isActive ? 'section-navigation__icon-container__is-active' : ''}`}
    >  
      <i className="material-symbols-outlined section-navigation__icon-container__icon">{icon}</i>
      <span className="section-navigation__icon-container__label">{label}</span>
    </Button>
  );

  const [dialogs, setDialogs] = useState(
    icons.map(({ dialogTitle, dialogContent }) => createDialog(dialogTitle, dialogContent))
  );

  const openDialog = (index: number) => {
    const newDialogs = [...dialogs];
    newDialogs[index].isOpen = true;
    setDialogs(newDialogs);
  }

  const closeDialog = (index: number) => {
    const newDialogs = [...dialogs];
    newDialogs[index].isOpen = false;
    setDialogs(newDialogs);
  }

  return (
    <div className='section-navigation'>
      {icons.map((icon, index) => (
        <Fragment key={icon.id}>
          <IconButton
            icon={icon.name}
            label={icon.label}
            onPress={() => openDialog(index)}
            onClose={() => closeDialog(index)}
            isActive={dialogs[index].isOpen}
          />
          <DraggableContentContainer
            title={dialogs[index].title}
            isOpen={dialogs[index].isOpen}
            onClose={() => closeDialog(index)}
            boundaryRef={boundaryRef}
          >
            {dialogs[index].content}
          </DraggableContentContainer>
        </Fragment>
      ))}
    </div>
  )
}

export default SectionNavigation;