import React, { FC } from 'react';
import MainPage from './pages/MainPage/MainPage';
import './pages/MainPage/MainPage.scss'
// TODO: add storybook page directly
const App: FC = () => (
  <div style={{ 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  }}>
    <MainPage />
  </div>
);

export default App;