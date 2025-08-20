
// Demo component to test and demonstrate auto-pinning functionality
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectPlace } from '../../store/slices/placesSlice';

const AutoPinningDemo = () => {
  const dispatch = useDispatch();
  const { selectedPlace } = useSelector(state => state.places);
  const { mapLoading } = useSelector(state => state.ui);
  const [isTestMode, setIsTestMode] = useState(false);
  const [lastTestedPlace, setLastTestedPlace] = useState(null);

  // Sample places for testing auto-pinning across Malaysia
  const testPlaces = [
    {
      name: 'Petronas Twin Towers',
      place_id: 'ChIJRzxL8BC4zDERdU3yFGBfMLs',
      geometry: {
        location: { lat: 3.1579, lng: 101.7116 }
      },
      formatted_address: 'Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
      types: ['tourist_attraction', 'point_of_interest', 'establishment'],
      description: 'Iconic twin skyscrapers in Kuala Lumpur'
    },
    {
      name: 'Batu Caves',
      place_id: 'ChIJfzzsckm4zDERlJw0qQY2dn4',
      geometry: {
        location: { lat: 3.2371, lng: 101.6840 }
      },
      formatted_address: 'Gombak, 68100 Batu Caves, Selangor, Malaysia',
      types: ['tourist_attraction', 'hindu_temple', 'point_of_interest'],
      description: 'Famous limestone caves with Hindu temples'
    },
    {
      name: 'Central Market Kuala Lumpur',
      place_id: 'ChIJsZM4aPC4zDER7NR_kQvKC7Y',
      geometry: {
        location: { lat: 3.1425, lng: 101.6969 }
      },
      formatted_address: 'Jalan Hang Kasturi, City Centre, 50050 Kuala Lumpur, Malaysia',
      types: ['shopping_mall', 'tourist_attraction', 'point_of_interest'],
      description: 'Historic cultural center and shopping destination'
    },
    {
      name: 'Menara KL Tower',
      place_id: 'ChIJ0UXPi_S4zDER0N0BnjqsWvM',
      geometry: {
        location: { lat: 3.1527, lng: 101.7010 }
      },
      formatted_address: 'Jalan Punchak, Off, Jalan P. Ramlee, 50250 Kuala Lumpur, Malaysia',
      types: ['tourist_attraction', 'point_of_interest', 'establishment'],
      description: 'Telecommunications tower with observation deck'
    },
    {
      name: 'Genting Highlands',
      place_id: 'ChIJMzFIBR5OzDERpSSO-g_wGTM',
      geometry: {
        location: { lat: 3.4210, lng: 101.7930 }
      },
      formatted_address: 'Genting Highlands, 69000 Pahang, Malaysia',
      types: ['tourist_attraction', 'locality', 'political'],
      description: 'Highland resort with casino and theme park'
    },
    {
      name: 'Sri Gombak',
      place_id: 'ChIJ3z-ItUm5zDERHgMmMCdXyWM',
      geometry: {
        location: { lat: 3.2597, lng: 101.6525 }
      },
      formatted_address: 'Sri Gombak, Selangor, Malaysia',
      types: ['locality', 'political'],
      description: 'Residential area in Selangor'
    }
  ];

  const handleTestAutoPin = (place) => {
    console.log('🧪 Testing auto-pinning with place:', place.name);
    
    // Store the tested place for UI feedback
    setLastTestedPlace(place);
    
    // Dispatch selectPlace action - this should trigger auto-pinning workflow
    dispatch(selectPlace(place));
    
    // Log the expected behavior for debugging
    console.log('🎯 Expected auto-pinning behavior:');
    console.log('1. Map should center to coordinates:', place.geometry.location);
    console.log('2. Red marker should appear at location');
    console.log('3. Map should zoom to level 15');
    console.log('4. Marker should bounce briefly');
    console.log('5. Info window should show place details');
    console.log('6. Selected place overlay should appear at bottom');
  };

  const handleClearSelection = () => {
    dispatch(selectPlace(null));
    setLastTestedPlace(null);
    console.log('🧹 Cleared place selection');
  };

  const getPlaceIcon = (types) => {
    if (types?.includes('tourist_attraction')) return '🏛️';
    if (types?.includes('hindu_temple')) return '🕉️';
    if (types?.includes('shopping_mall')) return '🛒';
    if (types?.includes('locality')) return '🏘️';
    return '📍';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🎯 Auto-Pinning Demo
            {mapLoading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Test automatic map pinning functionality
          </p>
        </div>
        <button
          onClick={() => setIsTestMode(!isTestMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isTestMode 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {isTestMode ? 'Hide Demo' : 'Show Demo'}
        </button>
      </div>

      {isTestMode && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">🔧 How to Test Auto-Pinning:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Click any place below</strong> to test automatic map pinning</li>
              <li>• <strong>Watch the map</strong> - it should center and pin the location automatically</li>
              <li>• <strong>Check console</strong> for detailed auto-pinning logs</li>
              <li>• <strong>Look for</strong>: "✅ AUTO-PIN successful" message</li>
            </ul>
          </div>

          {/* Current status */}
          {selectedPlace && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-green-800 mb-1">
                    ✅ Currently Auto-Pinned:
                  </div>
                  <div className="text-sm text-green-700">
                    {selectedPlace.name}
                  </div>
                  {selectedPlace.geometry && (
                    <div className="text-xs text-green-600 font-mono mt-1">
                      {selectedPlace.geometry.location.lat.toFixed(4)}, {selectedPlace.geometry.location.lng.toFixed(4)}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1 bg-green-200 text-green-800 text-xs rounded hover:bg-green-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Test places grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {testPlaces.map((place) => {
              const isSelected = selectedPlace?.place_id === place.place_id;
              const wasLastTested = lastTestedPlace?.place_id === place.place_id;
              
              return (
                <button
                  key={place.place_id}
                  onClick={() => handleTestAutoPin(place)}
                  disabled={mapLoading}
                  className={`text-left p-4 border rounded-lg transition-all hover:shadow-md ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500'
                      : wasLastTested
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-blue-25 hover:border-blue-200'
                  } ${mapLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {getPlaceIcon(place.types)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                        {place.name}
                        {isSelected && <span className="text-blue-600 text-sm">📍 Pinned</span>}
                        {wasLastTested && !isSelected && <span className="text-yellow-600 text-sm">🔄 Tested</span>}
                      </div>
                      <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {place.description}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {place.formatted_address}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {place.types.slice(0, 2).map((type) => (
                          <span 
                            key={type}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full"
                          >
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {place.geometry.location.lat.toFixed(4)}, {place.geometry.location.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Debug section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-yellow-800 mb-2">
                🔍 Debug Information (Click to expand)
              </summary>
              <div className="text-xs text-yellow-700 space-y-2 mt-2">
                <div>
                  <strong>Console Logs to Watch For:</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• 🎯 Saga: AUTO-PINNING workflow started</li>
                    <li>• 📍 useGoogleMaps: AUTO-PINNING triggered</li>
                    <li>• ✅ useGoogleMaps: AUTO-PIN successful</li>
                    <li>• ✅ Saga: AUTO-PINNING workflow completed</li>
                  </ul>
                </div>
                <div>
                  <strong>Debug Functions Available:</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• <code>window.debugAutoPinning()</code> - Check auto-pinning status</li>
                    <li>• <code>window.debugGoogleMaps()</code> - Check map status</li>
                    <li>• <code>window.debugSearchWorkflow()</code> - Check search status</li>
                  </ul>
                </div>
                <div className="text-xs text-yellow-600 mt-2">
                  Open browser console (F12) to see detailed logging during auto-pinning tests
                </div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoPinningDemo;