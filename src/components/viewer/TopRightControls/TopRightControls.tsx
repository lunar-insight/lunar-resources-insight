import React from 'react';
import HomeButton from '../HomeButton/HomeButton';
import HelpButton from '../HelpButton/HelpButton';
import styles from './TopRightControls.module.scss';

const TopRightControls: React.FC = () => {
  return (
    <div className={styles.topRightControls}>
      <HomeButton />
      <HelpButton />
    </div>
  );
};

export default TopRightControls;
