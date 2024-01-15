/* TODO:
- add transparency boolean
- add transparency slider
- add rounded corner boolean
- add rounded corner slider
- add acrylic material on top of sidebarSectionContainer boolean?
*/

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import BoxContentContainer from './BoxContentContainer';
import './BoxContentContainer.scss';
import { theme } from 'theme';

const meta: Meta = {
  title: 'Components/Layout/BoxContentContainer',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  component: BoxContentContainer,
  argTypes: {
    backgroundColor: { control: 'color' },
    height: { control: { type: 'range', min: 0, max: 1000, step: 1 } },
    width: { control: { type: 'range', min: 0, max: 1000, step: 1 } },
  },
};

export default meta;

export const Default: StoryObj<typeof BoxContentContainer> = {
  args: {
    backgroundColor: theme.color.secondary,
    width: 200,
    height: 400,
  }
};