// MobileShell — the phone layout for SeeNoise: a full-bleed map with a
// draggable bottom sheet. PlaceSearchApp renders this instead of the desktop
// sidebar layout when useBreakpoint().isMobile is true.
//
// The map, picker, noise panel and search all read the same Redux state as the
// desktop layout — this is purely presentational.
import React, { useEffect, useRef, useState } from 'react';
import MapContainer from '../components/Map/MapContainer';
import BuildingPicker from '../components/BuildingPicker/BuildingPicker';
import NoisePanel from '../components/NoisePanel/NoisePanel';
import PlaceAutocomplete from '../components/PlaceAutocomplete/PlaceAutocomplete';
import SearchHistory from '../components/SearchHistory/SearchHistory';
import BottomSheet from './BottomSheet';
import SegmentedControl from './SegmentedControl';
import { useBuildings } from '../hooks/useBuildings';

const TABS = [
  { value: 'building', label: 'Building' },
  { value: 'noise', label: 'Noise' },
  { value: 'more', label: 'More' },
];

export default function MobileShell() {
  const [tab, setTab] = useState('building');
  const [snap, setSnap] = useState('half');
  const { selected } = useBuildings();
  const lastSelected = useRef(null);

  // when a building is picked, surface its noise profile
  useEffect(() => {
    const id = selected?.osm_id;
    if (id && id !== lastSelected.current) {
      lastSelected.current = id;
      setTab('noise');
      setSnap((s) => (s === 'peek' ? 'half' : s));
    }
  }, [selected]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-gray-100"
      style={{ height: '100dvh' }}
    >
      {/* map fills the screen */}
      <div className="absolute inset-0">
        <MapContainer />
      </div>

      {/* floating app bar */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="pointer-events-auto rounded-xl bg-white/90 px-3 py-2 shadow-md backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔊</span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-gray-900">SeeNoise</div>
              <div className="text-[11px] text-gray-500">Klang Valley noise risk</div>
            </div>
          </div>
        </div>
      </div>

      {/* draggable panel */}
      <BottomSheet
        snap={snap}
        onSnapChange={setSnap}
        header={<SegmentedControl value={tab} onChange={setTab} options={TABS} />}
      >
        {tab === 'building' && (
          <div className="space-y-4 pt-3">
            <BuildingPicker />
          </div>
        )}
        {tab === 'noise' && (
          <div className="pt-3">
            <NoisePanel />
          </div>
        )}
        {tab === 'more' && (
          <div className="space-y-6 pt-3">
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-800">Find any address</h2>
              <PlaceAutocomplete />
            </section>
            <section>
              <SearchHistory />
            </section>
            <p className="pt-2 text-[11px] leading-snug text-gray-400">
              Data: TomTom traffic · KTM GTFS · OpenStreetMap. Noise scores are a
              modelled relative index, not calibrated decibels.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
