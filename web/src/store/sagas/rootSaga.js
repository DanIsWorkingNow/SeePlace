// Root saga — combines all feature sagas and runs them concurrently.
import { all, fork } from 'redux-saga/effects';
import placesSaga from './placesSaga';
import buildingsSaga from './buildingsSaga';

export default function* rootSaga() {
  yield all([
    fork(placesSaga),
    fork(buildingsSaga),
  ]);
}
