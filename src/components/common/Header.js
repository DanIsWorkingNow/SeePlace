// This file is part of the Google Places Redux Saga project.
// It defines the Header component that displays the application header with a title and description.   
// The header is styled using Tailwind CSS for a modern and responsive design.
// It includes a logo and a brief description of the application, providing context to the user about
// the purpose of the application, which is to explore places using Google Maps.
// The Header component is used in the main application layout to provide a consistent header across the application.   

import React from 'react';

const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🗺️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                SeePlace Explorer
              </h1>
              <p className="text-sm text-gray-600">
                Discover places in Malaysia with Google Maps
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Powered by Google Places API
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;