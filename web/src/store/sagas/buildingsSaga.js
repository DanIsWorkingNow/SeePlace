// buildingsSaga — async orchestration for the building picker and the noise
// data panel. Mirrors placesSaga's structure (debounced search, fetch-on-select).
import { call, put, select, takeLatest, debounce, all } from 'redux-saga/effects';
import {
  loadRegionsRequest,
  loadRegionsSuccess,
  searchBuildingsRequest,
  searchBuildingsSuccess,
  selectBuildingRequest,
  selectBuildingSuccess,
  loadNoiseRequest,
  loadNoiseSuccess,
  buildingsFailure,
} from '../slices/buildingsSlice';
import { selectPlace } from '../slices/placesSlice';
import { setError } from '../slices/uiSlice';
import { noiseApi } from '../../services/noiseApi';

function* loadRegionsSaga() {
  try {
    const { regions } = yield call(noiseApi.regions);
    yield put(loadRegionsSuccess(regions));
  } catch (err) {
    yield put(buildingsFailure(err.message));
    yield put(setError('Could not load regions.'));
  }
}

function* searchBuildingsSaga() {
  try {
    const filter = yield select((s) => s.buildings.filter);
    const { buildings } = yield call(noiseApi.buildings, {
      state: filter.state,
      city: filter.city,
      q: filter.q,
      limit: 50,
    });
    yield put(searchBuildingsSuccess(buildings));
  } catch (err) {
    yield put(buildingsFailure(err.message));
    yield put(setError('Building search failed.'));
  }
}

// Turn a SeeNoise building into the place shape the existing map auto-pin
// (useGoogleMaps -> state.places.selectedPlace) already knows how to render.
function toPlace(b) {
  return {
    place_id: `osm_${b.osm_id}`,
    name: b.label || b.name || `Building #${b.osm_id}`,
    description: b.label || b.name || `Building #${b.osm_id}`,
    formatted_address: [b.city, b.state].filter(Boolean).join(', '),
    types: ['premise'],
    geometry: { location: { lat: b.lat, lng: b.lon } },
  };
}

function* selectBuildingSaga(action) {
  try {
    const summary = action.payload; // building row from the list
    // Pin on the map immediately using the coords we already have.
    yield put(selectPlace({ place: toPlace(summary), query: '' }));

    // Fetch the full record (adds `sources` + `monitoring`).
    const { building } = yield call(noiseApi.building, summary.osm_id);
    yield put(selectBuildingSuccess(building));

    // Kick off noise data load for the panel.
    yield put(loadNoiseRequest(summary.osm_id));
  } catch (err) {
    yield put(buildingsFailure(err.message));
    yield put(setError('Could not load that building.'));
  }
}

function* loadNoiseSaga(action) {
  try {
    const osmId = action.payload ?? (yield select((s) => s.buildings.selected?.osm_id));
    if (!osmId) return;
    const [risk, readingsResp] = yield all([
      call(noiseApi.risk, osmId),
      call(noiseApi.buildingReadings, osmId, { hours: 72 }),
    ]);
    yield put(loadNoiseSuccess({ risk, readings: readingsResp.readings }));
  } catch (err) {
    yield put(buildingsFailure(err.message));
    yield put(setError('Could not load noise data.'));
  }
}

export default function* buildingsSaga() {
  yield all([
    takeLatest(loadRegionsRequest.type, loadRegionsSaga),
    debounce(300, searchBuildingsRequest.type, searchBuildingsSaga),
    takeLatest(selectBuildingRequest.type, selectBuildingSaga),
    takeLatest(loadNoiseRequest.type, loadNoiseSaga),
  ]);
}
