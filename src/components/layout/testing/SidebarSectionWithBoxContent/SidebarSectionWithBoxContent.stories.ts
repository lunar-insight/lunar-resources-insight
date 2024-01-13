import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarSectionWithBoxContent from './SidebarSectionWithBoxContent';
import './SidebarSectionWithBoxContent.scss';
import { theme } from 'theme';
import { SidebarSectionContainer } from '../../navigation/SidebarSectionContainer/SidebarSectionContainer';

const meta: Meta = {
  title: 'Components/Layout/Navigation/SidebarSectionWithBoxContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  component: SidebarSectionWithBoxContent,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarSectionWithBoxContent> = {
  args: {
    ...SidebarSectionContainer.defaultProps,
  }
};