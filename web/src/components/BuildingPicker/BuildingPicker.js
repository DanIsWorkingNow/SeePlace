// BuildingPicker — state -> city -> name search over the SeeNoise `buildings`
// table (1,118 Klang Valley high-rises). Selecting one pins it on the map
// (reusing the Places auto-pin path) and loads the noise panel.
import React, { useEffect, useMemo } from 'react';
import { useBuildings } from '../../hooks/useBuildings';
import LoadingSpinner from '../common/LoadingSpinner';

const BuildingPicker = () => {
  const {
    regions,
    filter,
    list,
    selected,
    loading,
    loadRegions,
    updateFilter,
    selectBuilding,
  } = useBuildings();

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const states = useMemo(
    () => [...new Set(regions.map((r) => r.state))].sort(),
    [regions]
  );

  const cities = useMemo(
    () =>
      regions
        .filter((r) => !filter.state || r.state === filter.state)
        .map((r) => r.city)
        .sort(),
    [regions, filter.state]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={filter.state || ''}
          onChange={(e) => updateFilter({ state: e.target.value || null, city: null })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filter.city || ''}
          onChange={(e) => updateFilter({ city: e.target.value || null })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={filter.q}
        onChange={(e) => updateFilter({ q: e.target.value })}
        placeholder="Filter by name (named buildings only)…"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />

      {/* Desktop caps its own height; on mobile the bottom sheet does the
          scrolling, so the list flows naturally. */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 md:max-h-72 md:overflow-y-auto">
        {loading.list && (
          <div className="p-4 flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {!loading.list && list.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            Pick a state or city, or type a name.
          </div>
        )}

        {!loading.list &&
          list.map((b) => (
            <button
              key={b.osm_id}
              onClick={() => selectBuilding(b)}
              className={`w-full text-left p-3 min-h-touch hover:bg-blue-50 active:bg-blue-100 transition-colors ${
                selected && selected.osm_id === b.osm_id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium text-gray-900 text-sm truncate">{b.label}</div>
              <div className="text-xs text-gray-500">
                {b.levels ? `${b.levels} storeys · ` : ''}
                {b.city}, {b.state}
              </div>
            </button>
          ))}
      </div>

      {selected && selected.monitoring && (
        <div className="text-xs">
          {selected.monitoring.live ? (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              Live traffic data nearby
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
              Modelled from road/rail proximity
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BuildingPicker;
