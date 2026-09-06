// ===== 5. src/components/SearchHistory/SearchHistoryItem.js =====
import React from 'react';

const SearchHistoryItem = ({ item, onSelect }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      onClick={onSelect}
      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {item.place.name}
          </div>
          <div className="text-sm text-gray-500 truncate mt-1">
            {item.place.formatted_address}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Searched: {formatTimestamp(item.timestamp)}
          </div>
        </div>
        <div className="ml-3 text-gray-400 group-hover:text-blue-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default SearchHistoryItem;