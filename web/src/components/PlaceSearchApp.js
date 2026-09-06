// Main application shell. Left column: SeeNoise building picker + noise-risk
// panel, then the Google Places search (secondary, "find any address").
// Right column: the map.
import React from 'react';
import PlaceAutocomplete from './PlaceAutocomplete/PlaceAutocomplete';
import MapContainer from './Map/MapContainer';
import SearchHistory from './SearchHistory/SearchHistory';
import BuildingPicker from './BuildingPicker/BuildingPicker';
import NoisePanel from './NoisePanel/NoisePanel';
import ErrorBoundary from './common/ErrorBoundary';
import Header from './common/Header';

const Card = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    {title && (
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
    )}
    {children}
  </div>
);

const PlaceSearchApp = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Header />

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left sidebar */}
            <div className="xl:col-span-1 space-y-6">
              <Card title="Building">
                <BuildingPicker />
              </Card>

              <Card title="Noise risk">
                <NoisePanel />
              </Card>

              <Card title="Find any address">
                <PlaceAutocomplete />
              </Card>

              <Card>
                <SearchHistory />
              </Card>
            </div>

            {/* Map */}
            <div className="xl:col-span-3">
              <div
                className="bg-white rounded-lg shadow-md overflow-hidden"
                style={{
                  height: '800px',
                  minHeight: '800px',
                  maxHeight: '800px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div className="p-6 pb-4 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-800">Map View</h2>
                </div>

                <div
                  className="map-container-parent flex-1"
                  style={{
                    minHeight: '700px',
                    height: 'calc(800px - 100px)',
                    position: 'relative',
                    width: '100%',
                    overflow: 'hidden',
                    padding: '0 24px 24px 24px',
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
