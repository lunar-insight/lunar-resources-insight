import { createPortal } from 'react-dom';
import { ReactNode, useEffect, useState } from 'react';

interface PortalProps {
  children: ReactNode;
  containerId?: string;
}

export const Portal: React.FC<PortalProps> = ({
  children,
  containerId = 'portal-root'
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let element = document.getElementById(containerId);

    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
    }

    setContainer(element);

    return () => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, [containerId]);

  if (!container) return null;

  return createPortal(children, container);
};