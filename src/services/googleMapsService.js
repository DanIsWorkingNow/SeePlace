// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
// Enhanced googleMapsService.js - Fixed initialization issues
// Fixed GoogleMapsService.js - Specific fix for Places search functionality
// Basic GoogleMapsService.js - Removes all testing that causes issues
// Complete GoogleMapsService.js - Includes all methods expected by saga
import { Loader } from '@googlemaps/js-api-loader';

class GoogleMapsService {
  constructor() {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ API key not found');
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
    
    console.log('🚀 GoogleMapsService: Ready');
  }

  // Method expected by saga - returns service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasGoogle: !!this.google,
      hasAutocompleteService: !!this.autocompleteService,
      hasPlacesService: !!this.placesService
    };
  }

  // Method expected by saga - simple ready check
  isReady() {
    return this.isInitialized && this.google !== null;
  }

  // Reset method (might be used somewhere)
  reset() {
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('🔄 GoogleMapsService: Service reset');
  }

  async initialize() {
    if (this.isInitialized && this.google) {
      return this.google;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      console.log('🚀 Loading Google Maps API...');
      this.google = await this.loader.load();
      
      console.log('✅ Google Maps API loaded');
      
      // Create services
      this.autocompleteService = new this.google.maps.places.AutocompleteService();
      console.log('✅ AutocompleteService created');
      
      this.isInitialized = true;
      return this.google;
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  async searchPlaces(query) {
    try {
      console.log(`🔍 Searching for: "${query}"`);
      
      if (!query || query.trim().length < 2) {
        return [];
      }

      await this.initialize();
      
      if (!this.autocompleteService) {
        throw new Error('AutocompleteService not available');
      }

      return new Promise((resolve, reject) => {
        this.autocompleteService.getPlacePredictions(
          {
            input: query.trim(),
            types: ['establishment', 'geocode'],
            componentRestrictions: { country: 'my' }
          },
          (predictions, status) => {
            console.log(`📊 Search result: ${status} - ${predictions?.length || 0} places`);
            
            if (status === this.google.maps.places.PlacesServiceStatus.OK) {
              resolve(predictions || []);
            } else if (status === this.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              resolve([]);
            } else {
              console.error(`Search failed: ${status}`);
              reject(new Error(`Search failed: ${status}`));
            }
          }
        );
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
        const tempDiv = document.createElement('div');
        const service = new this.google.maps.places.PlacesService(tempDiv);
        
        service.getDetails({
          placeId: placeId,
          fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types']
        }, (place, status) => {
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

      const mapOptions = {
        center: { lat: 3.1390, lng: 101.6869 }, // Kuala Lumpur
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        scaleControl: true
      };

      const map = new this.google.maps.Map(element, mapOptions);
      
      if (!map) {
        throw new Error('Failed to create map instance');
      }

      console.log('✅ GoogleMapsService: Map created successfully');
      return map;
      
    } catch (error) {
      console.error('❌ Map creation error:', error);
      throw new Error(`Map creation failed: ${error.message}`);
    }
  }

  createMarker(map, position, title) {
    try {
      if (!this.google) {
        throw new Error('Google Maps API not initialized');
      }

      if (!map) {
        throw new Error('Map instance is required');
      }

      if (!position) {
        throw new Error('Position is required for marker');
      }

      const marker = new this.google.maps.Marker({
        position: position,
        map: map,
        title: title || 'Selected Place',
        animation: this.google.maps.Animation.DROP,
        optimized: false
      });

      console.log('📍 GoogleMapsService: Marker created at:', position);
      return marker;
      
    } catch (error) {
      console.error('❌ Marker creation error:', error);
      throw new Error(`Marker creation failed: ${error.message}`);
    }
  }
}

// Create and export singleton instance
const googleMapsService = new GoogleMapsService();
export { googleMapsService };