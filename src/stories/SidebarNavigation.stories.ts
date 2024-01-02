// TODO : gradient, inner shadow hover, gradient direction ..
import type { Meta, StoryObj } from '@storybook/react';
import SidebarNavigation from './SidebarNavigation';
import './SidebarNavigation.scss';

const meta: Meta = {
  title: 'Components/SidebarNavigation',
  tags: ['autodocs'],
  parameters: {
    zoom: '50%'
  },
  component: SidebarNavigation,
  argTypes: {
    backgroundColor: { control: 'color' },
    iconColor: { control: 'color' },
    hoverColor: { control: 'color' },
    useGradient: { control: 'boolean' },
    gradientColor1: { control: 'color', description: 'Used when useGradient is true' },
    gradientColor2: { control: 'color', description: 'Used when useGradient is true' },
    gradientColorDegreeDirection: { control: { type: 'range', min: 0, max: 360, step: 1 }, description: 'Used when useGradient is true' },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarNavigation> = {
  args: {
    backgroundColor: '#ffffff',
    iconColor: '#000',
    hoverColor: '#666',
    useGradient: false,
  },
};