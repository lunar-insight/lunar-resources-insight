import React, { useState } from 'react';
import './SidebarNavigation.scss';
import { Tabs, TabList, Tab, TabPanel, Button } from 'react-aria-components';
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
  selectionColor?: string;
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
  '--selection-color'?: string;
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

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  height,
  backgroundColor = '#232935',
  iconColor = '#85a2af',
  hoverColor = '#324049',
  selectionColor = '#2b353e',
  useGradient = false,
  gradientColor1 = '#000',
  gradientColor2 = '#fff',
  gradientColorDegreeDirection = 0,
  useInsetShadow = true,
  insetShadowColor = '#000',
  insetShadowBlur = 12,
  withText = true,
  textColor = '#b6bbc1',
  fontSize = 12,

  // SectionContainer props
  sectionContainerHeight,
  sectionContainerBackgroundColor = '#232935',
  sectionContainerUseGradient = true,
  sectionContainerGradientColor1 = '#232935',
  sectionContainerGradientColor2 = '#2b353e',
  sectionContainerGradientAngle = 90,
  //children,
}) => {

  const [visiblePanels, setVisiblePanels] = useState<{ [key: string]: boolean }>(
    icons.reduce((acc, icon) => {
      acc[icon.id] = true; // Initially, all TabPanel are visible
      return acc;
    }, {})
  );

  const [activeTab, setActiveTab] = useState<string>(icons[0].id); // Init with first TabPanel open as default

  const handleSelectionChange = (key: string) => {
    // Update active TabPanel
    setActiveTab(key);
    // Visibility reinitialization of every TabPanel except the active TabPanel
    setVisiblePanels({
      ...icons.reduce((acc, icon) => ({ ...acc, [icon.id]: false }), {}),
      [key]: true,
    });
  };

  const togglePanelVisibility = (id: string) => {
    setVisiblePanels(prevState => ({
      ...prevState,
      [id]: !prevState[id]
    }));
  };

  const containerStyle: ExtendedCSSProperties = {
    '--hover-color': hoverColor,
    '--selection-color': selectionColor,
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
    <Tabs 
      orientation="vertical" 
      className="sidebar-navigation"
      selectedKey={activeTab}
      onSelectionChange={handleSelectionChange}
    >
      <TabList className="sidebar-navigation__tablist" style={sidebarStyle}>
        {icons.map((icon) => (
            <Tab
              key={icon.id}
              id={icon.id}
              className={`
                sidebar-navigation__tablist__icon-container 
                ${useInsetShadow ? 'use-inset-shadow' : ''}
                ${activeTab === icon.id && visiblePanels[icon.id] ? 'selected-and-visible' : ''}
              `}
              style={containerStyle}
            >
              <div
                key={icon.id}
                className="sidebar-navigation__tablist__icon-container__click-handler"
              >
                <div className="sidebar-navigation__tablist__icon-container__click-handler__icon">
                  <i
                    className="icon material-symbols-outlined"
                    style={{ color: iconColor }}
                  >
                    {icon.name}
                  </i>
                </div>
                {withText && (
                  <span 
                    className={`sidebar-navigation__tablist__icon-container__click-handler__label ${withText ? 'font-light' : ''}`}
                    style={{ ...fontSizeStyle, color: textColor }}
                  >
                    {icon.label}
                  </span>
                )}
              </div>
            </Tab>
        ))}
      </TabList>

      {icons.map((icon) => (
          <TabPanel 
            key={icon.id} 
            id={icon.id} 
            className="sidebar-navigation__section-container" 
            style={{
              ...sectionContainerStyle,
              display: visiblePanels[icon.id] ? 'flex' : 'none',
            }}
          >
            <div className="sidebar-navigation__section-container__header">
              <Button 
                className="sidebar-navigation__section-container__header__back-button"
                onPress={() => togglePanelVisibility(icon.id)}
                >
                <i
                  className="icon material-symbols-outlined"
                >
                  left_panel_close
                </i>
              </Button>
            </div>
            {/* The Gap and Padding in the div are for the automatic spacing when adding BoxContentContainer inside the TabPanel */}
            <div style={{ padding: '1rem', gap: '1rem' }}>
            </div>
          </TabPanel>
      ))}
    </Tabs>
  )
}

export default SidebarNavigation;