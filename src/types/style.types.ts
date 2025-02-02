export type ColorSchemeType = '9colors' | '11colors';

export interface StyleConfig {
  colors: string[];
  min?: number;
  max?: number;
  type: ColorSchemeType;
}