// This file is part of the Google Places Redux Saga project.
// It defines the MapContainer component that integrates Google Maps functionality into the application.    
// The component initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the useGoogleMaps hook to handle map-related logic and displays the map along with       
// information about the selected place.
// The component also handles loading states and errors related to the map initialization.  
// The map is displayed within a responsive container, and the selected place's details are shown in an overlay.
// The component is styled using Tailwind CSS for a modern and responsive design.   
// FINAL FIXED MapContainer.js - Removes all conditional rendering issues
import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const mapContainerRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { selectedPlace } = useSelector(state => state.places);
  const { map, isLoaded, error, resetInitialization } = useGoogleMaps('google-map');

  // Handle retry functionality
  const handleRetry = () => {
    console.log('🔄 MapContainer: Retrying map initialization...');
    setRetryCount(prev => prev + 1);
    resetInitialization();
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  // CRITICAL: ALWAYS render the map div - no conditional rendering at all
  return (
    <div className="relative w-full h-full map-container-parent">
      {/* 
        🚨 CRITICAL: This div must ALWAYS be rendered 
        Never wrap this in conditional logic 
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
          display: 'block !important',
          visibility: 'visible !important',
          backgroundColor: '#e5e7eb' // Fallback background
        }}
        data-testid="google-map-container"
        role="application"
        aria-label="Google Maps"
      />
      
      {/* Error overlay - only shows on error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-95 rounded-lg">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <div className="text-red-700 font-semibold mb-2">Map Failed to Load</div>
            <div className="text-red-600 text-sm mb-4">{error}</div>
            
            <div className="text-xs text-gray-600 mb-4 text-left bg-white p-3 rounded border">
              <strong>Common Solutions:</strong><br/>
              • Check API key restrictions in Google Cloud<br/>
              • Verify internet connection<br/>
              • Wait 5-10 minutes for Google changes to propagate<br/>
              • Try temporarily removing all API restrictions
            </div>
            
            <div className="flex gap-2 justify-center">
              <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
              >
                Retry ({retryCount})
              </button>
              <button 
                onClick={handleForceReload}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading overlay - only shows when loading */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600 font-medium">
              Loading Google Maps...
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Initializing map and services
            </div>
            
            {/* Progress indicator */}
            <div className="mt-4 w-48 mx-auto">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000 animate-pulse"
                  style={{ width: '70%' }}
                />
              </div>
            </div>
            
            <div className="mt-3 text-xs text-gray-400">
              Map Status: {isLoaded ? '✅ Loaded' : '⏳ Loading'} | 
              Error: {error ? '❌ Yes' : '✅ None'}
            </div>
          </div>
        </div>
      )}
      
      {/* Selected place info overlay - only shows when place is selected */}
      {selectedPlace && isLoaded && !error && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm mx-auto">
          <h3 className="font-semibold text-gray-900 mb-1">
            {selectedPlace.name}
          </h3>
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
        </div>
      )}
    </div>
  );
};

export default MapContainer;