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
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A data mark that explains itself on press: a title, then label and value
 * lines, or one sentence for a fact without a value.
 */
export const StatPopover: React.FC<StatPopoverProps> = ({ content, label, tooltip, className, style, children }) => {
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
      <Popover className={styles.popover} placement="bottom">
        <Dialog className={styles.dialog}>
          <Heading slot="title" className={styles.title}>{content.title}</Heading>
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
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
