// This file is part of the Google Places Redux Saga project.
// It defines the Redux slice for managing places-related state, including search suggestions, history, and map markers.    
    
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
    yield put(setSearchLoading(true));
    yield put(clearError());
    
    yield delay(300);
    
    const { query } = action.payload;
    
    if (!query || query.length < 2) {
      yield put(searchPlacesSuccess([]));
      return;
    }
    
    const places = yield call(googleMapsService.searchPlaces, query);
    yield put(searchPlacesSuccess(places));
    
  } catch (error) {
    yield put(searchPlacesFailure(error.message));
    yield put(setError(`Search failed: ${error.message}`));
  } finally {
    yield put(setSearchLoading(false));
  }
}

function* selectPlaceSaga(action) {
  try {
    yield put(setMapLoading(true));
    const { place, query } = action.payload;
    
    const placeDetails = yield call(googleMapsService.getPlaceDetails, place.place_id);
    
    yield put(selectPlace(placeDetails));
    
    yield put(addToSearchHistory({
      query: query || place.description,
      place: placeDetails,
      timestamp: Date.now()
    }));
    
    yield fork(updateMapSaga, placeDetails);
    
  } catch (error) {
    yield put(setError(`Failed to load place details: ${error.message}`));
  } finally {
    yield put(setMapLoading(false));
  }
}

function* updateMapSaga(place) {
  try {
    yield put(clearMarkers());
    
    if (place.geometry) {
      yield put(addMarker({
        position: place.geometry.location,
        title: place.name,
        placeId: place.place_id
      }));
    }
  } catch (error) {
    console.error('Map update error:', error);
  }
}

function* searchFlowSaga() {
  let searchTask;
  
  while (true) {
    const action = yield take(searchPlacesRequest.type);
    
    if (searchTask) {
      yield cancel(searchTask);
    }
    
    searchTask = yield fork(debouncedSearchSaga, action);
  }
}

function* watchSearchPlaces() {
  yield fork(searchFlowSaga);
}

function* watchSelectPlace() {
  yield takeEvery(selectPlace.type, selectPlaceSaga);
}

export default function* placesSaga() {
  yield all([
    fork(watchSearchPlaces),
    fork(watchSelectPlace)
  ]);
}