// This file is part of the Google Places Redux Saga project.
// It defines the MapContainer component that integrates Google Maps functionality into the application.    
// The component initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the useGoogleMaps hook to handle map-related logic and displays the map along with       
// information about the selected place.
// The component also handles loading states and errors related to the map initialization.  
// The map is displayed within a responsive container, and the selected place's details are shown in an overlay.
// The component is styled using Tailwind CSS for a modern and responsive design.   
// Fixed MapContainer.js - Resolves DOM timing issues
import React, { useRef, useEffect, useState } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const mapContainerRef = useRef(null);
  const [isElementReady, setIsElementReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  
  // Use the Google Maps hook
  const { map, isLoaded, error, resetInitialization } = useGoogleMaps('google-map');

  // Ensure element is ready before map initialization
  useEffect(() => {
    const checkElement = () => {
      const element = document.getElementById('google-map');
      if (element && element.offsetParent !== null) {
        console.log('🔍 MapContainer: Element check:', {
          exists: !!element,
          visible: element.offsetParent !== null,
          width: element.offsetWidth,
          height: element.offsetHeight,
          display: window.getComputedStyle(element).display,
          visibility: window.getComputedStyle(element).visibility
        });
        setIsElementReady(true);
        setMapLoading(false);
      } else {
        // Keep checking until element is ready
        setTimeout(checkElement, 100);
      }
    };
    
    // Start checking after a small delay
    setTimeout(checkElement, 50);
  }, []);

  // Handle retry functionality
  const handleRetry = () => {
    setMapLoading(true);
    setIsElementReady(false);
    resetInitialization();
    
    // Force re-check element readiness
    setTimeout(() => {
      const element = document.getElementById('google-map');
      if (element) {
        setIsElementReady(true);
        setMapLoading(false);
      }
    }, 100);
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  // Show error state with retry options
  if (error && !mapLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-red-50 rounded-lg border border-red-200">
        <div className="text-center p-6">
          <div className="text-red-600 text-lg font-semibold mb-2">
            Failed to Load Map
          </div>
          <div className="text-red-500 text-sm mb-4 max-w-md">
            {error}
          </div>
          
          <div className="text-xs text-gray-600 mb-4 text-left bg-gray-100 p-3 rounded border">
            <strong>Troubleshooting Steps:</strong><br/>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;