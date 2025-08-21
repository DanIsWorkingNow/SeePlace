// UPDATED: src/components/PlaceSearchApp.js
// Enlarged map container for better map viewing experience
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
          {/* 🔥 UPDATED: Changed grid layout to give more space to map */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            
            {/* Left sidebar - reduced width on extra large screens */}
            <div className="xl:col-span-1 space-y-6">
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
            
            {/* Map section - enlarged and takes more space */}
            <div className="xl:col-span-3">
              {/* 🔥 ENLARGED: Increased height from 600px to 800px */}
              <div 
                className="bg-white rounded-lg shadow-md overflow-hidden"
                style={{ 
                  height: '800px', // Increased from 600px
                  minHeight: '800px', // Increased from 600px
                  maxHeight: '800px', // Increased from 600px
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div className="p-6 pb-4 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Map View
                  </h2>
                </div>
                
                {/* ENLARGED: Updated calculations for larger map */}
                <div 
                  className="map-container-parent flex-1"
                  style={{ 
                    minHeight: '700px', // Increased from 500px
                    height: 'calc(800px - 100px)', // Updated calculation for new height
                    position: 'relative',
                    width: '100%',
                    overflow: 'hidden',
                    padding: '0 24px 24px 24px' // Maintain padding
                  }}
                >
                  <MapContainer />
                </div>
              </div>
            </div>
            
          </div>
          
          {/* 🆕 OPTIONAL: Full-width map option for even larger viewing */}
          {/* Uncomment this section if you want an even larger full-width map option */}
          {/*
          <div className="mt-8">
            <div 
              className="bg-white rounded-lg shadow-md overflow-hidden"
              style={{ 
                height: '70vh', // 70% of viewport height
                minHeight: '600px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div className="p-6 pb-4 flex-shrink-0">
                <h2 className="text-xl font-semibold text-gray-800">
                  🗺️ Full-Width Map View
                </h2>
              </div>
              
              <div 
                className="map-container-parent flex-1"
                style={{ 
                  minHeight: 'calc(70vh - 100px)',
                  height: 'calc(100% - 100px)',
                  position: 'relative',
                  width: '100%',
                  overflow: 'hidden',
                  padding: '0 24px 24px 24px'
                }}
              >
                <MapContainer />
              </div>
            </div>
          </div>
          */}
          
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default PlaceSearchApp;