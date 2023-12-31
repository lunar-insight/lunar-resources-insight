import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarNavigation from './SidebarNavigation';
import './SidebarNavigation.scss';

const meta: Meta = {
  title: 'Components/SidebarNavigation',
  component: SidebarNavigation,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarNavigation> = {
  args: {
    backgroundColor: '#ffffff'
  },
};