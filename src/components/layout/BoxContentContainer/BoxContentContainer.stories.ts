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
    height: { control: { type: 'range', min: 0, max: 1000, step: 1 } },
    width: { control: { type: 'range', min: 0, max: 1000, step: 1 } },
    borderRadius: { control: { type: 'range', min: 0, max: 200, step: 1 } },
    flexible: { control: 'boolean', description: 'The "flexible" props can be used directly for the BoxContentContainer to fill 100% available parent container space for width and height.'},
    backgroundColor: { control: 'color' },
    useGradient: { control: 'boolean' },
    gradientColor1: { control: 'color' },
    gradientColor2: { control: 'color' },
    gradientAngle: { control: { type: 'range', min: 0, max: 360, step: 1 } },
    useShadow: { control: 'boolean' },
    shadowValues: { control: 'text' },
    shadowBlur: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    shadowColor: { control: 'color' },
  },
};

export default meta;

export const Default: StoryObj<typeof BoxContentContainer> = {
  args: {
    height: 400,
    width: 250,
    borderRadius: 20,
    flexible: false,
    backgroundColor: theme.color.secondary,
    useGradient: true,
    gradientColor1: theme.color.secondary,
    gradientColor2: theme.color.neutralVariant,
    gradientAngle: 45,
    useShadow: true,
    shadowValues: '0px 0px',
    shadowBlur: 16,
    shadowColor: '#000'
  }
};