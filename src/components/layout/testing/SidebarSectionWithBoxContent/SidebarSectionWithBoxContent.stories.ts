import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarSectionWithBoxContent from './SidebarSectionWithBoxContent';
import './SidebarSectionWithBoxContent.scss';
import { theme } from 'theme';
import { SidebarSectionContainerProps } from '../../navigation/SidebarSectionContainer/SidebarSectionContainer';
import { BoxContentContainerProps } from  '../../BoxContentContainer/BoxContentContainer';

interface SidebarSectionWithBoxContentStoryProps {
  sidebarProps: SidebarSectionContainerProps;
  boxContentProps: BoxContentContainerProps;
}

const meta: Meta = {
  title: 'Components/Layout/Testing/SidebarSectionWithBoxContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  component: SidebarSectionWithBoxContent,
  argTypes: {
    'sidebarProps.backgroundColor': { control: 'color' },
    'boxContentProps.backgroundColor': { control: 'color' },
  },
};

export default meta;

export const Default: StoryObj<SidebarSectionWithBoxContentStoryProps> = {
  args: {
    sidebarProps: {
      backgroundColor: theme.color.primary,
    },
    boxContentProps: {
      backgroundColor: theme.color.secondary,
    },
  },
};