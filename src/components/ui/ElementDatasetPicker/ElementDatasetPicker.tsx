import React from 'react';
import { Button, DialogTrigger, Popover, Dialog, Heading, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './ElementDatasetPicker.module.scss';

export interface DatasetCandidate {
  layerName: string;
  label: string;
  valueLabel: string;
}

interface ElementDatasetPickerProps {
  symbolLabel: string;
  candidates: DatasetCandidate[];
  activeLayerName: string;
  onSelect: (layerName: string) => void;
  style?: React.CSSProperties;
}

export const ElementDatasetPicker: React.FC<ElementDatasetPickerProps> = ({
  symbolLabel,
  candidates,
  activeLayerName,
  onSelect,
  style,
}) => {
  const active = candidates.find(c => c.layerName === activeLayerName) ?? candidates[0];

  return (
    <div className={styles.wrapper} style={style}>
      <DialogTrigger>
        <TooltipTrigger>
          <Button className={styles.trigger} aria-label={`${symbolLabel}: choose which dataset feeds this bar`}>
            <span className="material-symbols-outlined">layers</span>
          </Button>
          <ButtonTooltip placement="top">
            {`${symbolLabel}: ${active.label} (1 of ${candidates.length} datasets). Click to change.`}
          </ButtonTooltip>
        </TooltipTrigger>
        <Popover placement="top" className={styles.popover}>
          <Dialog className={styles.dialog}>
            <Heading className={styles.title}>{`${symbolLabel} · choose dataset`}</Heading>
            <p className={styles.subtitle}>
              Multiple selected layers report this element. Pick which one feeds this bar.
            </p>
            <div className={styles.pillGroup}>
              {candidates.map(candidate => (
                <Button
                  key={candidate.layerName}
                  className={`${styles.pill}${candidate.layerName === active.layerName ? ` ${styles.active}` : ''}`}
                  aria-label={`${candidate.label}, ${candidate.valueLabel}${candidate.layerName === active.layerName ? ', active' : ''}`}
                  onPress={() => onSelect(candidate.layerName)}
                >
                  <span className={styles.pillMain} aria-hidden="true">
                    <span className={styles.pillLabel}>{candidate.label}</span>
                    <span className={styles.pillValue}>{candidate.valueLabel}</span>
                  </span>
                  <span className={`material-symbols-outlined ${styles.check}`} aria-hidden="true">check</span>
                </Button>
              ))}
            </div>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
};
