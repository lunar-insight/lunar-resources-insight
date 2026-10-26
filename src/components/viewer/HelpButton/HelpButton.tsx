import React from 'react';
import { Dialog, DialogTrigger, Heading, Popover, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';
import styles from './HelpButton.module.scss';

interface Gesture {
  action: string;
  input: string;
  image: string;
}

// Cesium's illustrations, served from its static assets.
const imageUrl = (name: string) => `${CESIUM_BASE_URL}/Widgets/Images/NavigationHelp/${name}.svg`;

const MOUSE: Gesture[] = [
  { action: 'Pan view', input: 'Left click + drag', image: 'MouseLeft' },
  { action: 'Zoom view', input: 'Right click + drag, or mouse wheel scroll', image: 'MouseRight' },
  { action: 'Rotate view', input: 'Middle click + drag, or Ctrl + left/right click + drag', image: 'MouseMiddle' },
];

const TOUCH: Gesture[] = [
  { action: 'Pan view', input: 'One finger drag', image: 'TouchDrag' },
  { action: 'Zoom view', input: 'Two finger pinch', image: 'TouchZoom' },
  { action: 'Tilt view', input: 'Two finger drag, same direction', image: 'TouchTilt' },
  { action: 'Rotate view', input: 'Two finger drag, opposite direction', image: 'TouchRotate' },
];

const GestureList: React.FC<{ gestures: Gesture[] }> = ({ gestures }) => (
  <ul className={styles.gestures}>
    {gestures.map(({ action, input, image }) => (
      <li key={action} className={styles.gesture}>
        <img className={styles.image} src={imageUrl(image)} alt="" />
        <div>
          <div className={styles.action}>{action}</div>
          <div className={styles.input}>{input}</div>
        </div>
      </li>
    ))}
  </ul>
);

const HelpButton: React.FC = () => (
  <DialogTrigger>
    <ViewerIconButton
      icon="help"
      ariaLabel="Show navigation help"
      tooltipText="Show navigation help"
      tooltipPlacement="bottom"
    />
    <Popover className={styles.popover} placement="bottom end">
      <Dialog className={styles.dialog}>
        <Heading slot="title" className={styles.title}>Navigation</Heading>
        <Tabs>
          <TabList aria-label="Input device" className={styles.tabs}>
            <Tab id="mouse" className={styles.tab}>Mouse</Tab>
            <Tab id="touch" className={styles.tab}>Touch</Tab>
          </TabList>
          <TabPanel id="mouse"><GestureList gestures={MOUSE} /></TabPanel>
          <TabPanel id="touch"><GestureList gestures={TOUCH} /></TabPanel>
        </Tabs>
      </Dialog>
    </Popover>
  </DialogTrigger>
);

export default HelpButton;
