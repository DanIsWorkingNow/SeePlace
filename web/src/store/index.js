// UPDATED: src/store/index.js
// Proper Redux store configuration to handle serialization issues
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import placesReducer from './slices/placesSlice';
import uiReducer from './slices/uiSlice';
import buildingsReducer from './slices/buildingsSlice';
// import favoritesReducer from './slices/favoritesSlice'; // Uncomment if you have this
import rootSaga from './sagas/rootSaga'; // Or replace with: import placesSaga from './sagas/placesSaga';

// Create saga middleware with enhanced error handling
const sagaMiddleware = createSagaMiddleware({
  onError: (error, { sagaStack }) => {
    console.error('🚨 Saga Error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('📍 Saga Stack:', sagaStack);
    }
  }
});

// 🔧 CONFIGURE STORE with proper serialization settings
const store = configureStore({
  reducer: {
    places: placesReducer,
    ui: uiReducer,
    buildings: buildingsReducer,
    // favorites: favoritesReducer, // Uncomment if you have favorites feature
  },
  
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // 🔥 CRITICAL: Fix Redux serialization errors
      serializableCheck: {
        // Ignore Redux Saga internal action types
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
          '@@saga/TASK_CANCEL',
          '@@saga/TASK_ERROR',
          '@@saga/EFFECT_TRIGGERED',
          '@@saga/EFFECT_RESOLVED',
          '@@saga/EFFECT_REJECTED'
        ],
        
        // Ignore specific paths that might contain non-serializable data
        // NOTE: With our fixes, these should not be needed, but kept for safety
        ignoredPaths: [
          // 'places.currentMap', // Maps should not be in Redux anymore
          // 'places.markers.*.marker' // Marker instances should not be in Redux
        ],
        
        // Enhanced serialization check for debugging
        isSerializable: (value) => {
          // Allow null and undefined
          if (value === null || value === undefined) {
            return true;
          }
          
          // Allow primitives
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return true;
          }
          
          // Allow plain objects and arrays
          if (Array.isArray(value) || (value.constructor === Object)) {
            return true;
          }
          
          // Allow Date objects (automatically serialized to ISO strings)
          if (value instanceof Date) {
            return true;
          }
          
          // 🚨 DEVELOPMENT WARNING: Help identify non-serializable values
          if (process.env.NODE_ENV === 'development') {
            console.warn('🚨 Non-serializable value detected:', {
              type: typeof value,
              constructor: value.constructor?.name,
              isFunction: typeof value === 'function',
              hasLatLng: value && (typeof value.lat === 'function' || typeof value.lng === 'function'),
              value: typeof value === 'function' ? '[Function]' : value
            });
            
            // Provide helpful debugging info for Google Maps objects
            if (value && typeof value.lat === 'function' && typeof value.lng === 'function') {
              console.warn('💡 This looks like a Google Maps LatLng object. Convert it to:', {
                lat: value.lat(),
                lng: value.lng()
              });
            }
          }
          
          return false;
        },
        
        // Warn instead of error in development for easier debugging
        warnAfter: process.env.NODE_ENV === 'development' ? 32 : undefined
      },
      
      // 🔧 Immutability check configuration
      immutableCheck: {
        // Ignore paths that Redux Saga might temporarily mutate
        ignoredPaths: [
          'places.suggestions',
          'places.searchHistory'
        ],
        // Warn instead of error for easier development
        warnAfter: process.env.NODE_ENV === 'development' ? 32 : undefined
      },
      
      // 🚀 Performance optimization: Disable checks in production
      ...(process.env.NODE_ENV === 'production' && {
        serializableCheck: false,
        immutableCheck: false
      })
    }).concat(sagaMiddleware),
  
  // 🎯 Enhanced Redux DevTools configuration
  devTools: process.env.NODE_ENV !== 'production' && {
    name: 'Google Places Explorer',
    trace: true,
    traceLimit: 25,
    
    // Enhanced serialization for DevTools
    serialize: {
      options: {
        undefined: true,
        function: (fn) => `[Function: ${fn.name || 'anonymous'}]`,
        symbol: (sym) => `[Symbol: ${sym.toString()}]`,
        map: true,
        set: true
      }
    },
    
    // Action sanitizer for cleaner DevTools logs
    actionSanitizer: (action) => {
      // Handle large search results
      if (action.type === 'places/searchPlacesSuccess' && action.payload?.length > 3) {
        return {
          ...action,
          payload: {
            length: action.payload.length,
            sample: action.payload.slice(0, 2),
            note: '[Truncated for DevTools - check console for full data]'
          }
        };
      }
      
      // Handle place selection with geometry
      if (action.type === 'places/selectPlace' && action.payload?.geometry) {
        return {
          ...action,
          payload: {
            ...action.payload,
            geometry: {
              ...action.payload.geometry,
              location: action.payload.geometry.location || '[Location data]'
            }
          }
        };
      }
      
      // Hide sensitive data
      if (action.type.includes('API_KEY') || action.payload?.toString().includes('AIza')) {
        return {
          ...action,
          payload: '[API_KEY - hidden for security]'
        };
      }
      
      return action;
    },
    
    // State sanitizer for better DevTools performance
    stateSanitizer: (state) => {
      const sanitizedState = { ...state };
      
      // Truncate large arrays for DevTools display
      if (state.places?.suggestions?.length > 3) {
        sanitizedState.places = {
          ...state.places,
          suggestions: {
            length: state.places.suggestions.length,
            sample: state.places.suggestions.slice(0, 2),
            note: '[Truncated for DevTools]'
          }
        };
      }
      
      if (state.places?.searchHistory?.length > 5) {
        sanitizedState.places = {
          ...sanitizedState.places,
          searchHistory: {
            length: state.places.searchHistory.length,
            recent: state.places.searchHistory.slice(0, 3),
            note: '[Truncated for DevTools]'
          }
        };
      }
      
      return sanitizedState;
    },
    
    // Features configuration
    features: {
      pause: true,
      lock: true,
      persist: true,
      export: true,
      import: 'custom',
      jump: true,
      skip: true,
      reorder: true,
      dispatch: true,
      test: true
    }
  },
  
  // Clean initial state
  preloadedState: {
    ui: {
      loading: false,
      error: null,
      searchLoading: false,
      mapLoading: false
    },
    places: {
      suggestions: [],
      searchHistory: [],
      selectedPlace: null,
      markers: []
    }
  }
});

