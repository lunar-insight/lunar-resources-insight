import React, { useState, Fragment } from 'react';
import { Button } from 'react-aria-components';
import styles from './SectionNavigation.module.scss';
import ChemicalElementsSection from '../ChemicalElementSection/ChemicalElementsSection';
import { useDialogContext } from '../../../utils/DialogWindowManagement';
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl';
import logo from 'assets/images/logo/lunar-resources-insight-logo-100x100.jpg'

interface Icon {
  id: string;
  name: string;
  label: string;
  dialogTitle: string;
  dialogContent: React.ReactNode | (() => React.ReactNode);
  type?: 'dock' | 'float';
}

const dialogsData: Icon[] = [
  /*
    id: Code-related selector.
    name: icon name on the icon library.
    label: text on the sidebar navigation.
    dialogTitle: Title of the dialog.
    dialogContent: related imported React element.
  */
  {
    id: 'layer-management-category',
    name: 'file_map_stack',
    label: 'Layers',
    dialogTitle: 'Layer Management',
    dialogContent: 'Layer Management content goes here.',
    type: 'dock'
  },
  { 
    id: 'home-dialog', 
    name: 'home', 
    label: 'Home', 
    dialogTitle: 'Home Dialog', 
    dialogContent: 'Home dialog content goes here.' 
  },
  { 
    id: 'geospatial-layer-dialog', 
    name: 'map', 
    label: 'Base Maps',
    dialogTitle: 'Base Maps', 
    dialogContent: 'Base Maps dialog content goes here.'
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
    label: 'Chemistry',
    dialogTitle: 'Chemistry', 
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

interface IconButtonProps {
  icon: string;
  label: string;
  id: string;
  isActive: boolean;
  type?: 'dock' | 'float';
}

const SectionNavigation = () => {
  const [isHovered, setIsHovered] = useState(false);
  const { openDialog, closeDialog, isDialogOpen } = useDialogContext();

  useMouseTrackingControl(isHovered, 'section-navigation');

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const IconButton = ({ icon, label, id, isActive, type = 'float' }: IconButtonProps) => {
    const buttonClasses = [
      styles.button,
      isActive && styles.active,
      type === 'dock' && styles.dock
    ].filter(Boolean).join(' ');

    return (
      <Button 
        onPress={isActive ? () => closeDialog(id) : () => openDialog(id)} 
        className={buttonClasses}
      >  
        <i className={`material-symbols-outlined ${styles.icon}`}>{icon}</i>
        <span className={styles.label}>{label}</span>
        {type === 'dock' && (
          <i className={`material-symbols-outlined ${styles.arrow}`}>chevron_right</i>
        )}
      </Button>
    );
  };

  return (
    <div 
      className={styles.navigation}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.logoContainer}>
        <img src={logo} alt="Lunar Resources Insight" className={styles.logo} />
      </div>

      {dialogsData.map((icon) => (
        <Fragment key={icon.id}>
          <IconButton
            icon={icon.name}
            label={icon.label}
            id={icon.id}
            isActive={isDialogOpen(icon.id)}
            type={icon.type}
          />
        </Fragment>
      ))}
    </div>
  );
};

export default SectionNavigation;