import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map } from 'maplibre-gl';

import { TILE_SOURCE } from './mapStyle';

type FailureState = {
  failed: boolean;
  dismissed: boolean;
  reason: string | null;
};

type MapErrorEventLike = {
  error?: {
    status?: number;
  };
  sourceId?: string;
};

export function useMapHealth() {
  const [state, setState] = useState<FailureState>({
    failed: false,
    dismissed: false,
    reason: null,
  });
  const cleanupRef = useRef<(() => void) | null>(null);
  const failedRef = useRef(state.failed);

  useEffect(() => {
    failedRef.current = state.failed;
  }, [state.failed]);

  const markFailed = useCallback((reason: string) => {
    if (failedRef.current) {
      return;
    }

    failedRef.current = true;
    cleanupRef.current?.();
    setState({
      failed: true,
      dismissed: false,
      reason,
    });
  }, []);

  const reportUnsupported = useCallback(() => {
    markFailed('The interactive map could not load, so the app switched to the list view for this page load.');
  }, [markFailed]);

  const attachMap = useCallback(
    (map: Map | null) => {
      cleanupRef.current?.();

      if (!map || failedRef.current || typeof window === 'undefined') {
        cleanupRef.current = null;
        return;
      }

      let styleSeen = map.isStyleLoaded();
      let idleSeen = map.loaded();
      let errorCount = 0;
      let active = true;

      const styleTimer = window.setTimeout(() => {
        if (!active) {
          return;
        }

        if (styleSeen || map.isStyleLoaded()) {
          styleSeen = true;
          return;
        }

        markFailed('The map style never became ready, so the app switched to the list view for this page load.');
      }, 5000);

      const idleTimer = window.setTimeout(() => {
        if (!active) {
          return;
        }

        if (idleSeen || map.loaded()) {
          idleSeen = true;
          return;
        }

        markFailed('The map tiles did not finish loading in time, so the app switched to the list view for this page load.');
      }, 15000);

      const handleStyleData = (): void => {
        styleSeen = true;
      };

      const handleIdle = (): void => {
        idleSeen = true;
      };

      const handleError = (event: MapErrorEventLike): void => {
        if (!active) {
          return;
        }

        const status = event.error?.status;
        const sourceId = event.sourceId;
        const isRelevantError =
          (typeof status === 'number' && status >= 400) || sourceId === TILE_SOURCE;

        if (!isRelevantError) {
          return;
        }

        errorCount += 1;
        if (errorCount >= 3) {
          markFailed('The map reported repeated tile errors, so the app switched to the list view for this session.');
        }
      };

      map.on('styledata', handleStyleData);
      map.on('idle', handleIdle);
      map.on('error', handleError);

      cleanupRef.current = () => {
        active = false;
        window.clearTimeout(styleTimer);
        window.clearTimeout(idleTimer);
        map.off('styledata', handleStyleData);
        map.off('idle', handleIdle);
        map.off('error', handleError);
      };
    },
    [markFailed],
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setState((current) => ({ ...current, dismissed: true }));
  }, []);

  const retryMap = useCallback(() => {
    cleanupRef.current?.();
    failedRef.current = false;
    setState({
      failed: false,
      dismissed: false,
      reason: null,
    });
  }, []);

  const bannerMessage = useMemo(() => {
    if (!state.failed || state.dismissed) {
      return null;
    }

    return state.reason;
  }, [state.dismissed, state.failed, state.reason]);

  return {
    hasFailed: state.failed,
    bannerMessage,
    dismissBanner,
    retryMap,
    attachMap,
    reportUnsupported,
  };
}
