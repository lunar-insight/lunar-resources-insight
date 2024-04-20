import React, { useState, Fragment } from 'react';
import { DraggableContentContainer } from './../../layout/DraggableContentContainer/DraggableContentContainer';
import { Button } from 'react-aria-components';
import './SectionNavigation.scss';
import ChemicalElementsSection from '../ChemicalElementSection/ChemicalElementsSection';
import { useDialogWindowManagement } from '../../../utils/DialogWindowManagement';

interface Icon {
  id: string;
  name: string;
  label: string;
}

const SectionNavigation = () => {

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

  const initialDialogs = icons.map(({ dialogTitle, dialogContent }) => ({
    isOpen: false,
    title: dialogTitle,
    content: dialogContent,
  }));

  const { dialogs, openDialog, closeDialog, renderDialog, isDialogOpen } = useDialogWindowManagement(
    initialDialogs,
  );

  const dialogMap = dialogs.reduce((map, dialog) => {
    map[dialog.title] = dialog;
    return map;
  }, {});

  const IconButton = ({ icon, label, title, content, onClose, isActive }) => (
    <Button 
      onPress={isActive ? onClose : () => openDialog(title)} 
      className={`section-navigation__icon-container ${isActive ? 'section-navigation__icon-container__is-active' : ''}`}
    >  
      <i className="material-symbols-outlined section-navigation__icon-container__icon">{icon}</i>
      <span className="section-navigation__icon-container__label">{label}</span>
    </Button>
  );

  return (
    <div className='section-navigation'>
      {icons.map((icon) => (
        <Fragment key={icon.id}>
          <IconButton
            icon={icon.name}
            label={icon.label}
            title={icon.dialogTitle}
            content={icon.dialogContent}
            onClose={() => closeDialog(icon.dialogTitle)}
            isActive={isDialogOpen(icon.dialogTitle)}
          />
          {isDialogOpen(icon.dialogTitle) && renderDialog(dialogMap[icon.dialogTitle])}
        </Fragment>
      ))}
    </div>
  )
}

export default SectionNavigation;