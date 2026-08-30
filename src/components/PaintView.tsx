import Viewport3D from './Viewport3D';

/**
 * The Paint tab's center view — literally the same 3D viewport Editor uses
 * (move/rotate/size tools, center-of-gravity/buoyancy markers and all),
 * wrapped as its own component rather than rendering Viewport3D directly
 * from App.tsx, so Paint has a dedicated place to grow its own view-specific
 * controls later without touching Editor's. The paint texture itself is
 * applied to the shared LureBody material (see LureBody.tsx's
 * usePaintStore reads), so it's already visible here with zero extra wiring
 * — `opaque` just makes sure it actually SHOWS those colors instead of
 * Editor's translucent-once-featured look (see Viewport3D.tsx's own comment
 * on the prop): the point of Paint is seeing the real finish, not seeing
 * through the hull to place feature markers.
 */
export default function PaintView() {
  return <Viewport3D opaque />;
}
