import React from 'react';
import { useSidebarContext } from '../../../utils/context/SidebarContext';
import CloseButton from '../Button/CloseButton/CloseButton';
import styles from './Sidebar.module.scss';

interface SidebarProps {
  width?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ width = 400 }) => {
  const {isSidebarOpen, sidebarContent, closeSidebar } = useSidebarContext();

  return (
    <div
      className={`${styles.sidebar} ${isSidebarOpen ? styles.open : styles.closed}`}
      style={{ width: `${width}px` }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Layer Management</h3>
        <CloseButton
          onPress={closeSidebar}
          className={styles.closeButton}
        />
      </div>

      <div className={styles.content}>
        {sidebarContent}
      </div>
    </div>
  );
};

export default Sidebar;