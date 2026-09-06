// NoisePanel — 24-hour RELATIVE noise-risk indicator for the Petalz pilot.
//
// This is NOT a calibrated dB(A) value. The score blends road-congestion and
// train-frequency proxies (see the Worker's /api/risk and ADR-001). The floor
// slider applies an illustrative-only adjustment — there is no validated
// height/façade model yet.
import React, { useState } from 'react';
import { useBuildings } from '../../hooks/useBuildings';
import LoadingSpinner from '../common/LoadingSpinner';

const HOUR_LABELS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

// Illustrative only: mid floors get slight relief from ground-level screening,
// upper floors see the sources more directly. Not a real model.
function floorMultiplier(floor, levels) {
  if (!levels || levels < 2) return 1;
  const frac = Math.min(1, Math.max(0, floor / levels));
  return 0.9 + 0.25 * frac; // 0.9 at ground .. 1.15 at roof
}

const NoisePanel = () => {
  const { selected, risk, readings, loading } = useBuildings();
  const [floor, setFloor] = useState(10);

  if (!selected) {
    return (
      <div className="text-sm text-gray-500">
        Select a building to see its noise-risk profile.
      </div>
    );
  }

  const monitored = selected.monitoring && selected.monitoring.available;
  const levels = selected.levels || 30;

  if (loading.noise && !risk) {
    return (
      <div className="p-6 flex justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!monitored) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-700 font-medium">{selected.label}</div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          {selected.monitoring
            ? selected.monitoring.reason
            : 'No monitored road or rail segments near this building yet.'}
          <br />
          Only <strong>Petalz Residences</strong> is instrumented so far. As more
          road/rail segments are added, this panel will populate for other
          buildings too.
        </div>
      </div>
    );
  }

  const mult = floorMultiplier(floor, levels);
  const hours = risk ? risk.hours : [];
  const peak = hours.reduce((m, h) => Math.max(m, h.score), 0.01);
  const latest = readings && readings.length ? readings[0] : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-gray-800">
          {risk ? risk.building : selected.label} — relative noise-risk by hour
        </div>
        <div className="text-xs text-gray-500">
          Indicative only, not decibels. {risk && !risk.calibrated ? 'Uncalibrated.' : ''}
        </div>
      </div>

      {/* 24-hour bar chart */}
      <div className="flex items-end gap-[2px] h-32">
        {hours.map((h) => {
          const v = Math.min(1, (h.score * mult) / peak);
          return (
            <div
              key={h.hour}
              className="flex-1 bg-blue-500/80 rounded-t"
              style={{ height: `${Math.max(2, v * 100)}%` }}
              title={`${h.hour}:00 — score ${(h.score * mult).toFixed(2)} (road ${
                h.road_factor ?? 'n/a'
              }, train ${h.train_factor}, ${h.train_passbys} passbys)`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        {HOUR_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      {/* Floor slider (illustrative) */}
      <div>
        <label className="text-xs text-gray-600">
          Floor: <strong>{floor}</strong> of {levels}{' '}
          <span className="text-gray-400">(×{mult.toFixed(2)} — illustrative)</span>
        </label>
        <input
          type="range"
          min="1"
          max={levels}
          value={floor}
          onChange={(e) => setFloor(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Latest raw reading */}
      {latest && (
        <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
          Latest sample {new Date(latest.ts).toLocaleString()} —{' '}
          {latest.segment}: speed ratio{' '}
          {latest.speed_ratio != null ? latest.speed_ratio.toFixed(2) : 'n/a'},{' '}
          {latest.train_passbys_this_hour} train pass-bys this hour.
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {(selected.monitoring.sources || []).map((s) => (
          <span
            key={s.name}
            className="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] rounded-full"
          >
            {s.kind} · {s.name} · ~{s.distance_m} m
          </span>
        ))}
      </div>
    </div>
  );
};

export default NoisePanel;
