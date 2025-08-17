// This file is part of the Google Places Redux Saga project and defines the root saga for managing side effects in the application.
// It combines all sagas related to places functionality, such as searching for places and handling map interactions.
// The root saga is the entry point for all sagas and is used to run them concurrently.
// It uses Redux Saga's `all` and `fork` effects to run multiple sagas in parallel.
// The `placesSaga` handles the asynchronous operations related to places, such as fetching search results and managing map markers.
import { all, fork } from 'redux-saga/effects';
import placesSaga from './placesSaga';

export default function* rootSaga() {
  yield all([
    fork(placesSaga)
  ]);
}