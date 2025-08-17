// This file is part of the Google Places Redux Saga project.
// It defines the Redux slice for managing places-related state, including search suggestions, history, and map markers.    
    
// Enhanced placesSaga.js - Better error handling and debugging
// Enhanced placesSaga.js - Complete Fixed Version
// This version fixes all import issues and null reference errors

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

// Import the service with multiple fallback methods
let googleMapsService;

try {
  // Method 1: Standard ES6 import
  const serviceModule = await import('../../services/googleMapsService');
  googleMapsService = serviceModule.googleMapsService || serviceModule.default;
  console.log('✅ Saga: GoogleMapsService imported successfully (ES6)');
} catch (importError) {
  console.log('⚠️ Saga: ES6 import failed, trying require...');
  
  try {
    // Method 2: CommonJS require
    const serviceModule = require('../../services/googleMapsService');
    googleMapsService = serviceModule.googleMapsService || serviceModule.default;
    console.log('✅ Saga: GoogleMapsService imported successfully (CommonJS)');
  } catch (requireError) {
    console.error('❌ Saga: Both import methods failed:', { importError, requireError });
    console.log('💡 Saga: Will try to access service from window object at runtime');
  }
}

// Robust service getter with multiple fallback strategies
function getServiceInstance() {
  // Strategy 1: Use imported service
  if (googleMapsService && typeof googleMapsService.searchPlaces === 'function') {
    console.log('✅ Saga: Using imported service instance');
    return googleMapsService;
  }
  
  // Strategy 2: Get from window (debugging/global access)
  if (typeof window !== 'undefined' && window.googleMapsService) {
    console.log('✅ Saga: Using window.googleMapsService instance');
    return window.googleMapsService;
  }
  
  // Strategy 3: Try to find service in global scope
  if (typeof global !== 'undefined' && global.googleMapsService) {
    console.log('✅ Saga: Using global.googleMapsService instance');
    return global.googleMapsService;
  }
  
  console.error('❌ Saga: No GoogleMapsService instance available');
  console.log('💡 Saga: Available global objects:', Object.keys(window || {}));
  return null;
}

// Validate service instance has required methods
function validateServiceInstance(service) {
  if (!service) {
    return { valid: false, error: 'Service instance is null or undefined' };
  }
  
  if (typeof service.searchPlaces !== 'function') {
    return { 
      valid: false, 
      error: 'Service missing searchPlaces method',
      availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(service))
    };
  }
  
  if (typeof service.getPlaceDetails !== 'function') {
    return { 
      valid: false, 
      error: 'Service missing getPlaceDetails method',
      availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(service))
    };
  }
  
  return { valid: true };
}

function* debouncedSearchSaga(action) {
  console.log('🔍 Saga: =================================');
  console.log('🔍 Saga: Starting debouncedSearchSaga');
  console.log('🔍 Saga: =================================');
  
  try {
    yield put(setSearchLoading(true));
    yield put(clearError());
    
    // Add debounce delay
    yield delay(300);
    
    const { query } = action.payload;
    console.log(`📝 Saga: Processing search query: "${query}"`);
    
    // Validate query first
    if (!query || typeof query !== 'string' || query.length < 2) {
      console.log('⚠️ Saga: Query validation failed - too short or invalid');
      yield put(searchPlacesSuccess([]));
      return;
    }

    // Get and validate service instance
    const service = getServiceInstance();
    const validation = validateServiceInstance(service);
    
    if (!validation.valid) {
      console.error('❌ Saga: Service validation failed:', validation.error);
      if (validation.availableMethods) {
        console.log('📊 Saga: Available methods:', validation.availableMethods);
      }
      throw new Error(`Google Maps service error: ${validation.error}`);
    }

    console.log('✅ Saga: Service instance validated successfully');
    
    // Log service status if available
    if (typeof service.getStatus === 'function') {
      const status = service.getStatus();
      console.log('📊 Saga: Service status:', status);
      
      if (!status.isInitialized) {
        console.log('🔄 Saga: Service not initialized, attempting initialization...');
        if (typeof service.initialize === 'function') {
          yield call([service, 'initialize']);
          console.log('✅ Saga: Service initialized successfully');
        }
      }
    }

    console.log('🌐 Saga: Calling service.searchPlaces()...');
    
    // Make the API call with comprehensive error handling
    let places;
    try {
      // Use call effect with proper binding
      places = yield call([service, 'searchPlaces'], query);
      console.log(`✅ Saga: searchPlaces completed successfully`);
      console.log(`📊 Saga: Received ${places?.length || 0} places`);
      
      // Log first result for debugging
      if (places && places.length > 0) {
        console.log('📋 Saga: Sample result:', {
          description: places[0].description,
          place_id: places[0].place_id,
          types: places[0].types
        });
      }
      
    } catch (serviceError) {
      console.error('❌ Saga: Service call failed:', serviceError);
      console.error('❌ Saga: Service error stack:', serviceError.stack);
      
      // Detailed error analysis
      if (serviceError.message.includes('null') || serviceError.message.includes('undefined')) {
        console.error('💡 Saga: Null/undefined reference detected');
        console.log('🔍 Saga: Service instance at error time:', service);
        console.log('🔍 Saga: Service type:', typeof service);
        console.log('🔍 Saga: Service constructor:', service?.constructor?.name);
        
        // Try to get fresh service instance
        console.log('🔄 Saga: Attempting to get fresh service instance...');
        const freshService = getServiceInstance();
        
        if (freshService && freshService !== service) {
          console.log('🔄 Saga: Got fresh service instance, retrying...');
          const freshValidation = validateServiceInstance(freshService);
          
          if (freshValidation.valid) {
            places = yield call([freshService, 'searchPlaces'], query);
            console.log('✅ Saga: Retry with fresh service succeeded');
          } else {
            throw new Error(`Fresh service also invalid: ${freshValidation.error}`);
          }
        } else {
          throw new Error('Unable to obtain fresh service instance');
        }
      } else {
        // Re-throw other errors
        throw serviceError;
      }
    }
    
    // Validate and normalize results
    if (!Array.isArray(places)) {
      console.warn('⚠️ Saga: searchPlaces did not return an array:', places);
      places = [];
    }
    
    // Filter out invalid results
    const validPlaces = places.filter(place => 
      place && 
      typeof place === 'object' && 
      place.place_id && 
      place.description
    );
    
    if (validPlaces.length !== places.length) {
      console.warn(`⚠️ Saga: Filtered out ${places.length - validPlaces.length} invalid results`);
    }
    
    console.log(`✅ Saga: Search successful! Dispatching ${validPlaces.length} valid results`);
    yield put(searchPlacesSuccess(validPlaces));
    
  } catch (error) {
    console.error('❌ Saga: debouncedSearchSaga error:', error);
    console.error('❌ Saga: Error stack:', error.stack);
    
    // Create user-friendly error message based on error type
    let userMessage = 'Search failed. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check your configuration.';
    } else if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('billing')) {
      userMessage = 'Google Maps quota exceeded. Please check your billing account.';
    } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('service') || error.message.includes('initialize')) {
      userMessage = 'Maps service initialization error. Please refresh the page.';
    } else if (error.message.includes('null') || error.message.includes('undefined')) {
      userMessage = 'Service connection error. Please refresh the page and try again.';
    } else if (error.message.includes('ZERO_RESULTS')) {
      userMessage = 'No places found for your search.';
    } else if (error.message.includes('INVALID_REQUEST')) {
      userMessage = 'Invalid search request. Please try a different search term.';
    }
    
    yield put(searchPlacesFailure(error.message));
    yield put(setError(userMessage));
    
  } finally {
    yield put(setSearchLoading(false));
    console.log('🔍 Saga: debouncedSearchSaga completed');
  }
}

