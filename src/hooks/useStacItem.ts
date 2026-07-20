import { useEffect, useState } from 'react';
import { stacService, StacItem } from 'services/StacService';

export const useStacItem = (stacPath?: string): StacItem | null => {
  const [item, setItem] = useState<StacItem | null>(null);

  useEffect(() => {
    if (!stacPath) {
      setItem(null);
      return;
    }

    let cancelled = false;
    stacService.fetchStacItem(stacPath).then((result) => {
      if (!cancelled) {
        setItem(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [stacPath]);

  return item;
};
