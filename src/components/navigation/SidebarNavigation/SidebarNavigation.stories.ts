import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SidebarNavigation from './SidebarNavigation';
import './SidebarNavigation.scss';
import { theme } from 'theme';

const meta: Meta = {
  title: 'Navigation/SidebarNavigation',
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
    useInsetShadow: { control: 'boolean' },
    insetShadowColor: { control: 'color', description: 'Used when useInsetShadow is true' },
    insetShadowBlur: { control: { type: 'range', min: 0, max: 100, step: 1 }, description: 'Used when useInsetShadow is true' },
    withText: { control: 'boolean', description: 'Show text with the icon' },
    textColor: { control: 'color', description: 'Text color for the WithText version' },
    fontSize: { control: { type: 'range', min: 1, max: 30, step: 1 }, description: 'Font size for the WithText version' },

    // sectionContainer argsTypes
    sectionContainerBackgroundColor: { control: 'color' },
    sectionContainerUseGradient: { control: 'boolean' },
    sectionContainerGradientColor1: { control: 'color' },
    sectionContainerGradientColor2: { control: 'color' },
    sectionContainerGradientAngle: { control: { type: 'range', min: 0, max: 360, step: 1 } },
  },
};

export default meta;

export const Default: StoryObj<typeof SidebarNavigation> = {
  args: {
    backgroundColor: theme.color.primary,
    iconColor: theme.color.secondary,
    hoverColor: theme.color.neutral,
    useGradient: false,
    gradientColor1: undefined,
    gradientColor2: undefined,
    gradientColorDegreeDirection: 0,
    useInsetShadow: true,
    insetShadowColor: '#000',
    insetShadowBlur: 12, // In pixels
    withText: false,
    textColor: theme.color.neutralVariant,
    fontSize: 12,

    // sectionContainer args
    sectionContainerBackgroundColor: theme.color.primary,
    sectionContainerUseGradient: true,
    sectionContainerGradientColor1: theme.color.primary,
    sectionContainerGradientColor2: theme.color.neutral,
    sectionContainerGradientAngle: 90,
  },
};

export const WithText: StoryObj<typeof SidebarNavigation> = {
  args: {
    ...Default.args,
    withText: true,
  },
  decorators: [
    (Story, context) => {
      return React.createElement(
        'div',
        {
          className : 'font-light',
          style: { fontSize: `${context.args.fontSize}px`}
        },
        Story()
      );
    }
  ]
};