function* selectPlaceSaga(action) {
  console.log('🏢 Saga: =================================');
  console.log('🏢 Saga: Starting selectPlaceSaga');
  console.log('🏢 Saga: =================================');
  
  try {
    yield put(setMapLoading(true));
    
    const { place, query } = action.payload;
    console.log('📍 Saga: Place selection data:', { 
      placeId: place?.place_id, 
      description: place?.description,
      query 
    });
    
    if (!place || !place.place_id) {
      throw new Error('Invalid place data - missing place_id');
    }

    // Get and validate service instance
    const service = getServiceInstance();
    const validation = validateServiceInstance(service);
    
    if (!validation.valid) {
      console.error('❌ Saga: Service validation failed for place details:', validation.error);
      throw new Error(`Google Maps service error: ${validation.error}`);
    }

    console.log(`📍 Saga: Getting details for place: ${place.place_id}`);
    
    let placeDetails;
    try {
      placeDetails = yield call([service, 'getPlaceDetails'], place.place_id);
    } catch (detailsError) {
      console.error('❌ Saga: getPlaceDetails failed:', detailsError);
      
      // For place details errors, we can still proceed with basic info
      if (detailsError.message.includes('quota') || detailsError.message.includes('billing')) {
        console.log('💡 Saga: Using basic place info due to quota/billing limits');
        placeDetails = {
          place_id: place.place_id,
          name: place.structured_formatting?.main_text || place.description,
          formatted_address: place.structured_formatting?.secondary_text || place.description,
          geometry: null // Will be handled gracefully by map update
        };
      } else {
        throw detailsError;
      }
    }
    
    if (!placeDetails) {
      throw new Error('No place details received from Google API');
    }

    console.log('✅ Saga: Place details retrieved successfully');
    console.log('📊 Saga: Place details keys:', Object.keys(placeDetails));
    
    yield put(selectPlace(placeDetails));
    
    // Add to search history
    const historyEntry = {
      query: query || place.description || placeDetails.name || 'Unknown Place',
      place: placeDetails,
      timestamp: Date.now()
    };
    
    console.log('📚 Saga: Adding to search history');
    yield put(addToSearchHistory(historyEntry));
    
    // Update map with new place
    yield fork(updateMapSaga, placeDetails);
    
  } catch (error) {
    console.error('❌ Saga: selectPlaceSaga error:', error);
    
    let userMessage = 'Failed to load place details. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check configuration.';
    } else if (error.message.includes('quota') || error.message.includes('billing')) {
      userMessage = 'Google Maps usage limit reached. Please try again later.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('service')) {
      userMessage = 'Maps service issue. Please refresh the page.';
    }
    
    yield put(setError(userMessage));
    
  } finally {
    yield put(setMapLoading(false));
    console.log('🏢 Saga: selectPlaceSaga completed');
  }
}

function* updateMapSaga(place) {
  console.log('🗺️ Saga: =================================');
  console.log('🗺️ Saga: Starting updateMapSaga');
  console.log('🗺️ Saga: =================================');
  
  try {
    console.log('🗺️ Saga: Updating map with place:', {
      name: place?.name,
      placeId: place?.place_id,
      hasGeometry: !!(place?.geometry)
    });
    
    // Clear existing markers
    yield put(clearMarkers());
    console.log('🗺️ Saga: Cleared existing markers');
    
    // Add new marker if place has geometry
    if (place.geometry && place.geometry.location) {
      console.log('📍 Saga: Adding marker to map');
      
      const markerData = {
        position: place.geometry.location,
        title: place.name || place.formatted_address || 'Selected Place',
        placeId: place.place_id
      };
      
      console.log('📍 Saga: Marker data:', markerData);
      yield put(addMarker(markerData));
      
      console.log('✅ Saga: Marker added successfully');
    } else {
      console.warn('⚠️ Saga: Place does not have geometry data for marker');
      console.log('📊 Saga: Place structure:', Object.keys(place));
      
      // Still add to marker list for consistency, even without position
      yield put(addMarker({
        position: null,
        title: place.name || place.formatted_address || 'Selected Place',
        placeId: place.place_id,
        note: 'No location data available'
      }));
    }
    
  } catch (error) {
    console.error('❌ Saga: updateMapSaga error:', error);
    // Don't throw here - map update is not critical for the main flow
    // Just log the error and continue
  }
  
  console.log('🗺️ Saga: updateMapSaga completed');
}

