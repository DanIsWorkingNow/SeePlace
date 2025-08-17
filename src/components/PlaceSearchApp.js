// This file is part of the Google Places Redux Saga project.
// It defines the main application component for the Google Places search application.
// The component integrates various sub-components such as PlaceAutocomplete, MapContainer, and SearchHistory.  
// It also includes an ErrorBoundary to catch errors in the component tree.
// The main layout is styled using Tailwind CSS classes for a responsive design.    
import React from 'react';
import PlaceAutocomplete from './PlaceAutocomplete/PlaceAutocomplete';
import MapContainer from './Map/MapContainer';
import SearchHistory from './SearchHistory/SearchHistory';
import ErrorBoundary from './common/ErrorBoundary';
import Header from './common/Header';

const PlaceSearchApp = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-1 space-y-6">
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
              <div className="bg-white rounded-lg shadow-md p-6 h-[600px]">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Map View
                </h2>
                <MapContainer />
              </div>
            </div>
            
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default PlaceSearchApp;