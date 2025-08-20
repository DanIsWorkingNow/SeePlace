// This file is part of the Google Places Redux Saga project.
// It defines the main application component for the Google Places search application.
// The component integrates various sub-components such as PlaceAutocomplete, MapContainer, and SearchHistory.  
// It also includes an ErrorBoundary to catch errors in the component tree.
// The main layout is styled using Tailwind CSS classes for a responsive design.    
// Complete PlaceSearchApp.js Solution - Replace your entire src/components/PlaceSearchApp.js with this
import React from 'react';
import PlaceAutocomplete from './PlaceAutocomplete/PlaceAutocomplete';
import MapContainer from './Map/MapContainer';
import SearchHistory from './SearchHistory/SearchHistory';
import ErrorBoundary from './common/ErrorBoundary';
import Header from './common/Header';
import AutoPinningDemo from './AutoPinningDemo/AutoPinningDemo';

const PlaceSearchApp = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 space-y-6">
              
              {/* ADD THIS: Auto-Pinning Demo Component */}
              <AutoPinningDemo />
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Search Places
                </h2>
                <PlaceAutocomplete />
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <SearchHistory />
              </div>
            </div>
            
            <div className="lg:col-span-2">
              {/* ENHANCED: Explicit sizing for map container */}
              <div 
                className="bg-white rounded-lg shadow-md p-6"
                style={{ 
                  height: '600px',
                  minHeight: '600px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Map View
                </h2>
                {/* ENHANCED: Map container with explicit flex growth */}
                <div 
                  className="map-container-parent"
                  style={{ 
                    flex: 1,
                    minHeight: '500px',
                    position: 'relative',
                    width: '100%',
                    height: '100%'
                  }}
                >
                  <MapContainer />
                </div>
              </div>
            </div>
            
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default PlaceSearchApp;