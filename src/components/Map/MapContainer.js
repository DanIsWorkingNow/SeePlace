// This file is part of the Google Places Redux Saga project.
// It defines the MapContainer component that integrates Google Maps functionality into the application.    
// The component initializes a Google Map instance, manages markers, and provides the current map state.
// It uses the useGoogleMaps hook to handle map-related logic and displays the map along with       
// information about the selected place.
// The component also handles loading states and errors related to the map initialization.  
// The map is displayed within a responsive container, and the selected place's details are shown in an overlay.
// The component is styled using Tailwind CSS for a modern and responsive design.   
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import LoadingSpinner from '../common/LoadingSpinner';

const MapContainer = () => {
  const [mapError, setMapError] = useState(null);
  const { selectedPlace } = useSelector(state => state.places);
  const { mapLoading } = useSelector(state => state.ui);
  
  const { map, isLoaded } = useGoogleMaps('google-map');

  useEffect(() => {
    const handleMapError = (error) => {
      console.error('Map error:', error);
      setMapError('Failed to load map. Please check your API key and internet connection.');
    };

    window.addEventListener('error', handleMapError);
    return () => window.removeEventListener('error', handleMapError);
  }, []);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <div className="text-gray-600">{mapError}</div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isLoaded || mapLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <div className="mt-4 text-gray-600">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div 
        id="google-map" 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
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