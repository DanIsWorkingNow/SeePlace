// NoisePanel — modelled 24-hour RELATIVE noise-risk index (0-100) for the
// selected building. NOT calibrated dB(A). The score blends nearby road class
// + distance attenuation + (live traffic where available, else a diurnal
// profile) + KTM train frequency. The floor slider is illustrative only.
import React, { useState } from 'react';
import { useBuildings } from '../../hooks/useBuildings';
import LoadingSpinner from '../common/LoadingSpinner';

const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

// Illustrative only — no validated height/façade model.
function floorMultiplier(floor, levels) {
  if (!levels || levels < 2) return 1;
  const frac = Math.min(1, Math.max(0, floor / levels));
  return 0.9 + 0.25 * frac;
}

function band(score) {
  if (score >= 66) return { label: 'High', color: 'text-red-600' };
  if (score >= 33) return { label: 'Moderate', color: 'text-amber-600' };
  return { label: 'Low', color: 'text-green-600' };
}

const NoisePanel = () => {
  const { selected, risk, readings, loading } = useBuildings();
  const [floor, setFloor] = useState(10);

  if (!selected) {
    return <div className="text-sm text-gray-500">Select a building to see its noise-risk profile.</div>;
  }

  const levels = selected.levels || 30;

  if (loading.noise && !risk) {
    return <div className="p-6 flex justify-center"><LoadingSpinner size="md" /></div>;
  }
  if (!risk) {
    return <div className="text-sm text-gray-500">{selected.label}</div>;
  }

  const mult = floorMultiplier(floor, levels);
  const hours = risk.hours || [];
  const peak = Math.max(0.01, ...hours.map((h) => h.score));
  const dayPeak = Math.max(...hours.map((h) => h.score * mult), 0);
  const dayBand = band(dayPeak);
  const latest = readings && readings.length ? readings[0] : null;
  const noSources = !risk.sources || risk.sources.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-gray-800">{risk.name || selected.label}</div>
        <div className="text-xs text-gray-500">
          Modelled relative index, not decibels.
          {risk.live_source_count > 0
            ? ` ${risk.live_source_count} source(s) with live traffic.`
            : ' No live traffic feed nearby — diurnal profile.'}
        </div>
      </div>

      {noSources ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          No motorway, trunk, or primary/secondary road and no rail within 300 m.
          Modelled traffic-noise exposure is <strong>low</strong>.
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${dayBand.color}`}>{Math.round(dayPeak)}</span>
            <span className={`text-sm font-medium ${dayBand.color}`}>{dayBand.label}</span>
            <span className="text-xs text-gray-400">peak / 100</span>
          </div>

          {/* 24-hour bar chart */}
          <div className="flex items-end gap-[2px] h-28">
            {hours.map((h) => {
              const v = Math.min(1, (h.score * mult) / peak);
              return (
                <div
                  key={h.hour}
                  className="flex-1 bg-blue-500/80 rounded-t"
                  style={{ height: `${Math.max(2, v * 100)}%` }}
                  title={`${h.hour}:00 — ${(h.score * mult).toFixed(0)} (road ${h.road_component}, rail ${h.rail_component})`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            {HOUR_LABELS.map((l) => <span key={l}>{l}</span>)}
          </div>

          {/* Floor slider (illustrative) */}
          <div>
            <label className="text-xs text-gray-600">
              Floor <strong>{floor}</strong> / {levels}{' '}
              <span className="text-gray-400">(×{mult.toFixed(2)}, illustrative)</span>
            </label>
            <input
              type="range" min="1" max={levels} value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {latest && (
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
              Latest live sample {new Date(latest.ts).toLocaleString()} — {latest.segment}:
              speed ratio {latest.speed_ratio != null ? latest.speed_ratio.toFixed(2) : 'n/a'}.
            </div>
          )}
        </>
      )}

      {/* sources */}
      <div className="flex flex-wrap gap-1">
        {(risk.sources || []).map((s) => (
          <span
            key={`${s.kind}-${s.class}-${s.name}`}
            className={`px-2 py-1 text-[11px] rounded-full ${
              s.live ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
            title={s.live ? 'live traffic data' : 'modelled from proximity'}
          >
            {s.kind === 'rail' ? '🚆' : '🛣️'} {s.name || s.class}
            {s.ref ? ` (${s.ref})` : ''} · ~{Math.round(s.distance_m)} m{s.live ? ' · live' : ''}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 leading-snug">{risk.model}</p>
    </div>
  );
};

export default NoisePanel;
