import React from 'react';
import { Button, Dialog, DialogTrigger, Popover, ToggleButton } from 'react-aria-components';
import styles from './ScannerButton.module.scss';
import { useScannerContext } from 'utils/context/ScannerContext';

interface ScannerToggleRowProps {
  icon: string;
  label: string;
  isSelected: boolean;
  onChange: (val: boolean) => void;
}

const ScannerToggleRow: React.FC<ScannerToggleRowProps> = ({ icon, label, isSelected, onChange }) => (
  <ToggleButton
    isSelected={isSelected}
    onChange={onChange}
    className={styles.toggleRow}
    aria-label={label}
  >
    <span className={`material-symbols-outlined ${styles.rowIcon}`}>{icon}</span>
    <span className={styles.rowLabel}>{label}</span>
    {isSelected && (
      <span className={`material-symbols-outlined ${styles.checkmark}`}>check</span>
    )}
  </ToggleButton>
);

const ScannerButton: React.FC = () => {
  const {
    showElementScanner, toggleElementScanner,
    showCompoundScanner, toggleCompoundScanner,
    showDerivedIndexScanner, toggleDerivedIndexScanner,
    anyScannerOpen,
  } = useScannerContext();

  return (
    <DialogTrigger>
      <Button
        aria-label="Scanner"
        className={styles.scannerButton}
        data-selected={anyScannerOpen || undefined}
      >
        <span className={`material-symbols-outlined ${styles.icon}`}>search_insights</span>
        <span className={styles.label}>Scanner</span>
      </Button>
      <Popover className={styles.popover} placement="bottom start">
        <Dialog className={styles.dialog}>
          <ScannerToggleRow
            icon="scatter_plot"
            label="Chemical Elements"
            isSelected={showElementScanner}
            onChange={toggleElementScanner}
          />
          <ScannerToggleRow
            icon="join"
            label="Compound"
            isSelected={showCompoundScanner}
            onChange={toggleCompoundScanner}
          />
          <ScannerToggleRow
            icon="calculate"
            label="Derived Index"
            isSelected={showDerivedIndexScanner}
            onChange={toggleDerivedIndexScanner}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};

export default ScannerButton;
