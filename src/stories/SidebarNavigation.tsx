import React from 'react';
import './SidebarNavigation.scss';

interface Icon {
  name: string;
  label: string;
}

interface SidebarNavigationProps {
  backgroundColor?: string;
}

const icons: Icon[] = [
  { name: 'home', label: 'Home' },
  { name: 'layers', label: 'Layers' },
  { name: 'atr', label: 'Minerals' },
  { name: 'lab_research', label: 'Elements' },
  { name: 'frame_inspect', label: 'Inspect' },
  { name: 'settings', label: 'Settings' },
  { name: 'extension', label: 'Plugins' }
];

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({backgroundColor = 'initial' }) => {
  return (
    <div className="sidebar" style={{ backgroundColor }}>
      {icons.map(icon => (
        <div key={icon.label} className="icon material-symbols-outlined">
          {icon.name}
        </div>
      ))}
    </div>
  );
};

export default SidebarNavigation;