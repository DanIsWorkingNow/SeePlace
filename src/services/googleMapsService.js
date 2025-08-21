// REPLACE: src/services/googleMapsService.js
// CORRUPTION-PROOF googleMapsService.js - WITH getPlaceDetails for auto-pinning
import { Loader } from '@googlemaps/js-api-loader';

// Service state holder to prevent corruption
const ServiceState = {
  google: null,
  autocompleteService: null,
  placesService: null,
  isInitialized: false,
  initializationPromise: null,
  lastError: null,
  isCorrupted: false
};

class GoogleMapsService {
  constructor() {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ GoogleMapsService: API key not found');
      throw new Error('Google Maps API key not found. Please check your .env file.');
    }

    console.log('🔑 API Key found:', apiKey.substring(0, 20) + '...');

    this.loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });
    
    console.log('🚀 GoogleMapsService: Constructor completed successfully');
  }

  // Corruption-safe getter
  getState() {
    try {
      return ServiceState;
    } catch (error) {
      console.error('❌ ServiceState corrupted:', error);
      return {
        google: null,
        autocompleteService: null,
        placesService: null,
        isInitialized: false,
        initializationPromise: null,
        lastError: error,
        isCorrupted: true
      };
    }
  }

  async initialize() {
    const state = this.getState();
    
    if (state.isCorrupted) {
      console.log('🔄 State corrupted, resetting...');
      this.reset();
    }

    if (state.isInitialized && state.google && state.autocompleteService && state.placesService) {
      console.log('✅ GoogleMapsService: Already initialized and ready');
      return state.google;
    }

    if (state.initializationPromise) {
      console.log('⏳ GoogleMapsService: Waiting for existing initialization...');
      try {
        return await state.initializationPromise;
      } catch (error) {
        console.log('⚠️ Previous initialization failed, starting fresh...');
        ServiceState.initializationPromise = null;
      }
    }

    console.log('🚀 Starting fresh initialization...');
    ServiceState.initializationPromise = this._performInitialization();
    return ServiceState.initializationPromise;
  }

  async _performInitialization() {
    try {
      console.log('📡 Loading Google Maps API...');
      
      // Reset state before initialization
      ServiceState.isCorrupted = false;
      ServiceState.lastError = null;
      
      // Load the Google Maps API with comprehensive error handling
      const loadPromise = this.loader.load();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API load timeout after 20 seconds')), 20000)
      );
      
      ServiceState.google = await Promise.race([loadPromise, timeoutPromise]);
      
      if (!ServiceState.google || !ServiceState.google.maps) {
        throw new Error('Google Maps API failed to load properly');
      }
      
      console.log('✅ Google Maps API loaded successfully');
      console.log('📍 Maps Version:', ServiceState.google.maps.version || 'Unknown');
      console.log('🔍 Available services:', Object.keys(ServiceState.google.maps));
      
      // Verify Places library is available
      if (!ServiceState.google.maps.places) {
        throw new Error('Places library not available. Please ensure Places API is enabled in Google Cloud Console.');
      }
      console.log('✅ Places library confirmed');

      // Create AutocompleteService with protection against corruption
      await this._createAutocompleteService();
      
      // 🆕 Create PlacesService for getPlaceDetails functionality
      await this._createPlacesService();
      
      ServiceState.isInitialized = true;
      ServiceState.initializationPromise = null;
      ServiceState.lastError = null;
      console.log('🎉 Initialization completed successfully with Places support!');
      return ServiceState.google;
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      
      // Safe state update
      try {
        ServiceState.isInitialized = false;
        ServiceState.initializationPromise = null;
        ServiceState.autocompleteService = null;
        ServiceState.placesService = null;
        ServiceState.lastError = error;
      } catch (stateError) {
        console.error('❌ Failed to update state after error:', stateError);
        ServiceState.isCorrupted = true;
      }
      
      // Provide specific error guidance
      if (error.message.includes('timeout')) {
        throw new Error('Google Maps API loading timed out. Check your internet connection and try again.');
      } else if (error.message.includes('ApiNotActivatedMapError')) {
        throw new Error('Maps JavaScript API not enabled. Please enable it in Google Cloud Console.');
      } else if (error.message.includes('ApiTargetBlockedMapError')) {
        throw new Error('API key blocked. This should not happen with unrestricted keys. Try creating a new API key.');
      } else if (error.message.includes('RequestDeniedMapError')) {
        throw new Error('API request denied. Check if billing is enabled in Google Cloud Console.');
      }
      
      throw error;
    }
  }

  async _createAutocompleteService() {
    try {
      console.log('🔧 Creating AutocompleteService...');
      
      if (!ServiceState.google || !ServiceState.google.maps || !ServiceState.google.maps.places) {
        throw new Error('Google Maps Places not available for service creation');
      }
      
      // Create the service with error protection
      ServiceState.autocompleteService = new ServiceState.google.maps.places.AutocompleteService();
      
      if (!ServiceState.autocompleteService) {
        throw new Error('AutocompleteService creation returned null/undefined');
      }
      
      console.log('✅ AutocompleteService created successfully');
      
      // Quick validation test
      try {
        await this._validateService();
        console.log('✅ AutocompleteService validation passed');
      } catch (validationError) {
        console.warn('⚠️ AutocompleteService validation failed:', validationError.message);
        
        // If validation fails due to API issues, don't fail initialization
        if (validationError.message.includes('REQUEST_DENIED')) {
          console.log('📋 This might be due to missing API enablement. Service may still work for real queries.');
        }
      }
      
    } catch (error) {
      console.error('❌ AutocompleteService creation failed:', error);
      throw new Error('Failed to create AutocompleteService: ' + error.message);
    }
  }

  // 🆕 NEW METHOD: Create PlacesService for place details
  async _createPlacesService() {
    try {
      console.log('🔧 Creating PlacesService for place details...');
      
      if (!ServiceState.google || !ServiceState.google.maps || !ServiceState.google.maps.places) {
        throw new Error('Google Maps Places not available for PlacesService creation');
      }
      
      // Create a temporary div for PlacesService (required by Google API)
      const tempDiv = document.createElement('div');
      ServiceState.placesService = new ServiceState.google.maps.places.PlacesService(tempDiv);
      
      if (!ServiceState.placesService) {
        throw new Error('PlacesService creation returned null/undefined');
      }
      
      console.log('✅ PlacesService created successfully');
      
    } catch (error) {
      console.error('❌ PlacesService creation failed:', error);
      throw new Error('Failed to create PlacesService: ' + error.message);
    }
  }

  async _validateService() {
    return new Promise((resolve, reject) => {
      if (!ServiceState.autocompleteService) {
        reject(new Error('AutocompleteService is null'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Validation timeout'));
      }, 8000);

      try {
        ServiceState.autocompleteService.getPlacePredictions(
          {
            input: 'malaysia',
            types: ['country'],
          },
          (predictions, status) => {
            clearTimeout(timeout);
            console.log('🧪 Validation result - Status:', status);
            
            const PlacesServiceStatus = ServiceState.google.maps.places.PlacesServiceStatus;
            
            if (status === PlacesServiceStatus.OK || 
                status === PlacesServiceStatus.ZERO_RESULTS) {
              resolve();
            } else if (status === PlacesServiceStatus.REQUEST_DENIED) {
              reject(new Error('REQUEST_DENIED - Check if original Places API is enabled'));
            } else {
              resolve(); // Don't fail for other statuses
            }
          }
        );
      } catch (callError) {
        clearTimeout(timeout);
        reject(callError);
      }
    });
  }

  // 🔥 ENHANCED: Replace the searchPlaces method around line 300-400
  async searchPlaces(query) {
    try {
      console.log(`🔍 Searching for: "${query}" (targeting up to 10 results)`);
      
      // Input validation
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        console.log('📝 Query too short, returning empty results');
        return [];
      }

      const state = this.getState();
      
      if (state.isCorrupted) {
        console.log('🔄 State corrupted during search, attempting reset...');
        this.reset();
        return [];
      }

      // Ensure service is initialized
      if (!state.isInitialized || !state.autocompleteService) {
        console.log('🔄 Service not ready, initializing...');
        try {
          await this.initialize();
        } catch (initError) {
          console.error('❌ Initialization failed during search:', initError);
          return [];
        }
      }

      // Final safety check
      const currentState = this.getState();
      if (!currentState.autocompleteService) {
        console.warn('⚠️ AutocompleteService still not available after initialization');
        return [];
      }

      console.log('🌐 Making Enhanced Places API request...');
      
      // 🔥 NEW: Enhanced search to get up to 10 results
      const results = await this._getEnhancedSearchResults(query.trim());
      console.log(`✅ Enhanced search found ${results.length} total results`);
      return results;

    } catch (error) {
      console.error('❌ Search error:', error);
      return [];
    }
  }

  //Very Crucial Method
   async getPlaceDetails(placeId) {
    try {
      console.log(`🏢 Getting place details for: ${placeId}`);
      
      if (!placeId) {
        throw new Error('Place ID is required for getPlaceDetails');
      }

      const state = this.getState();
      
      if (state.isCorrupted) {
        console.log('🔄 State corrupted during place details, attempting reset...');
        this.reset();
        throw new Error('Service state corrupted');
      }

      // Ensure service is initialized
      if (!state.isInitialized || !state.placesService) {
        console.log('🔄 PlacesService not ready, initializing...');
        try {
          await this.initialize();
        } catch (initError) {
          console.error('❌ Initialization failed during place details:', initError);
          throw new Error('Failed to initialize PlacesService');
        }
      }

      // Final safety check
      const currentState = this.getState();
      if (!currentState.placesService) {
        throw new Error('PlacesService not available after initialization');
      }

      console.log('📋 Making Place Details API request...');
      
      return new Promise((resolve, reject) => {
        try {
          currentState.placesService.getDetails(
            {
              placeId: placeId,
              fields: [
                'name', 
                'geometry', 
                'formatted_address', 
                'place_id', 
                'types', 
                'photos', 
                'rating', 
                'user_ratings_total',
                'vicinity'
              ]
            },
            (place, status) => {
              console.log(`📋 Place Details API Response - Status: ${status}`);
              
              const state = this.getState();
              if (!state.google || !state.google.maps || !state.google.maps.places) {
                console.error('❌ Google Maps objects corrupted during place details callback');
                reject(new Error('Google Maps service corrupted'));
                return;
              }

              const PlacesServiceStatus = state.google.maps.places.PlacesServiceStatus;
              
              switch (status) {
                case PlacesServiceStatus.OK:
                  if (place && place.geometry && place.geometry.location) {
                    console.log('✅ Place details retrieved successfully');
                    resolve(place);
                  } else {
                    console.warn('⚠️ Place details missing geometry data');
                    reject(new Error('Place details missing geometry data'));
                  }
                  break;
                  
                case PlacesServiceStatus.NOT_FOUND:
                  console.warn('⚠️ Place not found');
                  reject(new Error('Place not found'));
                  break;
                  
                case PlacesServiceStatus.REQUEST_DENIED:
                  console.warn('⚠️ Place Details REQUEST_DENIED - Check if Places API (New) is enabled');
                  reject(new Error('Place Details API request denied'));
                  break;
                  
                default:
                  console.warn(`⚠️ Unexpected place details status: ${status}`);
                  reject(new Error(`Place details API error: ${status}`));
              }
            }
          );
        } catch (callError) {
          console.error('❌ Error making place details API call:', callError);
          reject(new Error('Place details API call failed'));
        }
      });

    } catch (error) {
      console.error('❌ Place details error:', error);
      throw error;
    }
  }

 // 🔥 NEW METHODS: Add these after your getPlaceDetails method

  // Enhanced search method to get up to 10 results
  async _getEnhancedSearchResults(query) {
    const currentState = this.getState();
    
    return new Promise((resolve) => {
      try {
        // Create session token for better performance
        const sessionToken = new currentState.google.maps.places.AutocompleteSessionToken();
        
        // Primary search request
        const primaryRequest = {
          input: query,
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'my' }, // Malaysia
          sessionToken: sessionToken
        };

        currentState.autocompleteService.getPlacePredictions(
          primaryRequest,
          async (predictions, status) => {
            console.log(`📊 Primary API Response - Status: ${status}, Results: ${predictions?.length || 0}`);
            
            const state = this.getState();
            if (!state.google || !state.google.maps || !state.google.maps.places) {
              console.error('❌ Google Maps objects corrupted during callback');
              resolve([]);
              return;
            }

            const PlacesServiceStatus = state.google.maps.places.PlacesServiceStatus;
            
            if (status === PlacesServiceStatus.OK && predictions) {
              // 🔥 ENHANCEMENT: If we got less than 8 results, try to get more
              if (predictions.length < 8) {
                console.log(`🔍 Got ${predictions.length} results, attempting to find more...`);
                try {
                  const supplementaryResults = await this._getSupplementaryResults(query, predictions);
                  const combinedResults = this._mergeAndDeduplicateResults(predictions, supplementaryResults);
                  const finalResults = combinedResults.slice(0, 10); // Limit to 10
                  
                  console.log(`🎯 Enhanced: ${predictions.length} primary + ${supplementaryResults.length} supplementary = ${finalResults.length} total`);
                  resolve(finalResults);
                } catch (enhanceError) {
                  console.warn('⚠️ Supplementary search failed, using primary results only:', enhanceError);
                  resolve(predictions || []);
                }
              } else {
                // Already got good results
                const limitedResults = predictions.slice(0, 10);
                console.log(`✅ Primary search sufficient: ${limitedResults.length} results`);
                resolve(limitedResults);
              }
              
            } else if (status === PlacesServiceStatus.ZERO_RESULTS) {
              console.log('📭 No results found');
              resolve([]);
            } else {
              console.warn(`⚠️ API returned status: ${status}`);
              resolve([]);
            }
          }
        );
      } catch (callError) {
        console.error('❌ Enhanced search API call failed:', callError);
        resolve([]);
      }
    });
  }

  // Get supplementary results using different search parameters
  async _getSupplementaryResults(query, existingPredictions) {
    const currentState = this.getState();
    
    return new Promise((resolve) => {
      try {
        // Use broader search types to find more results
        const supplementaryRequest = {
          input: query,
          types: ['locality', 'sublocality', 'neighborhood'], // Different types
          componentRestrictions: { country: 'my' },
          sessionToken: new currentState.google.maps.places.AutocompleteSessionToken()
        };

        currentState.autocompleteService.getPlacePredictions(
          supplementaryRequest,
          (predictions, status) => {
            if (status === currentState.google.maps.places.PlacesServiceStatus.OK && predictions) {
              console.log(`📋 Supplementary search found ${predictions.length} additional results`);
              resolve(predictions);
            } else {
              console.log('📭 No supplementary results found');
              resolve([]);
            }
          }
        );
      } catch (error) {
        console.warn('⚠️ Supplementary search error:', error);
        resolve([]);
      }
    });
  }

  // Merge and deduplicate results
  _mergeAndDeduplicateResults(primary, supplementary) {
    const seen = new Set();
    const merged = [];
    
    // Add primary results first (higher priority)
    primary.forEach(prediction => {
      if (!seen.has(prediction.place_id)) {
        seen.add(prediction.place_id);
        merged.push(prediction);
      }
    });
    
    // Add supplementary results that aren't duplicates
    supplementary.forEach(prediction => {
      if (!seen.has(prediction.place_id) && merged.length < 10) {
        seen.add(prediction.place_id);
        merged.push(prediction);
      }
    });
    
    return merged;
  }

  async createMap(elementId, center = { lat: 3.1390, lng: 101.6869 }) {
    try {
      console.log(`🗺️ Creating map for element: ${elementId}`);
      
      await this.initialize();
      
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with id '${elementId}' not found`);
      }

      const state = this.getState();
      if (!state.google || !state.google.maps) {
        throw new Error('Google Maps not available for map creation');
      }

      const map = new state.google.maps.Map(element, {
        zoom: 13,
        center: center,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true
      });

      console.log('✅ Map created successfully');
      return map;
    } catch (error) {
      console.error('❌ Map creation error:', error);
      throw error;
    }
  }

  createMarker(map, position, title) {
    try {
      if (!map || !position) {
        throw new Error('Map and position are required');
      }

      const state = this.getState();
      if (!state.google || !state.google.maps) {
        throw new Error('Google Maps not available for marker creation');
      }

      const marker = new state.google.maps.Marker({
        position: position,
        map: map,
        title: title || 'Location',
        animation: state.google.maps.Animation.DROP
      });

      console.log('📍 Marker created successfully');
      return marker;
    } catch (error) {
      console.error('❌ Marker creation error:', error);
      throw error;
    }
  }

  // Utility methods
  isReady() {
    const state = this.getState();
    return !state.isCorrupted &&
           state.isInitialized && 
           state.google && 
           state.google.maps && 
           state.google.maps.places && 
           state.autocompleteService &&
           state.placesService;  // 🆕 Added placesService check
  }

  getStatus() {
    const state = this.getState();
    return {
      isInitialized: state.isInitialized,
      hasGoogle: !!state.google,
      hasPlaces: !!(state.google && state.google.maps && state.google.maps.places),
      hasAutocompleteService: !!state.autocompleteService,
      hasPlacesService: !!state.placesService,  // 🆕 Added placesService status
      isReady: this.isReady(),
      isCorrupted: state.isCorrupted,
      lastError: state.lastError?.message || null
    };
  }

  // Safe reset method
  reset() {
    console.log('🔄 Resetting GoogleMapsService...');
    try {
      ServiceState.isInitialized = false;
      ServiceState.autocompleteService = null;
      ServiceState.placesService = null;
      ServiceState.initializationPromise = null;
      ServiceState.lastError = null;
      ServiceState.isCorrupted = false;
      // Keep ServiceState.google for faster re-initialization
    } catch (error) {
      console.error('❌ Reset failed:', error);
      // Force complete reset
      Object.assign(ServiceState, {
        google: null,
        autocompleteService: null,
        placesService: null,
        isInitialized: false,
        initializationPromise: null,
        lastError: null,
        isCorrupted: false
      });
    }
  }
}

// Create singleton with maximum error protection
let googleMapsService;
try {
  googleMapsService = new GoogleMapsService();
} catch (error) {
  console.error('❌ Failed to create GoogleMapsService:', error);
  // Create a safe fallback service
  googleMapsService = {
    searchPlaces: () => Promise.resolve([]),
    getPlaceDetails: () => Promise.reject(new Error('Service unavailable')),  // 🆕 Added fallback
    initialize: () => Promise.resolve(null),
    createMap: () => Promise.reject(new Error('Service unavailable')),
    createMarker: () => null,
    isReady: () => false,
    getStatus: () => ({ error: 'Service creation failed' }),
    reset: () => {}
  };
}

// Enhanced debug helpers for your specific situation
if (typeof window !== 'undefined') {
  window.debugGoogleMapsService = () => {
    console.log('🔍 Google Maps Service Debug:');
    try {
      const status = googleMapsService.getStatus();
      console.log('Status:', status);
      console.log('Is Ready:', googleMapsService.isReady());
      
      // Additional diagnostics
      if (status.lastError) {
        console.log('❌ Last Error:', status.lastError);
      }
      if (status.isCorrupted) {
        console.log('⚠️ Service state is corrupted');
      }
    } catch (error) {
      console.error('Debug failed:', error);
    }
  };
  
  window.testGoogleMapsSearch = async (query = 'KLCC Malaysia') => {
    console.log(`🧪 Testing search for: "${query}"`);
    try {
      const results = await googleMapsService.searchPlaces(query);
      console.log('✅ Test results:', results);
      if (results.length === 0) {
        console.log('💡 If no results, check Google Cloud Console for API enablement');
      }
      return results;
    } catch (error) {
      console.error('❌ Test failed:', error);
      return [];
    }
  };

  // 🆕 NEW: Test place details functionality
  window.testPlaceDetails = async (placeId = 'ChIJRzxL8BC4zDERdU3yFGBfMLs') => {
    console.log(`🧪 Testing place details for: ${placeId}`);
    try {
      const details = await googleMapsService.getPlaceDetails(placeId);
      console.log('✅ Place details:', details);
      console.log('📍 Geometry:', details.geometry?.location?.toString());
      return details;
    } catch (error) {
      console.error('❌ Place details test failed:', error);
      return null;
    }
  };

  window.fixGoogleMapsService = () => {
    console.log('🔧 Attempting to fix service...');
    try {
      googleMapsService.reset();
      console.log('✅ Service reset completed');
      console.log('🧪 Testing after reset...');
      return window.testGoogleMapsSearch('Test');
    } catch (error) {
      console.error('❌ Fix failed:', error);
    }
  };
}

export { googleMapsService };