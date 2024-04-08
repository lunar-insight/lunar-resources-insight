import React, { useState, Fragment } from 'react';
import { DraggableContentContainer } from './../../layout/DraggableContentContainer/DraggableContentContainer';
import { Button } from 'react-aria-components';
import './SectionNavigation.scss';
import ChemicalElementsSection from '../ChemicalElementSection/ChemicalElementsSection';

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
    /*
      id: Code-related selector.
      name: icon name on the icon library.
      label: text on the sidebar navigation.
      dialogTitle: Title of the dialog.
      dialogContent: related imported React element.
    */
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
      dialogTitle: 'Spatial Layers', 
      dialogContent: 'Layers dialog content goes here.'
    },
    { 
      id: 'MineralsDialog', 
      name: 'landslide', 
      label: 'Minerals',
      dialogTitle: 'Minerals Dialog', 
      dialogContent: 'Minerals dialog content goes here.'
    },
    { 
      id: 'ElementsDialog', 
      name: 'lab_research', 
      label: 'Elements',
      dialogTitle: 'Chemical Elements', 
      dialogContent: <ChemicalElementsSection />
    },
    /*
    { 
      id: 'ReactionDialog', 
      name: 'experiment', 
      label: 'Reaction',
      dialogTitle: 'Reaction Dialog', 
      dialogContent: 'Reaction dialog content goes here.'
    },
    */
    { 
      id: 'AnalysisDialog', 
      name: 'frame_inspect', 
      label: 'Analysis',
      dialogTitle: 'Analysis Dialog', 
      dialogContent: 'Analysis dialog content goes here.'
    }
    ,
    /*
    { 
      id: 'PluginsDialog', 
      name: 'extension', 
      label: 'Plugins',
      dialogTitle: 'Plugins Dialog', 
      dialogContent: 'Plugins dialog content goes here.'
    },
    */
    { 
      id: 'ViewerOptionDialog', 
      name: 'tune', 
      label: 'Viewer',
      dialogTitle: 'Viewer Option', 
      dialogContent: 'Viewer Option dialog content goes here.'
    },
    { 
      id: 'SettingsDialog', 
      name: 'settings', 
      label: 'Settings',
      dialogTitle: 'App Settings', 
      dialogContent: 'Settings dialog content goes here.'
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