// This file is part of the Google Places Redux Saga project.
// It defines the Google Maps service for interacting with the Google Maps API.
// It provides methods for searching places, getting place details, creating maps, and adding markers.
// The service uses the Google Maps JavaScript API and is initialized with an API key.  
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
  }

  async initialize() {
    if (!this.google) {
      this.google = await this.loader.load();
      this.autocompleteService = new this.google.maps.places.AutocompleteService();
    }
    return this.google;
  }

  async searchPlaces(query) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!query || query.length < 2) {
        resolve([]);
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
    return new this.google.maps.Map(document.getElementById(elementId), {
      zoom: 13,
      center: center,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
  }

  createMarker(map, position, title) {
    return new this.google.maps.Marker({
      position: position,
      map: map,
      title: title,
      animation: this.google.maps.Animation.DROP
    });
  }
}

export const googleMapsService = new GoogleMapsService();