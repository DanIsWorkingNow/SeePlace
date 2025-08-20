// FIXED: src/store/slices/placesSlice.js
// Critical fix for non-serializable data issues
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  suggestions: [],
  searchHistory: [],
  selectedPlace: null,
  currentMap: null, // This will be removed - maps shouldn't be in Redux
  markers: [] // This will be simplified to avoid non-serializable data
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
    
    // 🛠️ CRITICAL FIX: Ensure only serializable data is stored
    selectPlace: (state, action) => {
      const payload = action.payload;
      
      // Handle different payload formats safely
      let place;
      if (payload && typeof payload === 'object') {
        place = payload.place || payload; // Handle both {place: x} and direct place
      } else {
        console.warn('Invalid selectPlace payload:', payload);
        return;
      }
      
      // 🔥 SERIALIZE GEOMETRY DATA to prevent Redux errors
      if (place && place.geometry && place.geometry.location) {
        const location = place.geometry.location;
        
        // Convert Google Maps LatLng object to plain object
        const serializedLocation = {
          lat: typeof location.lat === 'function' ? location.lat() : location.lat,
          lng: typeof location.lng === 'function' ? location.lng() : location.lng
        };
        
        // Create serialized place object
        const serializedPlace = {
          ...place,
          geometry: {
            ...place.geometry,
            location: serializedLocation
          }
        };
        
        state.selectedPlace = serializedPlace;
        console.log('✅ placesSlice: Stored serialized place data:', {
          name: serializedPlace.name,
          location: serializedLocation
        });
      } else {
        // Store place without geometry if no location data
        state.selectedPlace = place;
      }
      
      state.suggestions = []; // Clear suggestions after selection
    },
    
    // 🛠️ FIXED: Serialize history data
    addToSearchHistory: (state, action) => {
      const { query, place, timestamp } = action.payload;
      
      // Serialize place data before storing in history
      let serializedPlace = place;
      if (place && place.geometry && place.geometry.location) {
        const location = place.geometry.location;
        const serializedLocation = {
          lat: typeof location.lat === 'function' ? location.lat() : location.lat,
          lng: typeof location.lng === 'function' ? location.lng() : location.lng
        };
        
        serializedPlace = {
          ...place,
          geometry: {
            ...place.geometry,
            location: serializedLocation
          }
        };
      }
      
      const historyItem = {
        id: Date.now().toString(),
        query,
        place: serializedPlace,
        timestamp
      };
      
      // Remove existing entry for same place
      const existingIndex = state.searchHistory.findIndex(
        item => item.place.place_id === serializedPlace.place_id
      );
      
      if (existingIndex >= 0) {
        state.searchHistory.splice(existingIndex, 1);
      }
      
      state.searchHistory.unshift(historyItem);
      
      // Keep history manageable
      if (state.searchHistory.length > 20) {
        state.searchHistory = state.searchHistory.slice(0, 20);
      }
    },
    
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    
    // 🔥 REMOVE: Don't store map instances in Redux
    // setMap: (state, action) => {
    //   state.currentMap = action.payload; // This causes non-serializable issues
    // },
    
    // 🛠️ SIMPLIFIED: Store only marker data needed for state
    addMarkerData: (state, action) => {
      const { id, position, title } = action.payload;
      // Store only serializable marker data
      state.markers.push({
        id: id || Date.now().toString(),
        position: {
          lat: typeof position.lat === 'function' ? position.lat() : position.lat,
          lng: typeof position.lng === 'function' ? position.lng() : position.lng
        },
        title: title || 'Marker'
      });
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
  // setMap, // REMOVED - don't store map instances
  addMarkerData,
  clearMarkers,
  clearSuggestions
} = placesSlice.actions;

export default placesSlice.reducer;