import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarSectionWithBoxContent from './SidebarSectionWithBoxContent';
import './SidebarSectionWithBoxContent.scss';
//import { theme } from 'theme';

const meta: Meta = {
  title: 'Components/Layout/Testing/SidebarSectionWithBoxContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  component: SidebarSectionWithBoxContent,
};

export default meta;

export const Default: StoryObj<typeof SidebarSectionWithBoxContent> = {
};
