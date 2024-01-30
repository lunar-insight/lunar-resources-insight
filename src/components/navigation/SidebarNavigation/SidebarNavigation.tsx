import React from 'react';
import './SidebarNavigation.scss';
import { theme } from 'theme';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
//import ChemicalElementsSection from './../section/ChemicalElementsSection/ChemicalElementsSection';

interface Icon {
  id: string;
  name: string;
  label: string;
}

interface SidebarNavigationProps {
  height?: string;
  backgroundColor?: string;
  iconColor?: string;
  hoverColor?: string;
  useGradient?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientColorDegreeDirection?: number;
  useInsetShadow?: boolean;
  insetShadowColor?: string;
  insetShadowBlur?: number;
  withText?: boolean;
  textColor?: string;
  fontSize?: number;

  // SectionContainer props
  sectionContainerHeight?: string;
  sectionContainerBackgroundColor?: string;
  sectionContainerUseGradient?: boolean;
  sectionContainerGradientColor1?: string;
  sectionContainerGradientColor2?: string;
  sectionContainerGradientAngle?: number;
  //children?: React.ReactNode;
}

type ExtendedCSSProperties = React.CSSProperties & {
  '--hover-color'?: string;
  '--inset-shadow-color'?: string;
  '--inset-shadow-blur'?: string;
}

const icons: Icon[] = [
  { id: 'HomeTab', name: 'home', label: 'Home' },
  { id: 'LayersTab', name: 'layers', label: 'Layers' },
  { id: 'MineralsTab', name: 'atr', label: 'Minerals' },
  { id: 'ElementsTab', name: 'lab_research', label: 'Elements' },
  { id: 'InspectTab', name: 'frame_inspect', label: 'Inspect' },
  { id: 'SettingsTab', name: 'settings', label: 'Settings' },
  { id: 'PluginsTab', name: 'extension', label: 'Plugins' }
];

/*
const renderTabContent = (iconId: string) => {
  switch (iconId) {
    case 'ElementsTab':
      return <div>elementTab</div>;
    default:
      return <div>No content available.</div>;
  }
}
*/


const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  height,
  backgroundColor = theme.color.primary,
  iconColor = theme.color.secondary,
  hoverColor = theme.color.neutral,
  useGradient = false,
  gradientColor1 = '#000',
  gradientColor2 = '#fff',
  gradientColorDegreeDirection = 0,
  useInsetShadow = true,
  insetShadowColor = '#000',
  insetShadowBlur = 12,
  withText = true,
  textColor = theme.color.neutralVariant,
  fontSize = 12,

  // SectionContainer props
  sectionContainerHeight,
  sectionContainerBackgroundColor = theme.color.primary,
  sectionContainerUseGradient = true,
  sectionContainerGradientColor1 = theme.color.primary,
  sectionContainerGradientColor2 = theme.color.neutral,
  sectionContainerGradientAngle = 90,
  //children,
}) => {

  const containerStyle: ExtendedCSSProperties = {
    '--hover-color': hoverColor,
    '--inset-shadow-color': insetShadowColor,
    '--inset-shadow-blur': `${insetShadowBlur}px`,
  };

  const sidebarStyle: React.CSSProperties = {
    height,
    background: useGradient ? `linear-gradient(${gradientColorDegreeDirection}deg, ${gradientColor1}, ${gradientColor2})` : backgroundColor,
  }

  const fontSizeStyle: React.CSSProperties = fontSize ? { fontSize: `${fontSize}px` } : {};

  const sectionContainerStyle: React.CSSProperties = {
    height: sectionContainerHeight,
    background: sectionContainerUseGradient ? `linear-gradient(${sectionContainerGradientAngle}deg, ${sectionContainerGradientColor1}, ${sectionContainerGradientColor2})` : sectionContainerBackgroundColor,
  }

  return (
    <Tabs orientation="vertical" className="sidebar-navigation">
      <TabList className="sidebar-navigation__tablist" style={sidebarStyle}>
        {icons.map((icon) => (
          <Tab
            key={icon.id}
            id={icon.id}
            className={`sidebar-navigation__tablist__icon-container ${useInsetShadow ? 'use-inset-shadow' : ''}`}
            style={containerStyle}
          >
            <div className="sidebar-navigation__tablist__icon-container__icon">
              <i
                className="icon material-symbols-outlined"
                style={{ color: iconColor }}
              >
                {icon.name}
              </i>
            </div>
            {withText && (
              <span 
                className={`sidebar-navigation__tablist__icon-container__label ${withText ? 'font-light' : ''}`}
                style={{ ...fontSizeStyle, color: textColor }}
              >
                {icon.label}
              </span>
            )}
          </Tab>
        ))}
      </TabList>

      {icons.map((icon) => (
        <TabPanel key={icon.id} id={icon.id} className="sidebar-navigation__section-container" style={sectionContainerStyle}>
          {/* The Gap and Padding in the div are for the automatic spacing when adding BoxContentContainer inside the TabPanel */}
          <div style={{ padding: '15px', gap: '15px' }}>
            {/* {renderTabContent(icon.id)} */}
          </div>
        </TabPanel>
      ))}
    </Tabs>
  )
}

export default SidebarNavigation;