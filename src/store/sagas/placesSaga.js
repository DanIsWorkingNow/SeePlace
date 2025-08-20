// REPLACE: src/store/sagas/placesSaga.js
// Enhanced Places Saga with FIXED payload handling for auto-pinning
import { call, put, take, takeEvery, debounce, all, fork, cancel, delay } from 'redux-saga/effects';
import {
  searchPlacesRequest,
  searchPlacesSuccess,
  searchPlacesFailure,
  selectPlace,
  addToSearchHistory,
  setMap,
  addMarker,
  clearMarkers
} from '../slices/placesSlice';
import { setSearchLoading, setMapLoading, setError } from '../slices/uiSlice';
import { googleMapsService } from '../../services/googleMapsService';

// 🎯 CORE AUTO-PINNING SAGA - FIXED payload handling
function* selectPlaceSaga(action) {
  try {
    console.log('🎯 Saga: AUTO-PINNING workflow started');
    console.log('🔍 Saga: Action payload:', action.payload);
    
    // 🛠️ FIXED: Handle both payload formats
    let place, query;
    
    if (action.payload && typeof action.payload === 'object') {
      // Check if payload has place and query properties (from autocomplete with query)
      if (action.payload.place) {
        place = action.payload.place;
        query = action.payload.query;
        console.log('📝 Saga: Using structured payload with query');
      } else {
        // Payload is the place object directly (from demo or direct dispatch)
        place = action.payload;
        query = null;
        console.log('📝 Saga: Using direct place payload');
      }
    } else {
      console.warn('⚠️ Saga: Invalid payload format');
      return;
    }
    
    if (!place) {
      console.warn('⚠️ Saga: No place provided for selection');
      return;
    }
    
    console.log('📍 Saga: Processing place:', place.name || place.description);
    
    // Step 1: Set loading state for map updates
    yield put(setMapLoading(true));
    yield put(setError(null));
    
    // Step 2: Get detailed place information if place_id exists but no geometry
    let detailedPlace = place;
    
    if (place.place_id && (!place.geometry || !place.geometry.location)) {
      console.log('📊 Saga: Fetching detailed place information for geometry...');
      try {
        const placeDetails = yield call([googleMapsService, 'getPlaceDetails'], place.place_id);
        
        if (placeDetails && placeDetails.geometry && placeDetails.geometry.location) {
          detailedPlace = {
            ...place,
            ...placeDetails,
            // Preserve original description if available
            description: place.description || placeDetails.formatted_address
          };
          console.log('✅ Saga: Got detailed place data with geometry:', {
            lat: placeDetails.geometry.location.lat(),
            lng: placeDetails.geometry.location.lng()
          });
        } else {
          console.warn('⚠️ Saga: Place details API returned no geometry data');
        }
        
      } catch (error) {
        console.error('❌ Saga: Could not get place details:', error.message);
        yield put(setError('Could not get location details for this place'));
        return;
      }
    }
    
    // Step 3: Validate that we have location data for auto-pinning
    if (!detailedPlace.geometry || !detailedPlace.geometry.location) {
      console.warn('⚠️ Saga: Cannot auto-pin - place has no geometry data:', detailedPlace);
      yield put(setError('Selected place has no location data for mapping'));
      return;
    } else {
      // Handle both LatLng objects and plain objects
      let lat, lng;
      if (typeof detailedPlace.geometry.location.lat === 'function') {
        // Google Maps LatLng object
        lat = detailedPlace.geometry.location.lat();
        lng = detailedPlace.geometry.location.lng();
      } else {
        // Plain object
        lat = detailedPlace.geometry.location.lat;
        lng = detailedPlace.geometry.location.lng;
      }
      
      console.log('📍 Saga: Place has valid geometry for auto-pinning:', { lat, lng });
    }
    
    // Step 4: Update Redux state with selected place (triggers auto-pinning in useGoogleMaps)
    yield put(selectPlace(detailedPlace));
    console.log('📍 Saga: Place selection dispatched - auto-pinning should trigger in useGoogleMaps hook');
    
    // Step 5: Add to search history for future reference
    if (query && detailedPlace) {
      yield put(addToSearchHistory({
        query: query.trim(),
        place: detailedPlace,
        timestamp: new Date().toISOString()
      }));
      console.log('📚 Saga: Added to search history:', detailedPlace.name);
    }
    
    // Step 6: Wait a moment for map to update, then log completion
    yield delay(300);
    
    console.log('✅ Saga: AUTO-PINNING workflow completed successfully for:', detailedPlace.name);
    
  } catch (error) {
    console.error('❌ Saga: Auto-pinning workflow failed:', error);
    
    // Provide user-friendly error messages based on error type
    let userMessage = 'Failed to select place. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check configuration.';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      userMessage = 'Place details limit reached. Please try again later.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('permission')) {
      userMessage = 'API permission denied. Please check your Google Maps API setup.';
    } else if (error.message.includes('Service unavailable')) {
      userMessage = 'Google Maps service unavailable. Please try again.';
    }
    
    yield put(setError(userMessage));
    
  } finally {
    yield put(setMapLoading(false));
  }
}

