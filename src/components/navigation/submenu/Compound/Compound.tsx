import React from "react";
import styles from './Compound.module.scss';

export interface CompoundProps {
  // Placeholder
}

const Compound: React.FC<CompoundProps> = () => {
  return (
    <div className={styles.compound}>
      <div className={styles.compoundHeader}>
        <h2>Chemical Compound</h2>
        <p>Compound selection interface</p>
      </div>
      <div className={styles.compoundContent}>
        <p>This section allow you to select and visualize chemical compounds.</p>
      </div>
    </div>
  );
};

export default Compound;