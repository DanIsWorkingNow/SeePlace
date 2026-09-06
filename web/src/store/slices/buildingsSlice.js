// buildingsSlice — Klang Valley high-rise picker + noise data for the
// selected building. Mirrors placesSlice in shape and conventions.
//
// The saga (buildingsSaga.js) handles the *Request actions; the reducers here
// just store already-serialisable JSON coming back from the SeeNoise Worker.
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // region filter
  regions: [], // [{ state, city, count }]
  filter: { state: null, city: null, q: '' },

  // building list + selection
  list: [], // [{ osm_id, name, label, levels, lat, lon, state, city }]
  selected: null, // full building object incl. `monitoring`

  // noise data for the current view (pilot-wide for now)
  risk: null, // { building, calibrated, hours: [...] }
  readings: [], // [{ ts, segment, speed_ratio, train_passbys_this_hour, ... }]

  loading: { regions: false, list: false, building: false, noise: false },
  error: null,
};

const buildingsSlice = createSlice({
  name: 'buildings',
  initialState,
  reducers: {
    // --- regions ---------------------------------------------------------
    loadRegionsRequest: (state) => {
      state.loading.regions = true;
      state.error = null;
    },
    loadRegionsSuccess: (state, action) => {
      state.regions = action.payload;
      state.loading.regions = false;
    },

    // --- filter + list --------------------------------------------------
    setFilter: (state, action) => {
      state.filter = { ...state.filter, ...action.payload };
    },
    searchBuildingsRequest: (state) => {
      state.loading.list = true;
      state.error = null;
    },
    searchBuildingsSuccess: (state, action) => {
      state.list = action.payload;
      state.loading.list = false;
    },

    // --- selection ----------------------------------------------------
    selectBuildingRequest: (state) => {
      state.loading.building = true;
      state.error = null;
    },
    selectBuildingSuccess: (state, action) => {
      state.selected = action.payload;
      state.loading.building = false;
    },
    clearSelectedBuilding: (state) => {
      state.selected = null;
    },

    // --- noise data ---------------------------------------------------
    loadNoiseRequest: (state) => {
      state.loading.noise = true;
      state.error = null;
    },
    loadNoiseSuccess: (state, action) => {
      state.risk = action.payload.risk;
      state.readings = action.payload.readings;
      state.loading.noise = false;
    },

    // --- errors -----------------------------------------------------
    buildingsFailure: (state, action) => {
      state.error = action.payload;
      state.loading = { regions: false, list: false, building: false, noise: false };
    },
  },
});

export const {
  loadRegionsRequest,
  loadRegionsSuccess,
  setFilter,
  searchBuildingsRequest,
  searchBuildingsSuccess,
  selectBuildingRequest,
  selectBuildingSuccess,
  clearSelectedBuilding,
  loadNoiseRequest,
  loadNoiseSuccess,
  buildingsFailure,
} = buildingsSlice.actions;

export default buildingsSlice.reducer;
