// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for integrating Google Maps functionality into a React component. 
// The hook initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the Google Maps JavaScript API and Redux for state management. 
// The hook returns the map instance, a loading state, and the current markers on the map.
// It also listens for changes in the selected place and updates the map accordingly.
// REPLACE: src/hooks/useGoogleMaps.js
// Enhanced hook with reliable initialization and auto-pinning functionality
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { googleMapsService } from '../services/googleMapsService';

export const useGoogleMaps = (containerId) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const markersRef = useRef([]);
  const initializationAttempted = useRef(false);
  const mapInstanceRef = useRef(null);
  
  const { selectedPlace } = useSelector(state => state.places);

  // Reset function for retries
  const resetInitialization = useCallback(() => {
    console.log('🔄 useGoogleMaps: Resetting initialization...');
    initializationAttempted.current = false;
    setError(null);
    setIsLoaded(false);
    setMap(null);
    mapInstanceRef.current = null;
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        marker.setMap(null);
      } catch (e) {
        console.warn('Could not clear marker:', e);
      }
    });
    markersRef.current = [];
  }, []);

  // Enhanced initialization function with better error handling
  const initMap = useCallback(async () => {
    if (initializationAttempted.current) {
      console.log('🛑 useGoogleMaps: Initialization already attempted');
      return;
    }

    console.log('🗺️ useGoogleMaps: Starting map initialization...');
    
    try {
      initializationAttempted.current = true;
      setError(null);
      
      // Step 1: Verify DOM element exists
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Element with id '${containerId}' not found in DOM`);
      }

      console.log('✅ useGoogleMaps: DOM element found:', {
        id: containerId,
        width: element.offsetWidth,
        height: element.offsetHeight,
        visible: element.offsetParent !== null
      });

      // Step 2: Initialize Google Maps API through service
      console.log('🚀 useGoogleMaps: Initializing Google Maps API...');
      await googleMapsService.initialize();
      
      if (!googleMapsService.isReady()) {
        throw new Error('Google Maps service is not ready after initialization');
      }

      // Step 3: Create map instance with enhanced options
      console.log('🗺️ useGoogleMaps: Creating map instance...');
      const mapInstance = await googleMapsService.createMap(containerId, {
        lat: 3.1390, // Default center: Malaysia
        lng: 101.6869
      });

      if (!mapInstance) {
        throw new Error('Failed to create map instance - createMap returned null');
      }

      // Store map instance
      mapInstanceRef.current = mapInstance;
      setMap(mapInstance);
      setIsLoaded(true);
      setError(null);

      console.log('✅ useGoogleMaps: Map initialization completed successfully!');

    } catch (error) {
      console.error('❌ useGoogleMaps: Map initialization failed:', error);
      setError(error.message);
      setIsLoaded(false);
      setMap(null);
      mapInstanceRef.current = null;
      initializationAttempted.current = false; // Allow retry
    }
  }, [containerId]);

  // Main initialization effect with improved timing
  useEffect(() => {
    if (!containerId || map || initializationAttempted.current) {
      return;
    }

    // Use a short delay to ensure DOM is fully ready
    const initTimer = setTimeout(() => {
      initMap();
    }, 150);

    return () => clearTimeout(initTimer);
  }, [containerId, map, initMap]);

  // 🎯 CORE AUTO-PINNING FUNCTIONALITY
  useEffect(() => {
    if (!map || !selectedPlace) {
      return;
    }

    console.log('📍 useGoogleMaps: AUTO-PINNING triggered for place:', selectedPlace.name);

    // Clear all existing markers first
    markersRef.current.forEach(marker => {
      try {
        marker.setMap(null);
      } catch (e) {
        console.warn('Could not remove existing marker:', e);
      }
    });
    markersRef.current = [];

    // Check if place has geometry data for pinning
    if (!selectedPlace.geometry || !selectedPlace.geometry.location) {
      console.warn('⚠️ useGoogleMaps: Selected place has no geometry data for auto-pinning:', selectedPlace);
      return;
    }

    try {
      // Create new marker at selected location
      const marker = googleMapsService.createMarker(
        map,
        selectedPlace.geometry.location,
        selectedPlace.name || 'Selected Place'
      );
      
      if (marker) {
        // Store marker reference for cleanup
        markersRef.current.push(marker);
        
        // Auto-center map to selected location
        map.setCenter(selectedPlace.geometry.location);
        
        // Set appropriate zoom level
        map.setZoom(15);
        
        // Add bounce animation for visual feedback
        if (window.google?.maps?.Animation?.BOUNCE) {
          marker.setAnimation(window.google.maps.Animation.BOUNCE);
          
          // Stop bouncing after 2 seconds
          setTimeout(() => {
            try {
              marker.setAnimation(null);
            } catch (e) {
              console.warn('Could not stop marker animation:', e);
            }
          }, 2000);
        }
        
        console.log('✅ useGoogleMaps: AUTO-PIN successful!', {
          place: selectedPlace.name,
          location: selectedPlace.geometry.location,
          markerCreated: true,
          mapCentered: true,
          zoom: 15
        });

        // Optional: Add info window for enhanced UX
        if (window.google?.maps?.InfoWindow) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">
                  ${selectedPlace.name}
                </h3>
                ${selectedPlace.formatted_address ? 
                  `<p style="margin: 0; font-size: 12px; color: #666;">
                    ${selectedPlace.formatted_address}
                   </p>` : ''
                }
              </div>
            `
          });

          // Show info window briefly
          infoWindow.open(map, marker);
          
          // Auto-close after 3 seconds
          setTimeout(() => {
            try {
              infoWindow.close();
            } catch (e) {
              console.warn('Could not close info window:', e);
            }
          }, 3000);
        }

      } else {
        console.error('❌ useGoogleMaps: Failed to create marker - createMarker returned null');
      }
      
    } catch (error) {
      console.error('❌ useGoogleMaps: Auto-pinning failed:', error);
    }
    
  }, [map, selectedPlace]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('🧹 useGoogleMaps: Cleaning up markers and map...');
      
      // Clear all markers
      markersRef.current.forEach(marker => {
        try {
          marker.setMap(null);
        } catch (e) {
          console.warn('Could not clear marker during cleanup:', e);
        }
      });
      markersRef.current = [];
      
      // Clear map reference
      mapInstanceRef.current = null;
    };
  }, []);

  // Debug helper for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.debugGoogleMaps = () => {
        console.log('🔍 Google Maps Debug Info:', {
          containerId,
          mapLoaded: !!map,
          isLoaded,
          error,
          selectedPlace: selectedPlace?.name || 'None',
          markersCount: markersRef.current.length,
          serviceStatus: googleMapsService.getStatus ? googleMapsService.getStatus() : 'Status unavailable'
        });
      };
    }
  }, [containerId, map, isLoaded, error, selectedPlace]);

  return {
    map,
    isLoaded,
    error,
    resetInitialization
  };
};