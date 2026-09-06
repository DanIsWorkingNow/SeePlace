// useBuildings — thin wrapper over the buildings slice, mirroring usePlaces.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadRegionsRequest,
  setFilter,
  searchBuildingsRequest,
  selectBuildingRequest,
  clearSelectedBuilding,
} from '../store/slices/buildingsSlice';

export const useBuildings = () => {
  const dispatch = useDispatch();
  const b = useSelector((s) => s.buildings);

  const loadRegions = useCallback(() => dispatch(loadRegionsRequest()), [dispatch]);

  const updateFilter = useCallback(
    (patch) => {
      dispatch(setFilter(patch));
      dispatch(searchBuildingsRequest());
    },
    [dispatch]
  );

  const selectBuilding = useCallback(
    (building) => dispatch(selectBuildingRequest(building)),
    [dispatch]
  );

  const clearSelected = useCallback(() => dispatch(clearSelectedBuilding()), [dispatch]);

  return {
    regions: b.regions,
    filter: b.filter,
    list: b.list,
    selected: b.selected,
    risk: b.risk,
    readings: b.readings,
    loading: b.loading,
    error: b.error,
    loadRegions,
    updateFilter,
    selectBuilding,
    clearSelected,
  };
};

export default useBuildings;
