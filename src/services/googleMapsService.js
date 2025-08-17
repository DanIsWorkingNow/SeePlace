// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
// Enhanced googleMapsService.js - Fixed initialization issues
import { Loader } from '@googlemaps/js-api-loader';

class GoogleMapsService {
  constructor() {
    // Validate API key on construction
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ GoogleMapsService: API key not found in environment variables');
      throw new Error('Google Maps API key not found. Please check your .env file.');
    }

    this.loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });
    
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    
    console.log('🚀 GoogleMapsService: Constructor completed');
  }

  async initialize() {
    // If already initialized, return immediately
    if (this.isInitialized && this.google) {
      console.log('✅ GoogleMapsService: Already initialized, returning existing instance');
      return this.google;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('⏳ GoogleMapsService: Initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      console.log('🚀 GoogleMapsService: Starting Google Maps API initialization...');
      
      // Load Google Maps API
      this.google = await this.loader.load();
      console.log('✅ GoogleMapsService: Google Maps API loaded successfully');
      
      // Initialize services
      this.autocompleteService = new this.google.maps.places.AutocompleteService();
      console.log('✅ GoogleMapsService: AutocompleteService created');
      
      this.isInitialized = true;
      console.log('🎉 GoogleMapsService: Initialization complete!');
      
      return this.google;
    } catch (error) {
      console.error('❌ GoogleMapsService: Initialization failed:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      
      // Provide helpful error messages
      let userFriendlyMessage = 'Failed to load Google Maps';
      
      if (error.message.includes('API key')) {
        userFriendlyMessage = 'Invalid Google Maps API key. Please check your configuration.';
      } else if (error.message.includes('network')) {
        userFriendlyMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('quota')) {
        userFriendlyMessage = 'Google Maps quota exceeded. Please check your billing account.';
      }
      
      throw new Error(userFriendlyMessage);
    }
  }

  async searchPlaces(query) {
    try {
      console.log(`🔍 GoogleMapsService: Searching for "${query}"`);
      
      // Validate input
      if (!query || typeof query !== 'string' || query.length < 2) {
        console.log('📝 GoogleMapsService: Query too short, returning empty results');
        return [];
      }

      // Ensure service is initialized
      await this.initialize();
      
      if (!this.autocompleteService) {
        throw new Error('AutocompleteService not available after initialization');
      }

      return new Promise((resolve, reject) => {
        console.log('🌐 GoogleMapsService: Making Places API request...');
        
        this.autocompleteService.getPlacePredictions(
          {
            input: query,
            types: ['establishment', 'geocode'],
            componentRestrictions: { country: 'my' } // Malaysia
          },
          (predictions, status) => {
            console.log(`📊 GoogleMapsService: API Response - Status: ${status}`);
            
            if (status === this.google.maps.places.PlacesServiceStatus.OK) {
              console.log(`✅ GoogleMapsService: Found ${predictions?.length || 0} predictions`);
              resolve(predictions || []);
            } else if (status === this.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              console.log('📭 GoogleMapsService: No results found');
              resolve([]);
            } else {
              console.error(`❌ GoogleMapsService: API Error - Status: ${status}`);
              reject(new Error(`Places API error: ${status}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ GoogleMapsService: Search error:', error);
      throw error;
    }
  }

  async getPlaceDetails(placeId) {
    try {
      console.log(`🏢 GoogleMapsService: Getting details for place ID: ${placeId}`);
      
      if (!placeId) {
        throw new Error('Place ID is required');
      }

      await this.initialize();

      return new Promise((resolve, reject) => {
        // Create a temporary div for PlacesService (required by Google API)
        const div = document.createElement('div');
        const placesService = new this.google.maps.places.PlacesService(div);
        
        placesService.getDetails(
          {
            placeId: placeId,
            fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types', 'photos', 'rating', 'user_ratings_total']
          },
          (place, status) => {
            if (status === this.google.maps.places.PlacesServiceStatus.OK) {
              console.log('✅ GoogleMapsService: Place details retrieved successfully');
              resolve(place);
            } else {
              console.error(`❌ GoogleMapsService: Place details error - Status: ${status}`);
              reject(new Error(`Place details error: ${status}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ GoogleMapsService: Place details error:', error);
      throw error;
    }
  }

  async createMap(elementId, center = { lat: 3.1390, lng: 101.6869 }) {
    try {
      console.log(`🗺️ GoogleMapsService: Creating map for element: ${elementId}`);
      
      await this.initialize();
      
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with id '${elementId}' not found`);
      }

      const map = new this.google.maps.Map(element, {
        zoom: 13,
        center: center,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          // Optional: Add custom map styling here
        ]
      });

      console.log('✅ GoogleMapsService: Map created successfully');
      return map;
    } catch (error) {
      console.error('❌ GoogleMapsService: Map creation error:', error);
      throw error;
    }
  }

  createMarker(map, position, title) {
    try {
      if (!map || !position) {
        throw new Error('Map and position are required for marker creation');
      }

      const marker = new this.google.maps.Marker({
        position: position,
        map: map,
        title: title || 'Place Marker',
        animation: this.google.maps.Animation.DROP
      });

      console.log('📍 GoogleMapsService: Marker created successfully');
      return marker;
    } catch (error) {
      console.error('❌ GoogleMapsService: Marker creation error:', error);
      throw error;
    }
  }

  // Method to check if service is ready
  isReady() {
    return this.isInitialized && this.google && this.autocompleteService;
  }

  // Method to get current status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasGoogle: !!this.google,
      hasAutocompleteService: !!this.autocompleteService,
      hasPlacesService: !!this.placesService
    };
  }
}

// Create and export singleton instance
const googleMapsService = new GoogleMapsService();

// Debug helper - run this in browser console to check service status
if (typeof window !== 'undefined') {
  window.debugGoogleMapsService = () => {
    console.log('🔍 Google Maps Service Debug Info:');
    console.log('Status:', googleMapsService.getStatus());
    console.log('Is Ready:', googleMapsService.isReady());
    console.log('API Key exists:', !!process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
  };
}

export { googleMapsService };