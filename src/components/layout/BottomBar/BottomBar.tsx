import React from 'react';
import styles from './BottomBar.module.scss';

export interface BottomBarProps {
  children?: React.ReactNode;
  className?: string;
}

const BottomBar: React.FC<BottomBarProps> = ({ children, className = '' }) => {
  return (
    <div className={`${styles.bottomBar} ${className}`}>
      {children}
    </div>
  );
};

export default BottomBar;