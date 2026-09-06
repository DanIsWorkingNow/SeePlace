import React from 'react';

const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔊</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SeeNoise</h1>
              <p className="text-sm text-gray-600">
                Noise-exposure risk for Klang Valley high-rises
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Data: TomTom traffic · KTM GTFS · OpenStreetMap
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
