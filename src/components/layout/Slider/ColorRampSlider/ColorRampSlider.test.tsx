import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerProvider } from  'utils/context/LayerContext';
import { ViewerProvider } from 'utils/context/ViewerContext';
import { ColorRampSlider } from './ColorRampSlider'

jest.mock('utils/context/LayerContext', () => ({
  useLayerContext: () => ({
    updateRampValues: jest.fn(),
    viewer: {
      imageryLayers: {
        get: jest.fn()
      }
    }
  }),
  LayerProvider: ({ children }) => <div>{children}</div>
}));

jest.mock('utils/context/ViewerContext', () => ({
  ViewerProvider: ({ children }) => <div>{children}</div>,
  useViewer: () => ({
    viewer: null,
    setViewer: jest.fn()
  })
}))

describe('ColorRampSlider integration with GeoServer', () => {
  it('updates layer visualization when slider values change', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ViewerProvider>
        <LayerProvider>
          <ColorRampSlider
            label="Test Range"
            defaultValue={[0, 10]}
            minValue={0}
            maxValue={100}
            step={1}
            thumbLabels={['min', 'max']}
            onChange={onChange}
          />
        </LayerProvider>
      </ViewerProvider>
    );

    const minInput = screen.getByRole('textbox', { name: /min/i });
    await user.clear(minInput);
    await user.type(minInput, '5');
    await user.tab() // Trigger blur

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([5, 10])
    });
  });

  // it('updates values when moving slider thumbs', async () => {
  //   const user = userEvent.setup();
  //   const onChange = jest.fn();

  //   render(
  //     <ViewerProvider>
  //       <LayerProvider>
  //         <ColorRampSlider
  //           label="Test Range"
  //           defaultValue={[0, 10]}
  //           minValue={0}
  //           maxValue={100}
  //           step={1}
  //           thumbLabels={['min', 'max']}
  //           onChange={onChange}
  //         />
  //       </LayerProvider>
  //     </ViewerProvider>
  //   );

  //   const minThumb = screen.getByRole('slider', { name: /min/i });
  //   const maxThumb = screen.getByRole('slider', { name: /max/i });

  //   await user.click(minThumb);
  //   // await user.tab();
  //   await user.keyboard('{ArrowRight}');

  //   await waitFor(() => {
  //     expect(onChange).toHaveBeenCalledWith([1, 10]);
  //   });

  //   await user.click(maxThumb);
  //   // await user.tab();
  //   await user.keyboard('[ArrowLeft]');

  //   await waitFor(() => {
  //     expect(onChange).toHaveBeenCalledWith([1, 9]);
  //   });
  // });
});