// This file is part of the Google Places Redux Saga project.
// It defines the MapContainer component that integrates Google Maps functionality into the application.    
// The component initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the useGoogleMaps hook to handle map-related logic and displays the map along with       
// information about the selected place.
// The component also handles loading states and errors related to the map initialization.  
// The map is displayed within a responsive container, and the selected place's details are shown in an overlay.
// The component is styled using Tailwind CSS for a modern and responsive design.   
// Complete MapContainer.js - CRITICAL: This file must be updated for the fix to work
// Complete MapContainer.js Solution - Replace your entire file with this
// Complete MapContainer.js Solution - Replace your entire src/components/Map/MapContainer.js with this
// FIXED MapContainer.js - Solves the chicken-and-egg problem
// Replace your ENTIRE src/components/Map/MapContainer.js with this
import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const [mapError, setMapError] = useState(null);
  const [isElementReady, setIsElementReady] = useState(false);
  const mapContainerRef = useRef(null);
  const { selectedPlace } = useSelector(state => state.places);
  const { mapLoading } = useSelector(state => state.ui);
  
  // Get error and reset function from the hook
  const { isLoaded, error, resetInitialization } = useGoogleMaps('google-map');

  // FIXED: Check element AFTER it's rendered (not before)
  useEffect(() => {
    // Small delay to ensure the div is in DOM after render
    const timer = setTimeout(() => {
      const element = document.getElementById('google-map');
      if (element) {
        const isVisible = (
          element.offsetWidth > 0 && 
          element.offsetHeight > 0 && 
          window.getComputedStyle(element).display !== 'none' &&
          window.getComputedStyle(element).visibility !== 'hidden'
        );
        
        setIsElementReady(isVisible);
        console.log('🔍 MapContainer: Element check:', {
          exists: !!element,
          visible: isVisible,
          width: element.offsetWidth,
          height: element.offsetHeight,
          display: window.getComputedStyle(element).display,
          visibility: window.getComputedStyle(element).visibility
        });
      } else {
        console.log('❌ MapContainer: Element still not found after render');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Run once after initial render

  // Handle map errors
  useEffect(() => {
    const handleMapError = (event) => {
      if (event.target.tagName === 'SCRIPT' && event.target.src.includes('maps.googleapis.com')) {
        console.error('Google Maps script error:', event);
        setMapError('Failed to load Google Maps. Please check your API key and internet connection.');
      }
    };

    window.addEventListener('error', handleMapError);
    return () => window.removeEventListener('error', handleMapError);
  }, []);

  // Handle errors from the hook
  useEffect(() => {
    if (error) {
      setMapError(`Map initialization failed: ${error}`);
    } else {
      setMapError(null);
    }
  }, [error]);

  const handleRetry = () => {
    console.log('🔄 MapContainer: User triggered retry');
    setMapError(null);
    setIsElementReady(false);
    resetInitialization();
    
    // Re-check element after retry
    setTimeout(() => {
      const element = document.getElementById('google-map');
      if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
        setIsElementReady(true);
      }
    }, 100);
  };

  const handleForceReload = () => {
    console.log('🔄 MapContainer: Force reloading page');
    window.location.reload();
  };

  // Show error state
  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-6 max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <div className="text-gray-800 font-semibold mb-2">Map Loading Failed</div>
          <div className="text-gray-600 mb-4 text-sm">{mapError}</div>
          
          <div className="text-xs text-gray-500 mb-4 p-3 bg-gray-50 rounded border-l-4 border-blue-400">
            <strong>Troubleshooting:</strong><br/>
            1. Check browser console for detailed errors<br/>
            2. Verify API key is valid<br/>
            3. Ensure internet connection is stable<br/>
            4. Try refreshing the page
          </div>
          
          <div className="flex gap-2 justify-center">
            <button 
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              Retry Map
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
    );
  }

  // ALWAYS render the map container div - no conditional rendering!
  return (
    <div className="relative w-full h-full">
      {/* ALWAYS RENDER: Map container div - this fixes the chicken-and-egg problem */}
      <div 
        ref={mapContainerRef}
        id="google-map"
        className="w-full h-full rounded-lg bg-gray-200"
        style={{ 
          minHeight: '400px',
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          display: 'block',
          visibility: 'visible'
        }}
        data-testid="google-map-container"
        role="application"
        aria-label="Google Maps"
      />
      
      {/* Show loading overlay on top of the map div */}
      {(!isLoaded || mapLoading || !isElementReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600">
              {!isElementReady ? 'Preparing map container...' :
               mapLoading ? 'Processing map data...' : 
               'Loading Google Maps...'}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {!isElementReady ? 'Setting up DOM elements' :
               'This may take a few moments'}
            </div>
            
            {/* Debug info */}
            <div className="mt-2 text-xs text-gray-400">
              Element Ready: {isElementReady ? '✅' : '❌'} | 
              Map Loaded: {isLoaded ? '✅' : '❌'} | 
              Loading: {mapLoading ? '⏳' : '✅'}
            </div>
            
            {/* Progress indicator */}
            <div className="mt-4 w-48 mx-auto">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: !isElementReady ? '20%' : mapLoading ? '60%' : '90%' 
                  }}
                />
              </div>
            </div>
            
            {/* Manual retry button */}
            <button 
              onClick={handleRetry}
              className="mt-4 px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              Force Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Selected place info overlay */}
      {selectedPlace && isLoaded && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
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
            <button 
              onClick={() => console.log('Place info panel closed')}
              className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close place info"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* Map controls */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-md p-2">
          <button 
            onClick={handleRetry}
            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            title="Refresh map"
            aria-label="Refresh map"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapContainer;