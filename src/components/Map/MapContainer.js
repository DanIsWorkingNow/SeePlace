// UPDATED: src/components/Map/MapContainer.js
// Complete fix for map tiles rendering issues
import React, { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const mapContainerRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  
  const { selectedPlace } = useSelector(state => state.places);
  const { map, isLoaded, error } = useGoogleMaps('google-map');

  // 🔥 CRITICAL: Force map resize and tile loading after initialization
  useEffect(() => {
    if (map && isLoaded && !mapReady) {
      console.log('🔄 MapContainer: Triggering map setup for tile rendering...');
      
      const setupMap = async () => {
        try {
          // Wait a moment for DOM to stabilize
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Force map to recognize its container size
          if (window.google?.maps?.event) {
            window.google.maps.event.trigger(map, 'resize');
            console.log('✅ MapContainer: Triggered map resize');
          }
          
          // Ensure map is centered properly (this can trigger tile loading)
          const currentCenter = map.getCenter();
          if (currentCenter) {
            map.setCenter(currentCenter);
            console.log('✅ MapContainer: Re-centered map to trigger tiles');
          } else {
            // Fallback center
            map.setCenter({ lat: 3.1390, lng: 101.6869 });
            console.log('✅ MapContainer: Set fallback center');
          }
          
          // Force a zoom change to trigger tile refresh
          const currentZoom = map.getZoom();
          map.setZoom(currentZoom || 13);
          
          setMapReady(true);
          console.log('🎉 MapContainer: Map setup completed for tile rendering');
          
        } catch (setupError) {
          console.error('❌ MapContainer: Map setup failed:', setupError);
        }
      };
      
      setupMap();
    }
  }, [map, isLoaded, mapReady]);

  // 🔥 CRITICAL: Container resize observer to handle dynamic sizing
  useEffect(() => {
    if (!mapContainerRef.current || !map) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          console.log(`📏 MapContainer: Size changed to ${width}x${height}`);
          
          // Trigger map resize when container size changes
          setTimeout(() => {
            if (window.google?.maps?.event && map) {
              window.google.maps.event.trigger(map, 'resize');
            }
          }, 100);
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  const handleRetry = () => {
    console.log('🔄 MapContainer: Retrying map initialization...');
    setRetryCount(prev => prev + 1);
    setMapReady(false);
    // Force page reload as a simple retry mechanism
    window.location.reload();
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
          display: 'block', // Ensure always visible
          backgroundColor: '#f0f0f0' // Fallback background while tiles load
        }}
      />
      
      {/* Loading overlay - shows ON TOP of map div instead of replacing it */}
      {(!isLoaded || !mapReady) && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600">
              {!isLoaded ? 'Loading map...' : 'Preparing map tiles...'}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {!isLoaded ? 'Initializing Google Maps API' : 'Setting up map display'}
            </div>
            {isLoaded && !mapReady && (
              <div className="mt-2 text-xs text-blue-600">
                Map loaded, configuring tile display...
              </div>
            )}
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
            <div className="text-xs text-gray-400 mb-4">
              Check browser console for detailed error information
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
      
      {/* Debug info overlay - shows when map is loaded in development */}
      {process.env.NODE_ENV === 'development' && isLoaded && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-20 font-mono">
          <div>
            Map: {isLoaded ? '✅ Loaded' : '⏳ Loading'} | 
            Tiles: {mapReady ? '✅ Ready' : '⏳ Loading'} | 
            Error: {error ? '❌ Yes' : '✅ None'}
          </div>
          <div className="mt-1">
            Selected: {selectedPlace ? '📍 Yes' : '➖ None'} |
            Container: {mapContainerRef.current ? '✅ OK' : '❌ Missing'}
          </div>
        </div>
      )}
      
      {/* Map tiles status indicator - shows briefly when tiles are loading */}
      {isLoaded && !mapReady && !error && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white text-xs px-3 py-1 rounded-full z-20">
          🔄 Loading map tiles...
        </div>
      )}
      
      {/* Selected place info overlay - shows when place is selected and auto-pinned */}
      {selectedPlace && isLoaded && mapReady && !error && (
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
            <div className="flex flex-wrap gap-1 mb-2">
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
            <div className="text-xs text-gray-500 font-mono">
              📍 {selectedPlace.geometry.location.lat.toFixed(4)}, {selectedPlace.geometry.location.lng.toFixed(4)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapContainer;