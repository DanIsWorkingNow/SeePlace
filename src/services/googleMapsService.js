// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
// Enhanced googleMapsService.js - Better error handling and validation
import { Loader } from '@googlemaps/js-api-loader';

class GoogleMapsService {
  constructor() {
    this.loader = new Loader({
      apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized && this.google) {
      console.log('✅ GoogleMapsService: Already initialized');
      return this.google;
    }

    try {
      // Validate API key
      if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key not found. Please check your .env file.');
      }

      console.log('🚀 GoogleMapsService: Loading Google Maps API...');
      this.google = await this.loader.load();
      
      console.log('✅ GoogleMapsService: Google Maps API loaded successfully');
      this.autocompleteService = new this.google.maps.places.AutocompleteService();
      this.isInitialized = true;
      
      return this.google;
    } catch (error) {
      console.error('❌ GoogleMapsService: Failed to initialize:', error);
      this.isInitialized = false;
      throw new Error(`Failed to load Google Maps: ${error.message}`);
    }
  }

  async searchPlaces(query) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!query || query.length < 2) {
        resolve([]);
        return;
      }

      if (!this.autocompleteService) {
        reject(new Error('Autocomplete service not initialized'));
        return;
      }

      this.autocompleteService.getPlacePredictions(
        {
          input: query,
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'my' }
        },
        (predictions, status) => {
          if (status === this.google.maps.places.PlacesServiceStatus.OK) {
            resolve(predictions || []);
          } else if (status === this.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Places API error: ${status}`));
          }
        }
      );
    });
  }

  async getPlaceDetails(placeId) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!placeId) {
        reject(new Error('Place ID is required'));
        return;
      }

      const div = document.createElement('div');
      this.placesService = new this.google.maps.places.PlacesService(div);
      
      this.placesService.getDetails(
        {
          placeId: placeId,
          fields: ['name', 'geometry', 'formatted_address', 'place_id', 'types', 'photos']
        },
        (place, status) => {
          if (status === this.google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            reject(new Error(`Place details error: ${status}`));
          }
        }
      );
    });
  }

  createMap(elementId, center = { lat: 3.1390, lng: 101.6869 }) {
    if (!this.google) {
      throw new Error('Google Maps API not initialized');
    }

    // Validate element exists
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found`);
    }

    // Check if element is in the DOM and visible
    if (!element.offsetParent && element.style.display !== 'none') {
      console.warn('⚠️ GoogleMapsService: Element may not be visible');
    }

    try {
      console.log('🗺️ GoogleMapsService: Creating map on element:', element);
      
      const mapOptions = {
        zoom: 13,
        center: center,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        // Additional options for better performance
        gestureHandling: 'cooperative',
        backgroundColor: '#f0f0f0',
        clickableIcons: true,
        disableDoubleClickZoom: false,
        draggable: true,
        keyboardShortcuts: true,
        scrollwheel: true
      };

      const map = new this.google.maps.Map(element, mapOptions);
      
      // Verify map was created successfully
      if (!map) {
        throw new Error('Failed to create map instance');
      }

      console.log('✅ GoogleMapsService: Map created successfully');
      return map;
      
    } catch (error) {
      console.error('❌ GoogleMapsService: Failed to create map:', error);
      throw new Error(`Map creation failed: ${error.message}`);
    }
  }

  createMarker(map, position, title) {
    if (!this.google) {
      throw new Error('Google Maps API not initialized');
    }

    if (!map) {
      throw new Error('Map instance is required');
    }

    if (!position) {
      throw new Error('Position is required for marker');
    }

    try {
      const marker = new this.google.maps.Marker({
        position: position,
        map: map,
        title: title || 'Selected Place',
        animation: this.google.maps.Animation.DROP,
        optimized: false // Better for custom markers
      });

      console.log('📍 GoogleMapsService: Marker created at:', position);
      return marker;
      
    } catch (error) {
      console.error('❌ GoogleMapsService: Failed to create marker:', error);
      throw new Error(`Marker creation failed: ${error.message}`);
    }
  }

  // Utility method to check if Google Maps is ready
  isReady() {
    return this.isInitialized && this.google !== null;
  }

  // Reset the service (useful for testing or error recovery)
  reset() {
    this.google = null;
    this.autocompleteService = null;
    this.placesService = null;
    this.isInitialized = false;
    console.log('🔄 GoogleMapsService: Service reset');
  }
}

export const googleMapsService = new GoogleMapsService();