// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
// Enhanced googleMapsService.js - Fixed initialization issues
// Fixed GoogleMapsService.js - Specific fix for Places search functionality
// Basic GoogleMapsService.js - Removes all testing that causes issues
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
      
      // Simple service creation - no testing
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
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error(`Element '${containerId}' not found`);
      }

      const map = new this.google.maps.Map(element, {
        center: { lat: 3.1390, lng: 101.6869 }, // Kuala Lumpur
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