/* TODO:
- add transparency boolean
- add transparency slider
*/

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarSectionContainer from './SidebarSectionContainer';
import './SidebarSectionContainer.scss';
import { theme } from 'theme';

const meta: Meta = {
  title: 'Components/Layout/Navigation/SidebarSectionContainer',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  component: SidebarSectionContainer,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarSectionContainer> = {
  args: {
    backgroundColor: theme.color.primary,
  },
};