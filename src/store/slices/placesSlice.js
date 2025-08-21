// FIXED: src/store/slices/placesSlice.js
// Complete fix for non-serializable data including photos
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  suggestions: [],
  searchHistory: [],
  selectedPlace: null,
  markers: [] // Only store serializable marker data
};

// 🔧 Helper function to serialize geometry completely
function serializeGeometry(geometry) {
  if (!geometry) return null;
  
  const serialized = {};
  
  // Serialize location
  if (geometry.location) {
    const loc = geometry.location;
    serialized.location = {
      lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
      lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng
    };
  }
  
  // 🔥 CRITICAL: Serialize viewport to prevent Redux errors
  if (geometry.viewport) {
    const viewport = geometry.viewport;
    try {
      if (viewport.getNorthEast && viewport.getSouthWest) {
        const ne = viewport.getNorthEast();
        const sw = viewport.getSouthWest();
        
        serialized.viewport = {
          northeast: {
            lat: typeof ne.lat === 'function' ? ne.lat() : ne.lat,
            lng: typeof ne.lng === 'function' ? ne.lng() : ne.lng
          },
          southwest: {
            lat: typeof sw.lat === 'function' ? sw.lat() : sw.lat,
            lng: typeof sw.lng === 'function' ? sw.lng() : sw.lng
          }
        };
      } else if (typeof viewport === 'object' && viewport.north !== undefined) {
        // Handle plain object viewport
        serialized.viewport = {
          northeast: { lat: viewport.north, lng: viewport.east },
          southwest: { lat: viewport.south, lng: viewport.west }
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not serialize viewport:', error);
      // Don't include viewport if serialization fails
    }
  }
  
  // Serialize bounds if present
  if (geometry.bounds) {
    const bounds = geometry.bounds;
    try {
      if (bounds.getNorthEast && bounds.getSouthWest) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        serialized.bounds = {
          northeast: {
            lat: typeof ne.lat === 'function' ? ne.lat() : ne.lat,
            lng: typeof ne.lng === 'function' ? ne.lng() : ne.lng
          },
          southwest: {
            lat: typeof sw.lat === 'function' ? sw.lat() : sw.lat,
            lng: typeof sw.lng === 'function' ? sw.lng() : sw.lng
          }
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not serialize bounds:', error);
    }
  }
  
  return serialized;
}

// 🔧 Helper function to serialize place object completely
function serializePlace(place) {
  if (!place) return null;
  
  // Start with basic place data
  const serialized = {
    place_id: place.place_id,
    name: place.name,
    description: place.description,
    formatted_address: place.formatted_address,
    types: place.types || [],
    rating: place.rating,
    user_ratings_total: place.user_ratings_total
  };
  
  // 🔥 CRITICAL FIX: Serialize photos to remove getUrl functions
  if (place.photos && Array.isArray(place.photos)) {
    serialized.photos = place.photos.slice(0, 3).map((photo, index) => {
      if (photo && typeof photo === 'object') {
        // Only store basic photo data, remove functions
        return {
          id: `photo_${place.place_id || 'unknown'}_${index}`,
          width: photo.width || 400,
          height: photo.height || 300,
          html_attributions: Array.isArray(photo.html_attributions) ? photo.html_attributions : []
          // Removed getUrl function and photo_reference as they're not serializable
        };
      }
      return null;
    }).filter(Boolean);
  } else {
    serialized.photos = [];
  }
  
  // Serialize geometry completely
  if (place.geometry) {
    serialized.geometry = serializeGeometry(place.geometry);
  }
  
  // Handle any additional properties safely
  Object.keys(place).forEach(key => {
    // Skip already processed properties
    if (['place_id', 'name', 'description', 'formatted_address', 'types', 'rating', 'user_ratings_total', 'photos', 'geometry'].includes(key)) {
      return;
    }
    
    const value = place[key];
    if (value !== null && value !== undefined) {
      if (typeof value === 'function') {
        console.warn(`⚠️ Skipping function property: ${key}`);
      } else if (typeof value === 'object' && value.constructor && 
                 !['Object', 'Array', 'Date', 'String', 'Number', 'Boolean'].includes(value.constructor.name)) {
        console.warn(`⚠️ Skipping non-serializable object: ${key}`, value.constructor.name);
      } else {
        serialized[key] = value;
      }
    }
  });
  
  return serialized;
}

const placesSlice = createSlice({
  name: 'places',
  initialState,
  reducers: {
    searchPlacesRequest: (state, action) => {
      // Saga handles this
    },
    
    searchPlacesSuccess: (state, action) => {
      // Ensure all suggestions are serialized
      const serializedSuggestions = action.payload.map(place => serializePlace(place));
      state.suggestions = serializedSuggestions;
    },
    
    searchPlacesFailure: (state, action) => {
      state.suggestions = [];
    },
    
    selectPlace: (state, action) => {
      const payload = action.payload;
      
      // Handle null/clear selection
      if (!payload) {
        state.selectedPlace = null;
        state.suggestions = [];
        return;
      }
      
      let place;
      if (payload && typeof payload === 'object') {
        place = payload.place || payload;
      } else {
        console.warn('⚠️ Invalid selectPlace payload:', payload);
        return;
      }
      
      // 🔥 CRITICAL: Completely serialize the place including photos
      const serializedPlace = serializePlace(place);
      
      if (serializedPlace) {
        state.selectedPlace = serializedPlace;
        console.log('✅ placesSlice: Stored fully serialized place:', {
          name: serializedPlace.name,
          hasLocation: !!serializedPlace.geometry?.location,
          hasViewport: !!serializedPlace.geometry?.viewport,
          photoCount: serializedPlace.photos?.length || 0
        });
      } else {
        console.warn('⚠️ Failed to serialize place:', place);
        state.selectedPlace = null;
      }
      
      state.suggestions = [];
    },
    
    addToSearchHistory: (state, action) => {
      const { query, place, timestamp } = action.payload;
      
      if (!query || !place) {
        console.warn('⚠️ Invalid search history data:', { query, place });
        return;
      }
      
      // 🔥 CRITICAL: Fully serialize place before storing in history including photos
      const serializedPlace = serializePlace(place);
      
      if (!serializedPlace) {
        console.warn('⚠️ Failed to serialize place for history:', place);
        return;
      }
      
      const historyItem = {
        id: Date.now().toString(),
        query: query.trim(),
        place: serializedPlace, // Completely serialized including photos
        timestamp: timestamp || new Date().toISOString()
      };
      
      // Remove existing entry for same place
      const existingIndex = state.searchHistory.findIndex(
        item => item.place.place_id === serializedPlace.place_id
      );
      
      if (existingIndex >= 0) {
        state.searchHistory.splice(existingIndex, 1);
      }
      
      // Add to beginning of history
      state.searchHistory.unshift(historyItem);
      
      // Keep history manageable (max 20 items)
      if (state.searchHistory.length > 20) {
        state.searchHistory = state.searchHistory.slice(0, 20);
      }
      
      console.log('✅ placesSlice: Added serialized place to history:', {
        name: serializedPlace.name,
        historyLength: state.searchHistory.length,
        photoCount: serializedPlace.photos?.length || 0
      });
    },
    
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    
    addMarkerData: (state, action) => {
      const { id, position, title } = action.payload;
      
      // Only store serializable marker data
      if (position && typeof position.lat === 'number' && typeof position.lng === 'number') {
        state.markers.push({
          id: id || Date.now().toString(),
          position: {
            lat: position.lat,
            lng: position.lng
          },
          title: title || 'Marker'
        });
      } else {
        console.warn('⚠️ Invalid marker position:', position);
      }
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
  addMarkerData,
  clearMarkers,
  clearSuggestions
} = placesSlice.actions;

export default placesSlice.reducer;