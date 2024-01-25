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
    useGradient: { control: 'boolean' },
    gradientColor1: { control: 'color' },
    gradientColor2: { control: 'color' },
    gradientAngle: { control: { type: 'range', min: 0, max: 360, step: 1 } },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarSectionContainer> = {
  args: {
    backgroundColor: theme.color.primary,
    useGradient: true,
    gradientColor1: theme.color.primary,
    gradientColor2: theme.color.neutral,
    gradientAngle: 90,
  },
};