import React from 'react';
import HelpButton from '../HelpButton/HelpButton';
import styles from './TopRightControls.module.scss';

const TopRightControls: React.FC = () => {
  return (
    <div className={styles.topRightControls}>
      <HelpButton />
    </div>
  );
};

export default TopRightControls;
