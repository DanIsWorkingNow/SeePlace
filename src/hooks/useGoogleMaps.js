// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for integrating Google Maps functionality into a React component. 
// The hook initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the Google Maps JavaScript API and Redux for state management. 
// The hook returns the map instance, a loading state, and the current markers on the map.
// It also listens for changes in the selected place and updates the map accordingly.
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { googleMapsService } from '../services/googleMapsService';

export const useGoogleMaps = (containerId) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const markersRef = useRef([]);
  const initializationAttempted = useRef(false);
  
  const { selectedPlace } = useSelector(state => state.places);

  useEffect(() => {
    const initMap = async () => {
      // Prevent multiple initialization attempts
      if (initializationAttempted.current) return;
      
      try {
        console.log('🗺️ useGoogleMaps: Starting map initialization...');
        console.log('🗺️ useGoogleMaps: Looking for element:', containerId);
        
        // Wait for DOM element to be ready
        const waitForElement = () => {
          return new Promise((resolve, reject) => {
            const checkElement = () => {
              const element = document.getElementById(containerId);
              if (element) {
                console.log('✅ useGoogleMaps: Element found:', element);
                resolve(element);
              } else {
                console.log('⏳ useGoogleMaps: Element not found, retrying...');
                setTimeout(checkElement, 100); // Check every 100ms
              }
            };
            
            // Start checking immediately
            checkElement();
            
            // Timeout after 10 seconds
            setTimeout(() => {
              reject(new Error(`Element with id '${containerId}' not found after 10 seconds`));
            }, 10000);
          });
        };

        // Wait for element to be available
        await waitForElement();
        
        initializationAttempted.current = true;
        
        console.log('🚀 useGoogleMaps: Initializing Google Maps...');
        await googleMapsService.initialize();
        
        console.log('🗺️ useGoogleMaps: Creating map instance...');
        const mapInstance = googleMapsService.createMap(containerId);
        
        console.log('✅ useGoogleMaps: Map created successfully');
        setMap(mapInstance);
        setIsLoaded(true);
        setError(null);
        
      } catch (error) {
        console.error('❌ useGoogleMaps: Failed to initialize map:', error);
        setError(error.message);
        setIsLoaded(false);
        initializationAttempted.current = false; // Allow retry
      }
    };

    if (containerId && !map && !initializationAttempted.current) {
      // Small delay to ensure DOM is ready
      setTimeout(initMap, 100);
    }
  }, [containerId, map]);

  // Handle selected place changes
  useEffect(() => {
    if (!map || !selectedPlace) return;

    console.log('📍 useGoogleMaps: Updating map with selected place:', selectedPlace);

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (selectedPlace.geometry) {
      try {
        const marker = googleMapsService.createMarker(
          map,
          selectedPlace.geometry.location,
          selectedPlace.name
        );
        
        markersRef.current.push(marker);
        map.setCenter(selectedPlace.geometry.location);
        map.setZoom(15);
        
        console.log('✅ useGoogleMaps: Marker added successfully');
      } catch (error) {
        console.error('❌ useGoogleMaps: Failed to add marker:', error);
      }
    }
  }, [map, selectedPlace]);

  return {
    map,
    isLoaded,
    error
  };
};