// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
// Enhanced googleMapsService.js - Fixed initialization issues
// Fixed googleMapsService.js - Resolves all import and instance issues
import { Loader } from '@googlemaps/js-api-loader';

class GoogleMapsService {
  constructor() {
    // Get API key - use different methods for different environments
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      console.error('❌ GoogleMapsService: API key not found');
      throw new Error('Google Maps API key not found. Please check your .env file.');
    }

    console.log('🔑 GoogleMapsService: API key found and valid');

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
    
    console.log('🚀 GoogleMapsService: Constructor completed successfully');
    
    // Make service available globally for debugging
    if (typeof window !== 'undefined') {
      window.googleMapsService = this;
      console.log('🌐 GoogleMapsService: Made available globally for debugging');
    }
  }

  getApiKey() {
    // Try multiple ways to get the API key
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
      return process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    }
    
    // Fallback: check if it's been injected into window
    if (typeof window !== 'undefined' && window.REACT_APP_GOOGLE_MAPS_API_KEY) {
      return window.REACT_APP_GOOGLE_MAPS_API_KEY;
    }
    
    // Last resort: check for hardcoded key (only for debugging)
    console.warn('⚠️ Using fallback API key detection');
    return null;
  }

  async initialize() {
    console.log('🔄 GoogleMapsService: Initialize called');
    
    // If already initialized, return immediately
    if (this.isInitialized && this.google && this.autocompleteService) {
      console.log('✅ GoogleMapsService: Already initialized, returning existing instance');
      return this.google;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('⏳ GoogleMapsService: Initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Start new initialization
    console.log('🚀 GoogleMapsService: Starting new initialization');
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      console.log('📡 GoogleMapsService: Loading Google Maps API...');
      
      // Load Google Maps API
      this.google = await this.loader.load();
      console.log('✅ GoogleMapsService: Google Maps API loaded successfully');
      
      // Verify google.maps.places exists
      if (!this.google.maps.places) {
        throw new Error('Google Maps Places library not loaded');
      }
      
      // Initialize services
      this.autocompleteService = new this.google.maps.places.AutocompleteService();
      console.log('✅ GoogleMapsService: AutocompleteService created');
      
      // Verify service was created
      if (!this.autocompleteService) {
        throw new Error('Failed to create AutocompleteService');
      }
      
      this.isInitialized = true;
      console.log('🎉 GoogleMapsService: Initialization complete!');
      
      return this.google;
    } catch (error) {
      console.error('❌ GoogleMapsService: Initialization failed:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      
      // Reset services
      this.google = null;
      this.autocompleteService = null;
      
      throw error;
    }
  }

  async searchPlaces(query) {
    console.log(`🔍 GoogleMapsService: searchPlaces called with query: "${query}"`);
    
    try {
      // Validate input first
      if (!query || typeof query !== 'string') {
        console.log('⚠️ GoogleMapsService: Invalid query provided');
        return [];
      }
      
      if (query.length < 2) {
        console.log('📝 GoogleMapsService: Query too short, returning empty results');
        return [];
      }

      // Ensure service is initialized
      console.log('🔄 GoogleMapsService: Ensuring service is initialized...');
      await this.initialize();
      
      // Double-check that service is ready
      if (!this.autocompleteService) {
        console.error('❌ GoogleMapsService: AutocompleteService not available after initialization');
        throw new Error('AutocompleteService not available');
      }

      console.log('✅ GoogleMapsService: Service ready, making API request...');

      return new Promise((resolve, reject) => {
        const request = {
          input: query,
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'my' }
        };

        console.log('🌐 GoogleMapsService: Calling getPlacePredictions with:', request);
        
        this.autocompleteService.getPlacePredictions(
          request,
          (predictions, status) => {
            console.log(`📊 GoogleMapsService: API Response - Status: ${status}`);
            console.log('📊 GoogleMapsService: Predictions received:', predictions);
            
            const PlacesServiceStatus = this.google.maps.places.PlacesServiceStatus;
            
            if (status === PlacesServiceStatus.OK) {
              console.log(`✅ GoogleMapsService: Search successful! Found ${predictions?.length || 0} results`);
              resolve(predictions || []);
            } else if (status === PlacesServiceStatus.ZERO_RESULTS) {
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
    console.log(`🏢 GoogleMapsService: Getting details for place ID: ${placeId}`);
    
    try {
      if (!placeId) {
        throw new Error('Place ID is required');
      }

      await this.initialize();

      if (!this.google || !this.google.maps || !this.google.maps.places) {
        throw new Error('Google Maps Places API not available');
      }

      return new Promise((resolve, reject) => {
        // Create a temporary div for PlacesService
        const div = document.createElement('div');
        const placesService = new this.google.maps.places.PlacesService(div);
        
        placesService.getDetails(
          {
            placeId: placeId,
            fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types', 'photos', 'rating', 'user_ratings_total']
          },
          (place, status) => {
            console.log(`📊 GoogleMapsService: Place details status: ${status}`);
            
            const PlacesServiceStatus = this.google.maps.places.PlacesServiceStatus;
            
            if (status === PlacesServiceStatus.OK) {
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
    console.log(`🗺️ GoogleMapsService: Creating map for element: ${elementId}`);
    
    try {
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
        fullscreenControl: false
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

      if (!this.google || !this.google.maps) {
        throw new Error('Google Maps API not loaded');
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

  // Utility methods for debugging
  isReady() {
    const ready = this.isInitialized && this.google && this.autocompleteService;
    console.log(`🔍 GoogleMapsService: isReady() = ${ready}`);
    return ready;
  }

  getStatus() {
    const status = {
      isInitialized: this.isInitialized,
      hasGoogle: !!this.google,
      hasAutocompleteService: !!this.autocompleteService,
      hasPlacesService: !!this.placesService,
      initializationPromise: !!this.initializationPromise
    };
    console.log('📊 GoogleMapsService: Current status:', status);
    return status;
  }

  // Force re-initialization if needed
  async forceReinitialize() {
    console.log('🔄 GoogleMapsService: Forcing re-initialization...');
    this.isInitialized = false;
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.initializationPromise = null;
    
    return this.initialize();
  }
}

// Create singleton instance
console.log('🏭 Creating GoogleMapsService singleton...');
const googleMapsService = new GoogleMapsService();

// Verify instance was created
if (!googleMapsService) {
  console.error('❌ Failed to create GoogleMapsService instance!');
  throw new Error('Failed to create GoogleMapsService instance');
}

console.log('✅ GoogleMapsService singleton created successfully');

// Export the instance
export { googleMapsService };

// Also make it available as default export
export default googleMapsService;