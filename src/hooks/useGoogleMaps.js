// FIXED: src/hooks/useGoogleMaps.js
// Stable auto-pinning without Redux serialization issues
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { googleMapsService } from '../services/googleMapsService';

export const useGoogleMaps = (containerId) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for managing map instances and markers
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const initializationAttempted = useRef(false);
  const lastProcessedPlaceId = useRef(null); // Prevent duplicate processing
  
  // Get selected place from Redux (now with serialized data)
  const selectedPlace = useSelector(state => state.places.selectedPlace);

  // 🔧 STABLE MAP INITIALIZATION - Fixed timing issues
  const initMap = useCallback(async () => {
    if (!containerId || mapInstanceRef.current || initializationAttempted.current) {
      return;
    }

    initializationAttempted.current = true;
    console.log('🗺️ useGoogleMaps: Starting map initialization...');

    try {
      // Wait for DOM element with retries
      let attempts = 0;
      let mapElement = null;
      
      while (!mapElement && attempts < 50) { // Reduced attempts for faster feedback
        mapElement = document.getElementById(containerId);
        if (!mapElement) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }

      if (!mapElement) {
        throw new Error(`Map container '${containerId}' not found after ${attempts} attempts`);
      }

      // Initialize map with proper error handling
      const mapInstance = await googleMapsService.createMap(containerId, {
        center: { lat: 3.139, lng: 101.686 }, // Kuala Lumpur default
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      });

      if (!mapInstance) {
        throw new Error('Failed to create map instance');
      }

      // Store references
      mapInstanceRef.current = mapInstance;
      setMap(mapInstance);
      setIsLoaded(true);
      setError(null);

      console.log('✅ useGoogleMaps: Map initialized successfully!');

    } catch (error) {
      console.error('❌ useGoogleMaps: Map initialization failed:', error);
      setError(error.message);
      setIsLoaded(false);
      setMap(null);
      mapInstanceRef.current = null;
      initializationAttempted.current = false; // Allow retry
    }
  }, [containerId]);

  // Initialize map on mount
  useEffect(() => {
    if (!containerId || map || initializationAttempted.current) {
      return;
    }

    // Small delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
      initMap();
    }, 100);

    return () => clearTimeout(initTimer);
  }, [containerId, map, initMap]);

  // 🎯 FIXED AUTO-PINNING - Stable and efficient
  useEffect(() => {
    if (!map || !selectedPlace || !selectedPlace.geometry?.location) {
      return;
    }

    // Prevent duplicate processing of same place
    const placeId = selectedPlace.place_id || selectedPlace.name;
    if (placeId === lastProcessedPlaceId.current) {
      console.log('🔄 useGoogleMaps: Skipping duplicate place processing');
      return;
    }
    
    lastProcessedPlaceId.current = placeId;
    console.log('📍 useGoogleMaps: AUTO-PINNING started for:', selectedPlace.name);

    try {
      // Clear existing markers
      markersRef.current.forEach(marker => {
        try {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn('Could not remove marker:', e);
        }
      });
      markersRef.current = [];

      // Extract coordinates (now always serialized from Redux)
      const location = selectedPlace.geometry.location;
      const position = {
        lat: location.lat,
        lng: location.lng
      };

      console.log('📍 useGoogleMaps: Pinning location:', position);

      // Create new marker
      const marker = googleMapsService.createMarker(
        map,
        position,
        selectedPlace.name || 'Selected Place'
      );

      if (marker) {
        markersRef.current.push(marker);

        // Center map to new location
        map.setCenter(position);
        map.setZoom(15);

        // Add subtle bounce animation
        if (window.google?.maps?.Animation?.BOUNCE) {
          marker.setAnimation(window.google.maps.Animation.BOUNCE);
          
          // Stop bouncing after 1.5 seconds
          setTimeout(() => {
            try {
              if (marker && marker.setAnimation) {
                marker.setAnimation(null);
              }
            } catch (e) {
              console.warn('Could not stop marker animation:', e);
            }
          }, 1500);
        }

        console.log('✅ useGoogleMaps: AUTO-PIN successful for:', selectedPlace.name);
        
      } else {
        console.warn('⚠️ useGoogleMaps: Failed to create marker');
      }

    } catch (error) {
      console.error('❌ useGoogleMaps: Auto-pinning failed:', error);
      setError(`Auto-pinning failed: ${error.message}`);
    }
  }, [map, selectedPlace]); // Dependencies: map and selectedPlace

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up markers
      markersRef.current.forEach(marker => {
        try {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      });
      
      // Reset refs
      markersRef.current = [];
      mapInstanceRef.current = null;
      lastProcessedPlaceId.current = null;
      initializationAttempted.current = false;
    };
  }, []);

  // Return stable interface
  return {
    map,
    isLoaded,
    error,
    // Helper methods for external use
    addMarker: useCallback((position, title) => {
      if (!map) return null;
      
      const marker = googleMapsService.createMarker(map, position, title);
      if (marker) {
        markersRef.current.push(marker);
      }
      return marker;
    }, [map]),
    
    clearMarkers: useCallback(() => {
      markersRef.current.forEach(marker => {
        try {
          if (marker && marker.setMap) {
            marker.setMap(null);
          }
        } catch (e) {
          console.warn('Could not clear marker:', e);
        }
      });
      markersRef.current = [];
    }, []),
    
    centerMap: useCallback((position, zoom = 15) => {
      if (map && position) {
        map.setCenter(position);
        map.setZoom(zoom);
      }
    }, [map])
  };
};