interface Color {
  primary: string;
  secondary: string;
  tertiary: string;
  quartenary: string;
  error: string;
  neutral: string;
  neutralVariant: string;
}

export const theme: { color: Color } = {
  color: {
    primary: '#232935', // dark color
    secondary: '#85a2af', // light color
    tertiary: '#97a5ab', // light color
    quartenary: '#324049', // dark color #2f3c46
    error: '#ff5449', // red
    neutral: '#2b353e', // dark color
    neutralVariant: '#b6bbc1', // light color
  },
};

/*
    Color code:
  
    #232935 , #2b353e (dark color)
    #85a2af , #97a5ab , #b6bbc1 (light color) - darker to lighter
*/