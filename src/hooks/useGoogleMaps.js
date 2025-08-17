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
  const markersRef = useRef([]);
  
  const { selectedPlace } = useSelector(state => state.places);

  useEffect(() => {
    const initMap = async () => {
      try {
        await googleMapsService.initialize();
        const mapInstance = googleMapsService.createMap(containerId);
        setMap(mapInstance);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    };

    if (containerId) {
      initMap();
    }
  }, [containerId]);

  useEffect(() => {
    if (!map || !selectedPlace) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (selectedPlace.geometry) {
      const marker = googleMapsService.createMarker(
        map,
        selectedPlace.geometry.location,
        selectedPlace.name
      );
      
      markersRef.current.push(marker);
      map.setCenter(selectedPlace.geometry.location);
      map.setZoom(15);
    }
  }, [map, selectedPlace]);

  return {
    map,
    isLoaded
    // Removed markers from return since it's not used
  };
};