// FIXED placesSaga.js - Resolves method binding issues with Redux Saga
import { 
  call, 
  put, 
  takeEvery, 
  delay, 
  take,
  cancel,
  fork,
  all
} from 'redux-saga/effects';
import { 
  searchPlacesRequest,
  searchPlacesSuccess,
  searchPlacesFailure,
  selectPlace,
  addToSearchHistory,
  clearMarkers,
  addMarker
} from '../slices/placesSlice';
import { 
  setSearchLoading, 
  setError, 
  clearError,
  setMapLoading 
} from '../slices/uiSlice';
import { googleMapsService } from '../../services/googleMapsService';

function* debouncedSearchSaga(action) {
  try {
    console.log('🔍 Saga: Starting search saga');
    yield put(setSearchLoading(true));
    yield put(clearError());
    
    // Add small delay for debouncing
    yield delay(300);
    
    const { query } = action.payload;
    console.log(`📝 Saga: Processing search query: "${query}"`);
    
    // Validate query
    if (!query || query.length < 2) {
      console.log('⚠️ Saga: Query too short, returning empty results');
      yield put(searchPlacesSuccess([]));
      return;
    }

    // Check if service is available
    if (!googleMapsService) {
      console.error('❌ Saga: googleMapsService is not available');
      throw new Error('Google Maps service is not available. Please refresh the page.');
    }

    // Debug service status (safe way)
    try {
      const serviceStatus = googleMapsService.getStatus ? googleMapsService.getStatus() : 'Status method not available';
      console.log('📊 Saga: Service status:', serviceStatus);
    } catch (statusError) {
      console.warn('⚠️ Saga: Could not get service status:', statusError.message);
    }
    
    // FIXED: Use arrow function to preserve binding context
    console.log('🌐 Saga: Calling googleMapsService.searchPlaces()');
    const places = yield call(() => googleMapsService.searchPlaces(query));
    
    console.log(`✅ Saga: Search successful, found ${places?.length || 0} places`);
    yield put(searchPlacesSuccess(places || []));
    
  } catch (error) {
    console.error('❌ Saga: Search error:', error);
    
    // Create user-friendly error message
    let userMessage = 'Search failed. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check configuration.';
    } else if (error.message.includes('quota')) {
      userMessage = 'Search limit reached. Please try again later.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('initialize')) {
      userMessage = 'Maps service initialization failed. Please refresh the page.';
    } else if (error.message.includes('getState') || error.message.includes('null')) {
      userMessage = 'Service initialization error. Refreshing the page may help.';
    }
    
    yield put(searchPlacesFailure(error.message));
    yield put(setError(userMessage));
    
  } finally {
    yield put(setSearchLoading(false));
  }
}

function* selectPlaceSaga(action) {
  try {
    console.log('🏢 Saga: Starting place selection saga');
    yield put(setMapLoading(true));
    
    const { place, query } = action.payload;
    
    if (!place || !place.place_id) {
      throw new Error('Invalid place data received');
    }

    console.log(`📍 Saga: Getting details for place: ${place.place_id}`);
    
    // Check service availability
    if (!googleMapsService) {
      throw new Error('Google Maps service is not available');
    }
    
    // FIXED: Use arrow function to preserve binding context
    let placeDetails;
    if (googleMapsService.getPlaceDetails) {
      placeDetails = yield call(() => googleMapsService.getPlaceDetails(place.place_id));
    } else {
      // If getPlaceDetails doesn't exist, use the place data we have
      placeDetails = place;
    }
    
    if (!placeDetails) {
      throw new Error('No place details received from Google API');
    }

    console.log('✅ Saga: Place details retrieved successfully');
    yield put(selectPlace(placeDetails));
    
    // Add to search history
    yield put(addToSearchHistory({
      query: query || place.description || placeDetails.name,
      place: placeDetails,
      timestamp: Date.now()
    }));
    
    // Update map with new place
    yield fork(updateMapSaga, placeDetails);
    
  } catch (error) {
    console.error('❌ Saga: Place selection error:', error);
    
    let userMessage = 'Failed to load place details. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check configuration.';
    } else if (error.message.includes('quota')) {
      userMessage = 'Place details limit reached. Please try again later.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your internet connection.';
    }
    
    yield put(setError(userMessage));
    
  } finally {
    yield put(setMapLoading(false));
  }
}

function* updateMapSaga(place) {
  try {
    console.log('🗺️ Saga: Updating map with place data');
    
    // Clear existing markers
    yield put(clearMarkers());
    
    // Add new marker if place has geometry
    if (place.geometry && place.geometry.location) {
      console.log('📍 Saga: Adding marker to map');
      yield put(addMarker({
        position: place.geometry.location,
        title: place.name || 'Selected Place',
        placeId: place.place_id
      }));
    } else {
      console.warn('⚠️ Saga: Place does not have geometry data for marker');
    }
    
  } catch (error) {
    console.error('❌ Saga: Map update error:', error);
    // Don't throw here - map update is not critical for the main flow
  }
}

function* searchFlowSaga() {
  let searchTask;
  
  console.log('🔄 Saga: Starting search flow watcher');
  
  while (true) {
    try {
      const action = yield take(searchPlacesRequest.type);
      
      // Cancel previous search if still running
      if (searchTask) {
        console.log('🛑 Saga: Cancelling previous search task');
        yield cancel(searchTask);
      }
      
      // Start new search
      searchTask = yield fork(debouncedSearchSaga, action);
      
    } catch (error) {
      console.error('❌ Saga: Search flow error:', error);
    }
  }
}

function* watchSearchPlaces() {
  console.log('👀 Saga: Starting search places watcher');
  yield fork(searchFlowSaga);
}

function* watchSelectPlace() {
  console.log('👀 Saga: Starting place selection watcher');
  yield takeEvery(selectPlace.type, selectPlaceSaga);
}

// Root saga with enhanced error handling
export default function* placesSaga() {
  try {
    console.log('🚀 Saga: Starting places saga');
    
    yield all([
      fork(watchSearchPlaces),
      fork(watchSelectPlace)
    ]);
    
  } catch (error) {
    console.error('❌ Saga: Root saga error:', error);
    // In a real app, you might want to dispatch a global error action here
  }
}

// Enhanced debug helper for saga monitoring
if (typeof window !== 'undefined') {
  window.debugPlacesSaga = () => {
    console.log('🔍 Places Saga Debug Info:');
    console.log('Service available:', !!googleMapsService);
    if (googleMapsService) {
      try {
        console.log('Service status:', googleMapsService.getStatus ? googleMapsService.getStatus() : 'Status method not available');
        console.log('Service ready:', googleMapsService.isReady ? googleMapsService.isReady() : 'Ready method not available');
      } catch (error) {
        console.log('Service debug error:', error.message);
      }
    }
  };

  window.testSagaSearch = (query = 'KLCC Malaysia') => {
    console.log(`🧪 Testing saga search flow for: "${query}"`);
    // This would require Redux store access to dispatch the action
    console.log('💡 To test saga flow, type in the search box in the UI');
  };
}