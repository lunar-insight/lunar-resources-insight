import React, { useState, Fragment, useEffect } from 'react';
import { Button } from 'react-aria-components';
import './SectionNavigation.scss';
import ChemicalElementsSection from '../ChemicalElementSection/ChemicalElementsSection';
import { useDialogContext } from '../../../utils/DialogWindowManagement';
import { pointValueService } from '../../../services/PointValueService';
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl';

interface Icon {
  id: string;
  name: string;
  label: string;
  dialogTitle: string;
  dialogContent: React.ReactNode | (() => React.ReactNode);
}

const dialogsData = [
  /*
    id: Code-related selector.
    name: icon name on the icon library.
    label: text on the sidebar navigation.
    dialogTitle: Title of the dialog.
    dialogContent: related imported React element.
  */
  { 
    id: 'home-dialog', 
    name: 'home', 
    label: 'Home', 
    dialogTitle: 'Home Dialog', 
    dialogContent: 'Home dialog content goes here.' 
  },
  { 
    id: 'geospatial-layer-dialog', 
    name: 'layers', 
    label: 'Layers',
    dialogTitle: 'Geospatial Layers', 
    dialogContent: 'Geospatial Layers dialog content goes here.'
  },
  { 
    id: 'mineral-layer-dialog', 
    name: 'landslide', 
    label: 'Minerals',
    dialogTitle: 'Minerals Dialog', 
    dialogContent: 'Minerals dialog content goes here.'
  },
  { 
    id: 'element-layer-dialog', 
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
    id: 'analysis-dialog', 
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
    id: 'viewer-option-dialog', 
    name: 'tune', 
    label: 'Viewer',
    dialogTitle: 'Viewer Option', 
    dialogContent: 'Viewer Option dialog content goes here.'
  },
  { 
    id: 'application-setting-dialog', 
    name: 'settings', 
    label: 'Settings',
    dialogTitle: 'Application Settings', 
    dialogContent: 'Settings dialog content goes here.'
  }
];

export const dialogs = dialogsData.map(({ id, dialogTitle, dialogContent }) => ({
  id,
  isOpen: false,
  title: dialogTitle,
  content: dialogContent,
}));

const SectionNavigation = () => {

  const [isHovered, setIsHovered] = useState(false);

  const { openDialog, closeDialog, isDialogOpen } = useDialogContext();

  useMouseTrackingControl(isHovered, 'section-navigation');

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const IconButton = ({ icon, label, id, isActive }) => (
    <Button 
      onPress={isActive ? () => closeDialog(id) : () => openDialog(id)} 
      className={`section-navigation__icon-container ${isActive ? 'section-navigation__icon-container__is-active' : ''}`}
    >  
      <i className="material-symbols-outlined section-navigation__icon-container__icon">{icon}</i>
      <span className="section-navigation__icon-container__label">{label}</span>
    </Button>
  );

  return (
    <div 
      className='section-navigation'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {dialogsData.map((icon) => (
        <Fragment key={icon.id}>
          <IconButton
            icon={icon.name}
            label={icon.label}
            id={icon.id}
            isActive={isDialogOpen(icon.id)}
          />
        </Fragment>
      ))}
    </div>
  )
}

export default SectionNavigation;