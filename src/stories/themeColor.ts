interface Theme {
  color: {
    primary: string;
    secondary: string;
    tertiary: string;
    error: string;
    neutral: string;
    neutralVariant: string;
  };
}

export const theme: Theme = {
  color: {
    primary: '#232935', // dark color
    secondary: '#85a2af', // light color
    tertiary: '#97a5ab', // light color
    error: '#ff5449', // red
    neutral: '#2b353e', // dark color
    neutralVariant: '#b6bbc1', // light color
  },
};