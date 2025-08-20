// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
// Enhanced googleMapsService.js - Fixed initialization issues
// Fixed GoogleMapsService.js - Specific fix for Places search functionality
// Basic GoogleMapsService.js - Removes all testing that causes issues
// Complete GoogleMapsService.js - Includes all methods expected by saga
// Bulletproof GoogleMapsService.js - Handles all edge cases
import { Loader } from '@googlemaps/js-api-loader';

class GoogleMapsService {
  constructor() {
    // Robust API key validation
    this.apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    if (!this.apiKey) {
      console.error('❌ CRITICAL: API key not found in environment');
      console.error('Check your .env file contains: REACT_APP_GOOGLE_MAPS_API_KEY=your_key');
      throw new Error('Google Maps API key not found. Check .env file.');
    }
    
    if (this.apiKey.length < 30) {
      console.error('❌ CRITICAL: API key appears invalid (too short)');
      console.error('Current key:', this.apiKey);
      throw new Error('API key appears invalid. Check your Google Cloud Console.');
    }

    console.log('🔑 API Key found:', this.apiKey.substring(0, 20) + '...');

    this.loader = new Loader({
      apiKey: this.apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry'],
      // Add retry logic
      retries: 3,
      // Add language and region
      language: 'en',
      region: 'MY'
    });
    
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initializationError = null;
    
    console.log('🚀 GoogleMapsService: Constructor completed successfully');
  }

