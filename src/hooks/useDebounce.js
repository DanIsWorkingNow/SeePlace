// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for managing places-related state and actions using Redux.
// The hook provides functions to search for places, select a place, clear suggestions, and manage search history.
// It uses Redux Toolkit's `useSelector` and `useDispatch` hooks to interact with the Redux store.
// The hook returns the current state of suggestions, search history, selected place, markers, and loading/error states,
// along with the functions to perform actions related to places.   
import { useCallback, useRef } from 'react';

export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef();

  return useCallback((...args) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};