// Enhanced search saga with improved debouncing and error handling
function* debouncedSearchSaga(action) {
  try {
    const { query } = action.payload;
    
    if (!query || query.trim().length < 2) {
      console.log('📝 Saga: Query too short for search, clearing results');
      yield put(searchPlacesSuccess([]));
      return;
    }
    
    console.log(`🔍 Saga: Searching for "${query.trim()}"`);
    yield put(setSearchLoading(true));
    yield put(setError(null));
    
    // Call Google Maps service with timeout protection
    const places = yield call([googleMapsService, 'searchPlaces'], query.trim());
    
    if (Array.isArray(places)) {
      yield put(searchPlacesSuccess(places));
      console.log(`✅ Saga: Found ${places.length} places for "${query}"`);
    } else {
      console.warn('⚠️ Saga: Search returned non-array result:', places);
      yield put(searchPlacesSuccess([]));
    }
    
  } catch (error) {
    console.error('❌ Saga: Search failed:', error);
    
    // Provide specific error messages
    let userMessage = 'Search failed. Please try again.';
    if (error.message.includes('quota')) {
      userMessage = 'Search quota exceeded. Please try again later.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your connection.';
    }
    
    yield put(searchPlacesFailure(error.message));
    yield put(setError(userMessage));
    yield put(searchPlacesSuccess([])); // Clear results on error
    
  } finally {
    yield put(setSearchLoading(false));
  }
}

// Advanced search flow with task cancellation to prevent overlapping searches
function* searchFlowSaga() {
  let currentSearchTask;
  
  console.log('🔄 Saga: Starting search flow watcher with task cancellation');
  
  while (true) {
    try {
      const action = yield take(searchPlacesRequest.type);
      
      // Cancel previous search if still running to prevent race conditions
      if (currentSearchTask) {
        console.log('🛑 Saga: Cancelling previous search task');
        yield cancel(currentSearchTask);
      }
      
      // Start new search task
      currentSearchTask = yield fork(debouncedSearchSaga, action);
      
    } catch (error) {
      console.error('❌ Saga: Search flow error:', error);
      // Don't break the loop - continue watching for new search requests
    }
  }
}

// Watchers for different actions
function* watchSearchPlaces() {
  console.log('👀 Saga: Starting search places watcher');
  yield fork(searchFlowSaga);
}

function* watchSelectPlace() {
  console.log('👀 Saga: Starting AUTO-PINNING place selection watcher');
  yield takeEvery(selectPlace.type, selectPlaceSaga);
}

// Optional: Watch for map updates to log auto-pinning success
function* watchMapUpdates() {
  console.log('👀 Saga: Starting map updates watcher');
  yield; // Add yield to fix generator function warning
  // This can be used to track when markers are added/removed
  // yield takeEvery([addMarker.type, clearMarkers.type], function* (action) {
  //   console.log('🗺️ Saga: Map update detected:', action.type);
  // });
}

// Root saga with comprehensive error handling
export default function* placesSaga() {
  try {
    console.log('🚀 Saga: Starting places saga with AUTO-PINNING support');
    console.log('🔧 Saga: Available watchers - search, select, map updates');
    
    // Start all watchers concurrently
    yield all([
      fork(watchSearchPlaces),
      fork(watchSelectPlace),
      fork(watchMapUpdates)
    ]);
    
  } catch (error) {
    console.error('❌ Saga: Root saga error:', error);
    // In production, you might want to dispatch a global error action here
    // yield put(setGlobalError('Application state management failed'));
  }
}

// Development helpers for debugging auto-pinning workflow
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debugAutoPinning = () => {
    console.log('🔍 Auto-Pinning Debug Info:');
    console.log('Google Maps Service available:', !!googleMapsService);
    
    if (googleMapsService) {
      try {
        console.log('Service status:', googleMapsService.getStatus ? googleMapsService.getStatus() : 'Status method not available');
        console.log('Service ready:', googleMapsService.isReady ? googleMapsService.isReady() : 'Ready method not available');
      } catch (e) {
        console.warn('Could not get service status:', e);
      }
    }
    
    // Sample place for testing auto-pinning
    const samplePlace = {
      name: 'Kuala Lumpur City Centre',
      place_id: 'ChIJiY1E1DG4zDER3DAP9EqWgS8',
      geometry: {
        location: { lat: 3.1578, lng: 101.7118 }
      },
      formatted_address: 'Kuala Lumpur City Centre, Kuala Lumpur, Malaysia',
      types: ['sublocality_level_1', 'sublocality', 'political']
    };
    
    console.log('🧪 Test auto-pinning with sample place:', samplePlace);
    console.log('💡 To test: store.dispatch(selectPlace(samplePlace))');
  };
  
  window.debugSearchWorkflow = () => {
    console.log('🔍 Search Workflow Debug:');
    console.log('💡 To test search: store.dispatch(searchPlacesRequest({ query: "petronas" }))');
  };
}