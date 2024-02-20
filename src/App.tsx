import React, { FC } from 'react';
import MainPage from './pages/MainPage/MainPage';
import './pages/MainPage/MainPage.scss'
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