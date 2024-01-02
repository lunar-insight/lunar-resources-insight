import React, { FC } from 'react';
import SidebarNavigation from './components/layout/navigation/SidebarNavigation/SidebarNavigation';
import './components/layout/navigation/SidebarNavigation/SidebarNavigation.scss'
// TODO: add storybook page directly
const App: FC = () => (
  <div style={{ 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start'
  }}>
    <SidebarNavigation />
    <h1>Lunar Resources Insight</h1>
  </div>
);

export default App;