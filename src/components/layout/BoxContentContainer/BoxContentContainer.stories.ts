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
    flexible: { control: 'boolean', description: 'The "flexible" props can be used directly for the BoxContentContainer to fill 100% width and height of the parent container.'},
  },
};

export default meta;

export const Default: StoryObj<typeof BoxContentContainer> = {
  args: {
    backgroundColor: theme.color.secondary,
    height: 8,
    width: 8,
    flexible: false,
  }
};