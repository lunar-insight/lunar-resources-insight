import React, { useRef } from 'react';
import { useViewer } from '../../../utils/context/ViewerContext';
import ViewerIconButton from '../../layout/Button/ViewerIconButton/ViewerIconButton';

const HelpButton: React.FC = () => {
  const { viewer } = useViewer();
  const isTogglingRef = useRef(false);

  const handleHelpClick = () => {
    if (!viewer) return;
    if (isTogglingRef.current) return;

    if (viewer.navigationHelpButton && viewer.navigationHelpButton.viewModel) {
      isTogglingRef.current = true;

      // Check if the help panel is actually visible in the DOM
      const helpContainer = document.querySelector('.cesium-navigation-help');
      const isActuallyVisible = helpContainer &&
        window.getComputedStyle(helpContainer).display !== 'none' &&
        window.getComputedStyle(helpContainer).visibility !== 'hidden';

      // Toggle based on actual visibility, not observable value
      const newState = !isActuallyVisible;

      // Use setTimeout to ensure the state change happens after any other events
      setTimeout(() => {
        const viewModel = viewer.navigationHelpButton.viewModel;

        // Set new state (call as function for Knockout observable)
        if (typeof viewModel.showInstructions === 'function') {
          (viewModel.showInstructions as any)(newState);
        } else {
          (viewModel as any).showInstructions = newState;
        }

        // Allow toggling again after a short delay
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 100);
      }, 0);
    }
  };

  return (
    <ViewerIconButton
      icon="help"
      ariaLabel="Show navigation help"
      tooltipText="Show navigation help"
      tooltipPlacement="bottom"
      onPress={handleHelpClick}
    />
  );
};

export default HelpButton;
