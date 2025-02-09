export type ColorSchemeType = '9colors' | '11colors';

export interface StyleConfig {
  colors: string[];
  type: ColorSchemeType;
  min?: number;
  max?: number;
}