function* searchFlowSaga() {
  let searchTask;
  
  console.log('🔄 Saga: Starting search flow watcher');
  
  while (true) {
    try {
      const action = yield take(searchPlacesRequest.type);
      console.log('🔄 Saga: Received search request:', {
        type: action.type,
        query: action.payload?.query
      });
      
      // Cancel previous search if still running
      if (searchTask) {
        console.log('🛑 Saga: Cancelling previous search task');
        yield cancel(searchTask);
      }
      
      // Start new search
      console.log('🚀 Saga: Starting new search task');
      searchTask = yield fork(debouncedSearchSaga, action);
      
    } catch (error) {
      console.error('❌ Saga: searchFlowSaga error:', error);
      // Continue the loop even if there's an error
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

// Root saga with comprehensive error handling
export default function* placesSaga() {
  try {
    console.log('🚀 Saga: =================================');
    console.log('🚀 Saga: Starting placesSaga (ROOT)');
    console.log('🚀 Saga: =================================');
    
    // Log service availability at startup
    const service = getServiceInstance();
    if (service) {
      console.log('✅ Saga: Service available at startup');
      const validation = validateServiceInstance(service);
      console.log('📊 Saga: Service validation:', validation);
      
      if (typeof service.getStatus === 'function') {
        console.log('📊 Saga: Service status:', service.getStatus());
      }
      
      console.log('📊 Saga: Service prototype methods:', 
        Object.getOwnPropertyNames(Object.getPrototypeOf(service))
      );
    } else {
      console.warn('⚠️ Saga: Service not available at startup - will retry during operations');
    }
    
    yield all([
      fork(watchSearchPlaces),
      fork(watchSelectPlace)
    ]);
    
    console.log('✅ Saga: All watchers started successfully');
    
  } catch (error) {
    console.error('❌ Saga: Root saga error:', error);
    console.error('❌ Saga: Root saga stack:', error.stack);
    
    // Dispatch global error if possible
    try {
      yield put(setError('Application initialization error. Please refresh the page.'));
    } catch (dispatchError) {
      console.error('❌ Saga: Could not dispatch error:', dispatchError);
    }
  }
}

// Debug helpers for development and troubleshooting
if (typeof window !== 'undefined') {
  // Main debug function
  window.debugPlacesSaga = () => {
    console.log('🔍 Places Saga Debug Info:');
    console.log('='.repeat(40));
    
    const service = getServiceInstance();
    console.log('Service available:', !!service);
    
    if (service) {
      const validation = validateServiceInstance(service);
      console.log('Service validation:', validation);
      
      if (service.getStatus) {
        console.log('Service status:', service.getStatus());
      }
      
      if (service.isReady) {
        console.log('Service ready:', service.isReady());
      }
      
      console.log('Service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
    }
    
    // Test import status
    console.log('Imported service:', !!googleMapsService);
    console.log('Window service:', !!(window.googleMapsService));
  };

  // Manual test function
  window.testSearchFromSaga = async (query = 'KLCC') => {
    console.log(`🧪 Manual Saga Search Test: "${query}"`);
    
    const service = getServiceInstance();
    const validation = validateServiceInstance(service);
    
    if (!validation.valid) {
      console.error('❌ Service validation failed:', validation);
      return null;
    }
    
    try {
      console.log('🔄 Testing searchPlaces...');
      const results = await service.searchPlaces(query);
      console.log('✅ Test results:', results);
      return results;
    } catch (error) {
      console.error('❌ Test error:', error);
      return null;
    }
  };

  // Service reinitialization helper
  window.reinitializeServiceFromSaga = async () => {
    console.log('🔄 Attempting to reinitialize service from saga context...');
    
    const service = getServiceInstance();
    if (service && typeof service.forceReinitialize === 'function') {
      try {
        await service.forceReinitialize();
        console.log('✅ Service reinitialized from saga');
        return true;
      } catch (error) {
        console.error('❌ Reinitialization failed:', error);
        return false;
      }
    } else {
      console.error('❌ Service or reinitialize method not available');
      return false;
    }
  };
}

// Log when saga file is loaded
console.log('📄 Saga: Enhanced placesSaga.js loaded successfully');
console.log('📄 Saga: Available debug functions on window:');
console.log('  - window.debugPlacesSaga()');
console.log('  - window.testSearchFromSaga(query)');  
console.log('  - window.reinitializeServiceFromSaga()');