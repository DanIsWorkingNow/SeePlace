// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for integrating Google Maps functionality into a React component. 
// The hook initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the Google Maps JavaScript API and Redux for state management. 
// The hook returns the map instance, a loading state, and the current markers on the map.
// It also listens for changes in the selected place and updates the map accordingly.
// Fixed useGoogleMaps.js - Resolves DOM timing issues
// Fixed useGoogleMaps.js - Replace your ENTIRE src/hooks/useGoogleMaps.js with this
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { googleMapsService } from '../services/googleMapsService';

export const useGoogleMaps = (containerId) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const markersRef = useRef([]);
  const initializationAttempted = useRef(false);
  
  const { selectedPlace } = useSelector(state => state.places);

  // Reset function for retries
  const resetInitialization = useCallback(() => {
    console.log('🔄 useGoogleMaps: Resetting initialization');
    initializationAttempted.current = false;
    setError(null);
    setIsLoaded(false);
    setMap(null);
  }, []);

  // Simplified initialization - element should always exist now
  const initMap = useCallback(async () => {
    if (initializationAttempted.current) {
      console.log('🛑 useGoogleMaps: Already attempted, skipping');
      return;
    }
    
    console.log('🗺️ useGoogleMaps: Starting map initialization...');
    initializationAttempted.current = true;
    
    try {
      // Check if element exists
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Element with id '${containerId}' not found`);
      }
      
      console.log('✅ useGoogleMaps: Element found:', element);
      console.log('✅ useGoogleMaps: Element dimensions:', {
        width: element.offsetWidth,
        height: element.offsetHeight,
        visible: element.offsetWidth > 0 && element.offsetHeight > 0
      });
      
      // Initialize Google Maps API
      console.log('🚀 useGoogleMaps: Initializing Google Maps API...');
      await googleMapsService.initialize();
      
      // Create map instance
      console.log('🗺️ useGoogleMaps: Creating map instance...');
      const mapInstance = googleMapsService.createMap(containerId);
      
      if (!mapInstance) {
        throw new Error('Failed to create map instance');
      }
      
      console.log('✅ useGoogleMaps: Map created successfully!');
      setMap(mapInstance);
      setIsLoaded(true);
      setError(null);
      
    } catch (error) {
      console.error('❌ useGoogleMaps: Failed to initialize map:', error);
      setError(error.message);
      setIsLoaded(false);
      initializationAttempted.current = false; // Allow retry
    }
  }, [containerId]);

  // Main initialization effect
  useEffect(() => {
    if (containerId && !map && !initializationAttempted.current) {
      // Give a moment for the element to be fully rendered
      const timer = setTimeout(() => {
        initMap();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [containerId, map, initMap]);

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

  // Cleanup effect
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, []);

  return {
    map,
    isLoaded,
    error,
    resetInitialization
  };
};