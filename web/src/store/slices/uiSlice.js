// This file is part of the Google Places Redux Saga project.
// It defines the Redux slice for managing UI-related state, such as loading indicators and error messages.
// It uses Redux Toolkit's createSlice to create a slice of the Redux store for UI state.
// The slice includes actions for setting loading states and handling errors.   
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  loading: false,
  error: null,
  searchLoading: false,
  mapLoading: false
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setSearchLoading: (state, action) => {
      state.searchLoading = action.payload;
    },
    setMapLoading: (state, action) => {
      state.mapLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  setLoading,
  setSearchLoading,
  setMapLoading,
  setError,
  clearError
} = uiSlice.actions;

export default uiSlice.reducer;