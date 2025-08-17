// This file is part of the Google Places Redux Saga project.
// It defines the Redux slice for managing places-related state, including search suggestions, history, and map markers.
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  suggestions: [],
  searchHistory: [],
  selectedPlace: null,
  currentMap: null,
  markers: []
};

const placesSlice = createSlice({
  name: 'places',
  initialState,
  reducers: {
    searchPlacesRequest: (state, action) => {
      // Saga will handle this
    },
    searchPlacesSuccess: (state, action) => {
      state.suggestions = action.payload;
    },
    searchPlacesFailure: (state, action) => {
      state.suggestions = [];
    },
    
    selectPlace: (state, action) => {
      state.selectedPlace = action.payload;
      state.suggestions = [];
    },
    
    addToSearchHistory: (state, action) => {
      const { query, place, timestamp } = action.payload;
      const historyItem = {
        id: Date.now().toString(),
        query,
        place,
        timestamp
      };
      
      const existingIndex = state.searchHistory.findIndex(
        item => item.place.place_id === place.place_id
      );
      
      if (existingIndex >= 0) {
        state.searchHistory.splice(existingIndex, 1);
      }
      
      state.searchHistory.unshift(historyItem);
      
      if (state.searchHistory.length > 20) {
        state.searchHistory = state.searchHistory.slice(0, 20);
      }
    },
    
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    
    setMap: (state, action) => {
      state.currentMap = action.payload;
    },
    
    addMarker: (state, action) => {
      state.markers.push(action.payload);
    },
    
    clearMarkers: (state) => {
      state.markers = [];
    },
    
    clearSuggestions: (state) => {
      state.suggestions = [];
    }
  }
});

export const {
  searchPlacesRequest,
  searchPlacesSuccess,
  searchPlacesFailure,
  selectPlace,
  addToSearchHistory,
  clearSearchHistory,
  setMap,
  addMarker,
  clearMarkers,
  clearSuggestions
} = placesSlice.actions;

export default placesSlice.reducer;