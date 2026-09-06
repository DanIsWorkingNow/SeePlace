// This file is part of the Google Places Redux Saga project.
// It defines the SearchHistory component that displays the user's search history for places.   
// The component allows users to select a place from their search history and clear the history.
// It uses the usePlaces hook to access the search history and provides a user-friendly interface for
// managing search history items. The component is styled using Tailwind CSS for a modern and responsive design.

import React from 'react';
import { usePlaces } from '../../hooks/usePlaces';
import SearchHistoryItem from './SearchHistoryItem';

const SearchHistory = () => {
  const { searchHistory, clearHistory, selectPlace } = usePlaces();

  const handleSelectFromHistory = (historyItem) => {
    selectPlace(historyItem.place, historyItem.query);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all search history?')) {
      clearHistory();
    }
  };

  if (searchHistory.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Search History
        </h2>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🔍</div>
          <p>No search history yet</p>
          <p className="text-sm">Places you search will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Search History
        </h2>
        <button
          onClick={handleClearHistory}
          className="text-sm text-red-600 hover:text-red-800 transition-colors"
        >
          Clear All
        </button>
      </div>
      
      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
        {searchHistory.map((item) => (
          <SearchHistoryItem
            key={item.id}
            item={item}
            onSelect={() => handleSelectFromHistory(item)}
          />
        ))}
      </div>
    </div>
  );
};

export default SearchHistory;