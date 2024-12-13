import { ColorSchemeType } from 'types/style.types';
import { colorbrewer } from '../utils/constants/colorbrewer.constants.js';

export const extractColorBrewerGradient = (schemeName: string): {
  colors: string[];
  type: ColorSchemeType;
} => {
  const scheme = colorbrewer[schemeName];
  if (!scheme) {
    throw new Error(`Gradient ${schemeName} not found`);
  }

  const maxClasses = Math.max(...Object.keys(scheme).map(Number));
  const colors = scheme[maxClasses];

  if (colors.length !== 9 && colors.length !== 11) {
    throw new Error(`Invalid number of colors: ${colors.length}`);
  }
  
  return {
    colors,
    type: maxClasses === 11 ? '11colors' : '9colors' as ColorSchemeType
  };
};