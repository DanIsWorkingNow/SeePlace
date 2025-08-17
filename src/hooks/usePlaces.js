// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for managing places-related state and actions using Redux.
// The hook provides functions to search for places, select a place, clear suggestions, and manage search history.
// It uses Redux Toolkit's `useSelector` and `useDispatch` hooks to interact with the Redux store.
// The hook returns the current state of suggestions, search history, selected place, markers, and loading/error states,
// along with the functions to perform actions related to places.   
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  searchPlacesRequest, 
  selectPlace as selectPlaceAction,
  clearSuggestions,
  clearSearchHistory 
} from '../store/slices/placesSlice';

export const usePlaces = () => {
  const dispatch = useDispatch();
  
  const {
    suggestions,
    searchHistory,
    selectedPlace,
    markers
  } = useSelector(state => state.places);
  
  const {
    searchLoading,
    mapLoading,
    error
  } = useSelector(state => state.ui);

  const searchPlaces = useCallback((query) => {
    dispatch(searchPlacesRequest({ query }));
  }, [dispatch]);

  const selectPlace = useCallback((place, query = '') => {
    dispatch(selectPlaceAction({ place, query }));
  }, [dispatch]);

  const clearSuggestionsList = useCallback(() => {
    dispatch(clearSuggestions());
  }, [dispatch]);

  const clearHistory = useCallback(() => {
    dispatch(clearSearchHistory());
  }, [dispatch]);

  return {
    suggestions,
    searchHistory,
    selectedPlace,
    markers,
    searchLoading,
    mapLoading,
    error,
    searchPlaces,
    selectPlace,
    clearSuggestions: clearSuggestionsList,
    clearHistory
  };
};