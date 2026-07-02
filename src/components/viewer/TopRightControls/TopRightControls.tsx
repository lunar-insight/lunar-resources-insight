import React from 'react';
import HelpButton from '../HelpButton/HelpButton';
import LayersCatalogButton from 'components/layout/Button/LayersCatalogButton/LayersCatalogButton';
import styles from './TopRightControls.module.scss';

const TopRightControls: React.FC = () => {
  return (
    <div className={styles.topRightControls}>
      <LayersCatalogButton />
      <div className={styles.separator}></div>
      <HelpButton />
    </div>
  );
};

export default TopRightControls;
