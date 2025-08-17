// This file is part of the Google Places Redux Saga project.
// It defines a custom React hook for integrating Google Maps functionality into a React component. 
// The hook initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the Google Maps JavaScript API and Redux for state management. 
// The hook returns the map instance, a loading state, and the current markers on the map.
// It also listens for changes in the selected place and updates the map accordingly.
// Fixed useGoogleMaps.js - Resolves DOM timing issues
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { googleMapsService } from '../services/googleMapsService';

export const useGoogleMaps = (containerId) => {
  const [map, setMap] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const markersRef = useRef([]);
  const initializationAttempted = useRef(false);
  const retryTimeoutRef = useRef(null);
  
  const { selectedPlace } = useSelector(state => state.places);

  // Enhanced element waiting with better DOM checking
  const waitForElement = useCallback((elementId) => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 150; // 15 seconds with 100ms intervals
      
      const checkElement = () => {
        attempts++;
        const element = document.getElementById(elementId);
        
        if (element && element.offsetParent !== null) {
          // Element exists and is visible/rendered
          console.log(`✅ useGoogleMaps: Element found after ${attempts} attempts:`, element);
          resolve(element);
          return;
        }
        
        if (attempts >= maxAttempts) {
          reject(new Error(`Element with id '${elementId}' not found after ${attempts} attempts (${attempts * 100}ms)`));
          return;
        }
        
        console.log(`⏳ useGoogleMaps: Attempt ${attempts}/${maxAttempts} - Element not ready, retrying...`);
        setTimeout(checkElement, 100);
      };
      
      // Start checking immediately
      checkElement();
    });
  }, []);

  // Reset function for retries
  const resetInitialization = useCallback(() => {
    initializationAttempted.current = false;
    setError(null);
    setIsLoaded(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  const initMap = useCallback(async () => {
    // Prevent multiple initialization attempts
    if (initializationAttempted.current) {
      console.log('🛑 useGoogleMaps: Initialization already attempted, skipping...');
      return;
    }
    
    console.log('🗺️ useGoogleMaps: Starting map initialization...');
    console.log('🗺️ useGoogleMaps: Looking for element:', containerId);
    
    try {
      initializationAttempted.current = true;
      
      // Step 1: Wait for DOM element to be ready
      await waitForElement(containerId);
      
      // Step 2: Initialize Google Maps API
      console.log('🚀 useGoogleMaps: Initializing Google Maps API...');
      await googleMapsService.initialize();
      
      // Step 3: Verify element still exists after API initialization
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Element '${containerId}' disappeared during initialization`);
      }
      
      // Step 4: Create map instance
      console.log('🗺️ useGoogleMaps: Creating map instance...');
      const mapInstance = googleMapsService.createMap(containerId);
      
      if (!mapInstance) {
        throw new Error('Failed to create map instance');
      }
      
      console.log('✅ useGoogleMaps: Map created successfully');
      setMap(mapInstance);
      setIsLoaded(true);
      setError(null);
      
    } catch (error) {
      console.error('❌ useGoogleMaps: Failed to initialize map:', error);
      setError(error.message);
      setIsLoaded(false);
      initializationAttempted.current = false; // Allow retry
      
      // Auto-retry after 3 seconds if it's a timing issue
      if (error.message.includes('not found') || error.message.includes('disappeared')) {
        console.log('🔄 useGoogleMaps: Scheduling retry in 3 seconds...');
        retryTimeoutRef.current = setTimeout(() => {
          if (!map && containerId) {
            console.log('🔄 useGoogleMaps: Retrying initialization...');
            initMap();
          }
        }, 3000);
      }
    }
  }, [containerId, map, waitForElement]);

  // Main initialization effect
  useEffect(() => {
    if (containerId && !map && !initializationAttempted.current) {
      // Use requestAnimationFrame to ensure DOM is fully ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          initMap();
        }, 50); // Small delay to ensure complete DOM rendering
      });
    }

    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
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
      // Clear all markers on unmount
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