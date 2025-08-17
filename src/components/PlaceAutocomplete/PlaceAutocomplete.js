// This file is part of the Google Places Redux Saga project.
// It defines the main application component for the Google Places search application.  
// The component integrates various sub-components such as PlaceAutocomplete, MapContainer, and SearchHistory.
// It also includes an ErrorBoundary to catch errors in the component tree. 
// The main layout is styled using Tailwind CSS classes for a responsive design.

import React, { useState, useRef, useEffect } from 'react';
import { usePlaces } from '../../hooks/usePlaces';
import { useDebounce } from '../../hooks/useDebounce';
import LoadingSpinner from '../common/LoadingSpinner';

const PlaceAutocomplete = () => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  const {
    suggestions,
    searchLoading,
    error,
    searchPlaces,
    selectPlace,
    clearSuggestions
  } = usePlaces();

  const debouncedSearch = useDebounce((searchQuery) => {
    if (searchQuery.trim().length >= 2) {
      searchPlaces(searchQuery);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  }, 300);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setFocusedIndex(-1);
    debouncedSearch(value);
  };

  const handlePlaceSelect = (place) => {
    selectPlace(place, query);
    setQuery(place.description);
    setShowSuggestions(false);
    setFocusedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && suggestions[focusedIndex]) {
          handlePlaceSelect(suggestions[focusedIndex]);
        }
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target) &&
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    clearSuggestions();
    setShowSuggestions(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Search for places in Malaysia..."
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
          autoComplete="off"
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {searchLoading ? (
            <LoadingSpinner size="sm" />
          ) : query ? (
            <button
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((place, index) => (
            <SuggestionItem
              key={place.place_id}
              place={place}
              isSelected={index === focusedIndex}
              onClick={() => handlePlaceSelect(place)}
            />
          ))}
        </div>
      )}

      {showSuggestions && !searchLoading && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No places found for "{query}"
        </div>
      )}
    </div>
  );
};

const SuggestionItem = ({ place, isSelected, onClick }) => {
  const getPlaceIcon = (types) => {
    if (types?.includes('restaurant') || types?.includes('food')) return '🍽️';
    if (types?.includes('gas_station')) return '⛽';
    if (types?.includes('hospital')) return '🏥';
    if (types?.includes('school')) return '🏫';
    if (types?.includes('bank')) return '🏦';
    if (types?.includes('shopping_mall')) return '🛒';
    return '📍';
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        <span className="text-lg flex-shrink-0 mt-0.5">
          {getPlaceIcon(place.types || [])}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {place.structured_formatting?.main_text || place.description}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {place.structured_formatting?.secondary_text || ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceAutocomplete;