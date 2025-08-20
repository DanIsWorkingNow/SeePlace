// This file is part of the Google Places Redux Saga project.
// It defines the MapContainer component that integrates Google Maps functionality into the application.    
// The component initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the useGoogleMaps hook to handle map-related logic and displays the map along with       
// information about the selected place.
// The component also handles loading states and errors related to the map initialization.  
// The map is displayed within a responsive container, and the selected place's details are shown in an overlay.
// The component is styled using Tailwind CSS for a modern and responsive design.   
// REPLACE: src/components/Map/MapContainer.js
// CRITICAL FIX: Always renders map container div to prevent timing issues
import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const mapContainerRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { selectedPlace } = useSelector(state => state.places);
  const { map, isLoaded, error, resetInitialization } = useGoogleMaps('google-map');

  const handleRetry = () => {
    console.log('🔄 MapContainer: Retrying map initialization...');
    setRetryCount(prev => prev + 1);
    resetInitialization();
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  // 🚨 CRITICAL: ALWAYS render the map div - no conditional rendering at all
  return (
    <div className="relative w-full h-full map-container-parent">
      {/* 
        ⚠️ IMPORTANT: This div must ALWAYS be rendered for Google Maps to initialize properly
        Never wrap this in conditional logic or the map will fail to load
      */}
      <div 
        ref={mapContainerRef}
        id="google-map"
        className="w-full h-full rounded-lg"
        style={{ 
          minHeight: '400px',
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          display: 'block' // Ensure always visible
        }}
      />
      
      {/* Loading overlay - shows ON TOP of map div instead of replacing it */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600">Loading map...</div>
            <div className="mt-2 text-sm text-gray-500">
              Initializing Google Maps API
            </div>
          </div>
        </div>
      )}
      
      {/* Error overlay - shows ON TOP when there's an error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
          <div className="text-center p-6">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <div className="text-gray-600 mb-2 font-medium">Map initialization failed</div>
            <div className="text-sm text-gray-500 mb-4 max-w-md">
              {error}
            </div>
            <div className="space-x-2">
              <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry {retryCount > 0 && `(${retryCount})`}
              </button>
              <button 
                onClick={handleForceReload}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug info overlay - shows when map is loaded */}
      {process.env.NODE_ENV === 'development' && isLoaded && !error && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-20">
          <div className="font-mono">
            Map: {isLoaded ? '✅ Loaded' : '⏳ Loading'} | 
            Error: {error ? '❌ Yes' : '✅ None'} |
            Selected: {selectedPlace ? '📍 Yes' : '➖ None'}
          </div>
        </div>
      )}
      
      {/* Selected place info overlay - shows when place is selected and auto-pinned */}
      {selectedPlace && isLoaded && !error && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto z-20">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 flex-1">
              📍 {selectedPlace.name}
            </h3>
            <div className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              Auto-Pinned
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {selectedPlace.formatted_address}
          </p>
          {selectedPlace.types && (
            <div className="flex flex-wrap gap-1">
              {selectedPlace.types.slice(0, 3).map((type) => (
                <span 
                  key={type}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {type.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          {selectedPlace.geometry && selectedPlace.geometry.location && (
            <div className="mt-2 text-xs text-gray-500 font-mono">
              {selectedPlace.geometry.location.lat.toFixed(4)}, {selectedPlace.geometry.location.lng.toFixed(4)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapContainer;