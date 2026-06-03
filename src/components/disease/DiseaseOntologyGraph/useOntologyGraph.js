import { useReducer, useEffect, useRef } from 'react';
import { setupCytoscape } from './draw';

const defaultConfigState = {
  isWeighted: true,
  depthRestriction: 0,
  et: 'all',
};

const defaultNonConfigState = {
  isRenderSuspended: false,
  isLocked: true,
  loading: true,
  error: false,
  data: [],
  meta: {},
  resetCounter: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return { ...state, ...defaultConfigState, resetCounter: state.resetCounter + 1 };
    case 'fetch_begin':
      return { ...state, loading: true, error: false };
    case 'fetch_success':
      return { ...state, error: false, data: action.payload.data, meta: action.payload.meta };
    case 'start_render':
      return { ...state, isRenderSuspended: false };
    case 'display_ready':
      return { ...state, loading: false };
    case 'set_lock_toggle':
      return { ...state, isLocked: !state.isLocked };
    case 'fetch_failure':
      return { ...state, loading: false, error: true };
    case 'set_weighted':
      return { ...state, isWeighted: action.payload };
    case 'set_evidence_filter':
      return { ...state, et: action.payload };
    case 'set_max_depth':
      return { ...state, depthRestriction: action.payload };
    case 'save_image_requested':
      return { ...state, save: 'pending', fileName: action.payload };
    case 'save_image_ready':
      return { ...state, save: 'ready', fileName: null };
    case 'save_image_failed':
      return { ...state, save: 'failed', fileName: null };
    default:
      throw new Error(`action type ${action.type} not found`);
  }
}

function fetchJsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    window[callbackName] = (data) => {
      delete window[callbackName];
      document.body.removeChild(script);
      resolve(data);
    };
    script.onerror = () => {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP request failed'));
    };
    script.src = url + '&jsonp=' + callbackName;
    document.body.appendChild(script);
  });
}

let jsonpCounter = 0;

export default function useOntologyGraph({ focusTermId }) {
  const containerElement = useRef();
  const eventHandlersRef = useRef({});
  const [state, dispatch] = useReducer(reducer, {
    ...defaultConfigState,
    ...defaultNonConfigState,
  });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { data, isRenderSuspended, isLocked, isWeighted, depthRestriction, save, fileName, et, resetCounter } = state;

  useEffect(() => {
    let didCancel = false;
    dispatch({ type: 'fetch_begin' });

    const callbackName = 'jsonCallbackDisease' + (++jsonpCounter);
    const params = new URLSearchParams({
      action: 'annotSummaryJsonp',
      showControlsFlag: '0',
      fakeRootFlag: '0',
      filterForLcaFlag: '1',
      filterLongestFlag: '1',
      maxNodes: '0',
      focusTermId,
      datatype: 'Disease',
      maxDepth: String(depthRestriction),
      radio_etd: `radio_etd_${et}`,
      callback: callbackName,
    });

    const url = `https://wobr.caltech.edu/~azurebrd/cgi-bin/soba.cgi?${params}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      if (!didCancel) {
        const result = data.elements;
        dispatch({
          type: 'fetch_success',
          payload: {
            data: [...result.nodes, ...result.edges],
            meta: result.meta,
          },
        });
      }
    };

    script.onerror = () => {
      cleanup();
      if (!didCancel) {
        dispatch({ type: 'fetch_failure' });
      }
    };

    script.src = url;
    document.body.appendChild(script);

    return () => {
      didCancel = true;
      cleanup();
    };
  }, [focusTermId, depthRestriction, et, resetCounter]);

  useEffect(() => {
    if (!isRenderSuspended) {
      eventHandlersRef.current = setupCytoscape(containerElement.current, data, {
        onReady: () => dispatch({ type: 'display_ready' }),
        isWeighted,
        isLocked: stateRef.current.isLocked,
      });
    }
    return () => {
      const { handleCleanup } = eventHandlersRef.current;
      if (handleCleanup) handleCleanup();
    };
  }, [data, isWeighted, isRenderSuspended]);

  useEffect(() => {
    const { handleLock } = eventHandlersRef.current;
    if (handleLock) handleLock(isLocked);
  }, [isLocked]);

  useEffect(() => {
    if (save === 'pending') {
      const { handleExport } = eventHandlersRef.current;
      if (handleExport) {
        handleExport({ scale: 5 })
          .then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'disease-graph.png';
            a.click();
            URL.revokeObjectURL(url);
          })
          .then(() => dispatch({ type: 'save_image_ready' }))
          .catch(() => dispatch({ type: 'save_image_failed' }));
      }
    }
  }, [save, fileName]);

  return [state, dispatch, containerElement];
}
