import React, { FC } from 'react';
import MainPage from './components/pages/MainPage';
import './components/layout/pages/MainPage/MainPage.scss'
// TODO: add storybook page directly
const App: FC = () => (
  <div style={{ 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start'
  }}>
    <MainPage />
  </div>
);

export default App;