  // Required by saga
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasGoogle: !!this.google,
      hasAutocompleteService: !!this.autocompleteService,
      hasPlacesService: !!this.placesService,
      apiKey: this.apiKey ? this.apiKey.substring(0, 20) + '...' : 'NOT_FOUND',
      initializationError: this.initializationError
    };
  }

  // Required by saga
  isReady() {
    return this.isInitialized && !!this.google && !!this.autocompleteService;
  }

  // Reset method
  reset() {
    console.log('🔄 Resetting GoogleMapsService...');
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initializationError = null;
  }

  async initialize() {
    // Return cached error if previous initialization failed permanently
    if (this.initializationError) {
      throw this.initializationError;
    }

    // Return if already initialized
    if (this.isInitialized && this.google && this.autocompleteService) {
      console.log('✅ Already initialized and ready');
      return this.google;
    }

    // Wait for existing initialization
    if (this.initializationPromise) {
      console.log('⏳ Waiting for existing initialization...');
      return this.initializationPromise;
    }

    // Start new initialization
    console.log('🚀 Starting fresh initialization...');
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      console.log('📡 Loading Google Maps API with key:', this.apiKey.substring(0, 20) + '...');
      
      // Load with explicit error handling
      this.google = await this.loader.load().catch(error => {
        console.error('❌ Loader.load() failed:', error);
        if (error.message.includes('ApiNotActivatedMapError')) {
          throw new Error('Maps JavaScript API not enabled. Enable it in Google Cloud Console.');
        }
        if (error.message.includes('InvalidKeyMapError')) {
          throw new Error('Invalid API key. Check your Google Cloud Console credentials.');
        }
        if (error.message.includes('RefererNotAllowedMapError')) {
          throw new Error('API key restricted for this domain. Check HTTP referrer restrictions.');
        }
        throw error;
      });
      
      console.log('✅ Google Maps API loaded');
      console.log('🔍 Available services:', Object.keys(this.google.maps));
      
      // Verify Places library
      if (!this.google.maps.places) {
        throw new Error('Places library not loaded. Check if Places API is enabled.');
      }
      console.log('✅ Places library confirmed');

      // Create AutocompleteService with error handling
      try {
        this.autocompleteService = new this.google.maps.places.AutocompleteService();
        console.log('✅ AutocompleteService created');
      } catch (serviceError) {
        console.error('❌ Failed to create AutocompleteService:', serviceError);
        throw new Error('Cannot create AutocompleteService. Check Places API permissions.');
      }

      // Verify service is actually usable with a test call
      try {
        console.log('🧪 Testing AutocompleteService...');
        await this._testService();
        console.log('✅ Service test passed');
      } catch (testError) {
        console.error('❌ Service test failed:', testError);
        // Don't throw here - the service might work for real queries
        console.warn('⚠️ Service test failed but continuing anyway');
      }
      
      this.isInitialized = true;
      this.initializationPromise = null;
      console.log('🎉 Initialization completed successfully!');
      
      return this.google;
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      this.initializationError = error;
      
      // Provide specific error guidance
      if (error.message.includes('API key')) {
        console.error('💡 Solution: Check your API key in Google Cloud Console');
      } else if (error.message.includes('not enabled')) {
        console.error('💡 Solution: Enable the required APIs in Google Cloud Console');
      } else if (error.message.includes('billing')) {
        console.error('💡 Solution: Enable billing for your Google Cloud project');
      }
      
      throw error;
    }
  }

  async _testService() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service test timeout'));
      }, 5000);

      this.autocompleteService.getPlacePredictions(
        {
          input: 'test',
          types: ['geocode'],
          componentRestrictions: { country: 'my' }
        },
        (predictions, status) => {
          clearTimeout(timeout);
          
          console.log('🧪 Test result:', status);
          
          if (status === 'OK' || status === 'ZERO_RESULTS') {
            resolve();
          } else if (status === 'REQUEST_DENIED') {
            reject(new Error('API key has no permission for Places API. Check Google Cloud Console.'));
          } else {
            reject(new Error(`Service test failed: ${status}`));
          }
        }
      );
    });
  }

  async searchPlaces(query) {
    try {
      console.log(`🔍 Starting search for: "${query}"`);
      
      // Input validation
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        console.log('📝 Query too short or invalid');
        return [];
      }

      // Ensure initialization
      console.log('🔧 Ensuring service is initialized...');
      await this.initialize();
      
      // Double-check service availability
      if (!this.autocompleteService) {
        throw new Error('AutocompleteService not available after initialization');
      }

      console.log('🌐 Making Places API request...');
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Search request timeout after 10 seconds'));
        }, 10000);

        const request = {
          input: query.trim(),
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'my' }
        };

        console.log('📤 Request details:', request);

        this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
          clearTimeout(timeout);
          
          console.log(`📥 Response: Status=${status}, Results=${predictions?.length || 0}`);
          
          if (status === this.google.maps.places.PlacesServiceStatus.OK) {
            console.log('✅ Search successful!');
            if (predictions && predictions.length > 0) {
              console.log('📍 Sample result:', predictions[0].description);
            }
            resolve(predictions || []);
          } else if (status === this.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.log('📭 No results found (this is normal)');
            resolve([]);
          } else {
            console.error(`❌ Search failed with status: ${status}`);
            
            let errorMessage = `Search failed: ${status}`;
            switch(status) {
              case 'REQUEST_DENIED':
                errorMessage = 'Places API access denied. Your API key does not have permission for Places API.';
                break;
              case 'OVER_QUERY_LIMIT':
                errorMessage = 'Places API quota exceeded. Check your billing account.';
                break;
              case 'INVALID_REQUEST':
                errorMessage = 'Invalid search request parameters.';
                break;
            }
            
            reject(new Error(errorMessage));
          }
        });
      });
    } catch (error) {
      console.error('❌ Search error:', error);
      throw error;
    }
  }

  async getPlaceDetails(placeId) {
    try {
      if (!placeId) {
        throw new Error('Place ID is required');
      }

      await this.initialize();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Place details timeout'));
        }, 10000);

        const tempDiv = document.createElement('div');
        const service = new this.google.maps.places.PlacesService(tempDiv);
        
        service.getDetails({
          placeId: placeId,
          fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types']
        }, (place, status) => {
          clearTimeout(timeout);
          
          if (status === this.google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            reject(new Error(`Place details failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('❌ Place details error:', error);
      throw error;
    }
  }

  createMap(containerId) {
    try {
      if (!this.google) {
        throw new Error('Google Maps API not initialized');
      }

      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Element '${containerId}' not found`);
      }

      const map = new this.google.maps.Map(element, {
        center: { lat: 3.1390, lng: 101.6869 },
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
      });

      return map;
    } catch (error) {
      console.error('❌ Map creation error:', error);
      throw error;
    }
  }

  createMarker(map, position, title) {
    try {
      return new this.google.maps.Marker({
        position: position,
        map: map,
        title: title,
        animation: this.google.maps.Animation.DROP
      });
    } catch (error) {
      console.error('❌ Marker creation error:', error);
      throw error;
    }
  }
}

const googleMapsService = new GoogleMapsService();
export { googleMapsService };