import React from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import type { PopoverContent } from 'services/inspector/inspectorStatistics';
import styles from './StatPopover.module.scss';

interface StatPopoverProps {
  content: PopoverContent;
  /** Accessible name of the trigger. */
  label: string;
  /** Hover text of the trigger. */
  tooltip?: string;
  /** Shown below the title; the popover takes a fixed width to hold it. */
  chart?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A data mark that explains itself on press: a title, an optional chart, then
 * label and value lines, or one sentence for a fact without a value, and an
 * optional note.
 */
export const StatPopover: React.FC<StatPopoverProps> = ({ content, label, tooltip, chart, className, style, children }) => {
  const trigger = (
    <Button aria-label={label} className={className} style={style}>
      {children}
    </Button>
  );

  return (
    <DialogTrigger>
      {tooltip ? (
        <TooltipTrigger delay={400}>
          {trigger}
          <ButtonTooltip placement="top">{tooltip}</ButtonTooltip>
        </TooltipTrigger>
      ) : trigger}
      <Popover className={`${styles.popover} ${chart ? styles.withChart : ''}`} placement="bottom">
        <Dialog className={styles.dialog}>
          <Heading slot="title" className={styles.title}>{content.title}</Heading>
          {chart}
          {content.lines.length > 0 && (
            <dl className={styles.lines}>
              {content.lines.map(([term, value]) => (
                <React.Fragment key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
          {content.sentence && <p className={styles.sentence}>{content.sentence}</p>}
          {content.note && <p className={`${styles.sentence} ${styles.note}`}>{content.note}</p>}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
