// FIXED: src/store/sagas/placesSaga.js
// Complete fix for Redux serialization and viewport issues
import { call, put, takeEvery, debounce, all, delay } from 'redux-saga/effects';
import {
  searchPlacesRequest,
  searchPlacesSuccess,
  searchPlacesFailure,
  selectPlace,
  addToSearchHistory
} from '../slices/placesSlice';
import { setSearchLoading, setMapLoading, setError } from '../slices/uiSlice';
import { googleMapsService } from '../../services/googleMapsService';

// 🔧 CRITICAL: Helper function to serialize ALL Google Maps objects
function serializeGoogleMapsGeometry(geometry) {
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
  
  // 🔥 CRITICAL FIX: Serialize viewport to prevent Redux errors
  if (geometry.viewport) {
    const viewport = geometry.viewport;
    
    // Extract bounds safely
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
    } else if (viewport.north !== undefined) {
      // Handle different viewport format
      serialized.viewport = {
        northeast: { lat: viewport.north, lng: viewport.east },
        southwest: { lat: viewport.south, lng: viewport.west }
      };
    }
  }
  
  // Serialize bounds if present
  if (geometry.bounds) {
    const bounds = geometry.bounds;
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
  }
  
  return serialized;
}

// 🔧 Helper function to completely serialize place objects
function serializePlaceObject(place) {
  if (!place) return null;
  
  const serialized = {
    ...place,
    // Always serialize geometry completely
    geometry: serializeGoogleMapsGeometry(place.geometry)
  };
  
  // Remove any other potential non-serializable properties
  delete serialized.map;
  delete serialized.service;
  
  return serialized;
}

// 🎯 FIXED SELECT PLACE SAGA
function* selectPlaceSaga(action) {
  try {
    console.log('🎯 Saga: AUTO-PINNING workflow started');
    
    const payload = action.payload;
    let place, query;
    
    if (payload && typeof payload === 'object') {
      if (payload.place) {
        place = payload.place;
        query = payload.query || '';
      } else {
        place = payload;
        query = '';
      }
    } else {
      console.warn('⚠️ Saga: Invalid payload format');
      return;
    }

    if (!place) {
      console.warn('⚠️ Saga: No place provided');
      return;
    }

    console.log('📍 Saga: Processing place:', place.name || place.description);
    
    yield put(setMapLoading(true));
    yield put(setError(null));

    let processedPlace = place;
    
    // Get place details if needed
    if (place.place_id && (!place.geometry || !place.geometry.location)) {
      console.log('📊 Saga: Fetching place details for geometry...');
      
      try {
        const placeDetails = yield call([googleMapsService, 'getPlaceDetails'], place.place_id);
        
        if (placeDetails?.geometry?.location) {
          // Merge with existing place data
          processedPlace = {
            ...place,
            ...placeDetails,
            description: place.description || placeDetails.formatted_address
          };
          
          console.log('✅ Saga: Serialized place details:', {
            lat: placeDetails.geometry.location.lat?.() || placeDetails.geometry.location.lat,
            lng: placeDetails.geometry.location.lng?.() || placeDetails.geometry.location.lng
          });
        }
      } catch (error) {
        console.error('❌ Saga: Place details failed:', error);
        yield put(setError('Could not get location details'));
        yield put(setMapLoading(false));
        return;
      }
    }

    // Validate geometry data
    if (!processedPlace.geometry?.location) {
      console.warn('⚠️ Saga: No geometry data for auto-pinning');
      yield put(setError('Selected place has no location data'));
      yield put(setMapLoading(false));
      return;
    }

    // 🔥 CRITICAL: FULLY serialize the place object
    const fullySerializedPlace = serializePlaceObject(processedPlace);

    console.log('📍 Saga: Final serialized place ready:', {
      name: fullySerializedPlace.name,
      location: fullySerializedPlace.geometry?.location,
      hasViewport: !!fullySerializedPlace.geometry?.viewport
    });

    // Add to search history with fully serialized data
    if (query && fullySerializedPlace) {
      yield put(addToSearchHistory({
        query: query.trim(),
        place: fullySerializedPlace, // Now completely serialized
        timestamp: new Date().toISOString()
      }));
      console.log('📚 Saga: Added to search history');
    }

    yield delay(200);
    console.log('✅ Saga: AUTO-PINNING data prepared successfully');
    
  } catch (error) {
    console.error('❌ Saga: Auto-pinning workflow failed:', error);
    
    let userMessage = 'Failed to select place. Please try again.';
    
    if (error.message.includes('API key')) {
      userMessage = 'Google Maps API key issue. Please check configuration.';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      userMessage = 'API limit reached. Please try again later.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your connection.';
    }
    
    yield put(setError(userMessage));
    
  } finally {
    yield put(setMapLoading(false));
  }
}

// 🔍 FIXED SEARCH SAGA
function* debouncedSearchSaga(action) {
  try {
    const { query } = action.payload;
    
    if (!query || query.trim().length < 2) {
      yield put(searchPlacesSuccess([]));
      return;
    }
    
    console.log(`🔍 Saga: Searching for "${query.trim()}"`);
    yield put(setSearchLoading(true));
    yield put(setError(null));
    
    const places = yield call([googleMapsService, 'searchPlaces'], query.trim());
    
    if (Array.isArray(places)) {
      // 🔥 Serialize all search results completely
      const serializedPlaces = places.map(place => serializePlaceObject(place));
      
      yield put(searchPlacesSuccess(serializedPlaces));
      console.log(`✅ Saga: Found ${serializedPlaces.length} places`);
    } else {
      yield put(searchPlacesSuccess([]));
    }
    
  } catch (error) {
    console.error('❌ Saga: Search failed:', error);
    
    let userMessage = 'Search failed. Please try again.';
    if (error.message.includes('quota')) {
      userMessage = 'Search quota exceeded. Please try again later.';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your connection.';
    }
    
    yield put(searchPlacesFailure(userMessage));
    yield put(setError(userMessage));
    
  } finally {
    yield put(setSearchLoading(false));
  }
}

// Root saga
function* placesSaga() {
  try {
    yield all([
      debounce(500, searchPlacesRequest.type, debouncedSearchSaga),
      takeEvery(selectPlace.type, selectPlaceSaga)
    ]);
  } catch (error) {
    console.error('❌ Places Saga crashed:', error);
    yield put(setError('Application error. Please refresh the page.'));
  }
}

export default placesSaga;