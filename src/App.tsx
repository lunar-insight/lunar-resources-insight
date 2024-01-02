import React, { FC } from 'react';
import SidebarNavigation from './components/layout/navigation/SidebarNavigation/SidebarNavigation';
import './components/layout/navigation/SidebarNavigation/SidebarNavigation.scss'

const App: FC = () => (
  <div style={{ 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <SidebarNavigation />
    <h1>Lunar Resources Insight</h1>
  </div>
);

export default App;