// 🚀 RUN SAGA with error handling
try {
  sagaMiddleware.run(rootSaga); // Or replace with placesSaga if you don't have rootSaga
} catch (error) {
  console.error('🚨 Failed to start saga:', error);
}

// 🔧 DEVELOPMENT MONITORING
if (process.env.NODE_ENV === 'development') {
  // Monitor state changes for serialization issues
  let isChecking = false;
  
  store.subscribe(() => {
    if (isChecking) return;
    isChecking = true;
    
    const state = store.getState();
    
    // Test if entire state is serializable
    try {
      const serialized = JSON.stringify(state);
      const parsed = JSON.parse(serialized);
      
      // Quick sanity check
      if (!parsed.places || !parsed.ui) {
        console.warn('🚨 State structure issue detected');
      }
      
    } catch (error) {
      console.error('🚨 State serialization failed:', error.message);
      
      // Try to identify which part of state is causing issues
      Object.keys(state).forEach(key => {
        try {
          JSON.stringify(state[key]);
        } catch (nestedError) {
          console.error(`🚨 Serialization failed in state.${key}:`, nestedError.message);
          
          // For places state, check deeper
          if (key === 'places' && state[key]) {
            Object.keys(state[key]).forEach(placesKey => {
              try {
                JSON.stringify(state[key][placesKey]);
              } catch (deepError) {
                console.error(`🚨 Serialization failed in state.places.${placesKey}:`, deepError.message);
                console.log(`🔍 Problematic data:`, state[key][placesKey]);
              }
            });
          }
        }
      });
    }
    
    isChecking = false;
  });
  
  // Log store initialization
  console.log('✅ Redux store initialized with serialization fixes');
  console.log('🔍 Initial state:', store.getState());
}

export default store;