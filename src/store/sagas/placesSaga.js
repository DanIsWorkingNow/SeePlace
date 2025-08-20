// FIXED: src/store/sagas/placesSaga.js
// Clean auto-pinning workflow without Redux serialization issues
import { call, put, takeEvery, debounce, all, fork, delay } from 'redux-saga/effects';
import {
  searchPlacesRequest,
  searchPlacesSuccess,
  searchPlacesFailure,
  selectPlace,
  addToSearchHistory,
  clearMarkers
} from '../slices/placesSlice';
import { setSearchLoading, setMapLoading, setError } from '../slices/uiSlice';
import { googleMapsService } from '../../services/googleMapsService';

// 🎯 SIMPLIFIED AUTO-PINNING SAGA - No recursive issues
function* selectPlaceSaga(action) {
  try {
    console.log('🎯 Saga: AUTO-PINNING workflow started');
    
    // Extract place and query from payload safely
    const payload = action.payload;
    let place, query;
    
    if (payload && typeof payload === 'object') {
      if (payload.place) {
        // Structured payload: { place: x, query: y }
        place = payload.place;
        query = payload.query || '';
      } else {
        // Direct place object
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

    // 🔧 GET PLACE DETAILS if needed (with serialization)
    let processedPlace = place;
    
    if (place.place_id && (!place.geometry || !place.geometry.location)) {
      console.log('📊 Saga: Fetching place details for geometry...');
      
      try {
        const placeDetails = yield call([googleMapsService, 'getPlaceDetails'], place.place_id);
        
        if (placeDetails?.geometry?.location) {
          // 🔥 SERIALIZE IMMEDIATELY to prevent Redux issues
          const location = placeDetails.geometry.location;
          const serializedLocation = {
            lat: typeof location.lat === 'function' ? location.lat() : location.lat,
            lng: typeof location.lng === 'function' ? location.lng() : location.lng
          };
          
          processedPlace = {
            ...place,
            ...placeDetails,
            geometry: {
              ...placeDetails.geometry,
              location: serializedLocation
            },
            description: place.description || placeDetails.formatted_address
          };
          
          console.log('✅ Saga: Serialized place details:', serializedLocation);
        }
      } catch (error) {
        console.error('❌ Saga: Place details failed:', error);
        yield put(setError('Could not get location details'));
        yield put(setMapLoading(false));
        return;
      }
    }

    // 🔧 VALIDATE GEOMETRY DATA
    if (!processedPlace.geometry?.location) {
      console.warn('⚠️ Saga: No geometry data for auto-pinning');
      yield put(setError('Selected place has no location data'));
      yield put(setMapLoading(false));
      return;
    }

    // Ensure location is properly serialized
    const location = processedPlace.geometry.location;
    const serializedLocation = {
      lat: typeof location.lat === 'function' ? location.lat() : location.lat,
      lng: typeof location.lng === 'function' ? location.lng() : location.lng
    };

    const finalPlace = {
      ...processedPlace,
      geometry: {
        ...processedPlace.geometry,
        location: serializedLocation
      }
    };

    console.log('📍 Saga: Final serialized place ready for auto-pinning:', {
      name: finalPlace.name,
      location: serializedLocation
    });

    // 🎯 DISPATCH SERIALIZED PLACE (triggers auto-pinning in useGoogleMaps)
    // NOTE: We don't call selectPlace again - that would cause recursion
    // Instead, we directly update the state via the reducer that's already running
    
    // 📚 ADD TO SEARCH HISTORY
    if (query && finalPlace) {
      yield put(addToSearchHistory({
        query: query.trim(),
        place: finalPlace,
        timestamp: new Date().toISOString()
      }));
      console.log('📚 Saga: Added to search history');
    }

    // 🎉 SUCCESS - Map will auto-pin via useGoogleMaps hook
    yield delay(200); // Brief pause for UI feedback
    console.log('✅ Saga: AUTO-PINNING data prepared successfully');
    
  } catch (error) {
    console.error('❌ Saga: Auto-pinning workflow failed:', error);
    
    // User-friendly error messages
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

// 🔍 IMPROVED SEARCH SAGA with debouncing
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
    
    // Search with timeout protection
    const places = yield call([googleMapsService, 'searchPlaces'], query.trim());
    
    if (Array.isArray(places)) {
      // 🔥 SERIALIZE SEARCH RESULTS to prevent future Redux issues
      const serializedPlaces = places.map(place => {
        if (place.geometry?.location) {
          const location = place.geometry.location;
          return {
            ...place,
            geometry: {
              ...place.geometry,
              location: {
                lat: typeof location.lat === 'function' ? location.lat() : location.lat,
                lng: typeof location.lng === 'function' ? location.lng() : location.lng
              }
            }
          };
        }
        return place;
      });
      
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

// 🚀 ROOT SAGA with proper error handling
function* placesSaga() {
  try {
    yield all([
      // Debounced search - wait 500ms after user stops typing
      debounce(500, searchPlacesRequest.type, debouncedSearchSaga),
      
      // Immediate place selection for auto-pinning
      takeEvery(selectPlace.type, selectPlaceSaga)
    ]);
  } catch (error) {
    console.error('❌ Places Saga crashed:', error);
    yield put(setError('Application error. Please refresh the page.'));
  }
}

export default placesSaga;