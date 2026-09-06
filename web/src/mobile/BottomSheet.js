// BottomSheet — a draggable bottom sheet with snap points. No dependencies.
//
// The centrepiece of the mobile kit: a full-bleed map with this sheet sliding
// over its lower portion. Three snaps:
//   peek  — handle + header only (map is the star)
//   half  — ~55 dvh
//   full  — ~92 dvh (content scrolls internally)
//
// Drag the grab handle or the header to move between snaps. A flick snaps in
// the direction of travel; a slow drag snaps to nearest. When expanded and the
// inner content is scrolled to the top, dragging down collapses the sheet
// before the content scrolls.
//
// Props:
//   snap        controlled snap id ('peek' | 'half' | 'full')
//   onSnapChange(id)
//   header      node rendered in the always-visible drag area
//   children    scrollable body
import React, { useCallback, useEffect, useRef, useState } from 'react';

const SNAP_VH = { peek: 0.12, half: 0.55, full: 0.92 };
const ORDER = ['peek', 'half', 'full'];

function vh() {
  return typeof window === 'undefined' ? 800 : window.innerHeight;
}

export default function BottomSheet({
  snap = 'half',
  onSnapChange,
  header,
  children,
  className = '',
}) {
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const drag = useRef(null); // { startY, startTranslate, lastY, lastT }
  const [dragging, setDragging] = useState(false);
  const [translate, setTranslate] = useState(() => vh() * (1 - SNAP_VH[snap]));

  const translateFor = useCallback((id) => vh() * (1 - SNAP_VH[id]), []);

  // follow controlled `snap` when not dragging
  useEffect(() => {
    if (!dragging) setTranslate(translateFor(snap));
  }, [snap, dragging, translateFor]);

  useEffect(() => {
    const onResize = () => !drag.current && setTranslate(translateFor(snap));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [snap, translateFor]);

  const settle = useCallback(
    (endTranslate, velocity) => {
      const H = vh();
      // predicted resting point after a little momentum
      const projected = endTranslate + velocity * 90;
      let best = ORDER[0];
      let bestDist = Infinity;
      for (const id of ORDER) {
        const t = H * (1 - SNAP_VH[id]);
        const d = Math.abs(projected - t);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
      setTranslate(H * (1 - SNAP_VH[best]));
      if (best !== snap) onSnapChange?.(best);
    },
    [snap, onSnapChange]
  );

  const onPointerDown = (e) => {
    // only start a drag from the handle/header, or from the body when it's
    // scrolled to the very top and the gesture is downward
    const fromBody = bodyRef.current?.contains(e.target);
    if (fromBody && bodyRef.current.scrollTop > 0) return;
    drag.current = {
      startY: e.clientY,
      startT: translate,
      lastY: e.clientY,
      lastT: translate,
      fromBody,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const H = vh();
    let next = d.startT + (e.clientY - d.startY);
    // if the drag began in the body, only allow collapsing (downward)
    if (d.fromBody && next < d.startT) next = d.startT;
    next = Math.max(H * (1 - SNAP_VH.full), Math.min(H * (1 - SNAP_VH.peek), next));
    d.lastT = next;
    // rough instantaneous velocity (px per px of pointer travel ~ per frame)
    d.velocity = e.clientY - d.lastY;
    d.lastY = e.clientY;
    setTranslate(next);
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d) settle(d.lastT, d.velocity || 0);
  };

  const cycle = () => {
    const i = ORDER.indexOf(snap);
    const nextId = ORDER[Math.min(ORDER.length - 1, i + 1)] === snap ? 'peek' : ORDER[i + 1];
    onSnapChange?.(nextId ?? 'peek');
  };

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] ${className}`}
      style={{
        height: `${SNAP_VH.full * 100}dvh`,
        transform: `translateY(${translate}px)`,
        transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        touchAction: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* drag area */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <button
          type="button"
          onClick={cycle}
          aria-label="Resize panel"
          className="mx-auto mt-2 block h-1.5 w-10 rounded-full bg-gray-300"
        />
        {header && <div className="px-4 pb-3 pt-2">{header}</div>}
      </div>

      {/* scrollable body */}
      <div
        ref={bodyRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
