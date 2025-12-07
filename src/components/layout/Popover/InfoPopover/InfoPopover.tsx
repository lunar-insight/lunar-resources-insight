import React from 'react';
import { Popover, Dialog, Heading } from 'react-aria-components';
import styles from './InfoPopover.module.scss';

interface InfoPopoverProps {
  title: string;
  body: string;
}

export const InfoPopover: React.FC<InfoPopoverProps> = ({ title, body }) => {
  return (
    <Popover className={styles.infoPopover} placement="bottom">
      <Dialog className={styles.dialog}>
        <Heading className={styles.title}>{title}</Heading>
        <p className={styles.body}>{body}</p>
      </Dialog>
    </Popover>
  );
};
