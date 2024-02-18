import React, { FC } from 'react';
import MainPage from './components/pages/MainPage/MainPage';
import './components/pages/MainPage/MainPage.scss'
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