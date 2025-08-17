// This file is part of the Redux store setup for a Google Places application using Redux Saga.
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import placesReducer from './slices/placesSlice';
import uiReducer from './slices/uiSlice';
import rootSaga from './sagas/rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    places: placesReducer,
    ui: uiReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    }).concat(sagaMiddleware)
});

sagaMiddleware.run(rootSaga);
// This file sets up the Redux store with slices for places and UI state, and integrates Redux Saga for side effects.