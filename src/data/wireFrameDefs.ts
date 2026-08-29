export type WireFrameStyle =
  | 'throughWire'
  | 'threePointThroughWire'
  | 'fourPointThroughWire'
  | 'zoWire'
  | 'doubleZWire'
  | 'vWire'
  | 'uWire'
  | 'jWire'
  | 'sWire'
  | 'tWire'
  | 'yWire'
  | 'twoPointWire'
  | 'bellyWeightWire'
  | 'internalHarnessWire'
  | 'customShapedWire';

export interface WirePoint {
  x: number; // 0..1, normalized position along the body length (0 = nose)
  y: number; // roughly -1..1, normalized vertical offset (scaled by wire amplitude)
  z?: number; // roughly -1..1, normalized side offset, for forked frames
  ring?: boolean; // render an attachment loop here
}

export interface WireFrameDef {
  label: string;
  description: string;
  segments: WirePoint[][];
  stemThickness?: number; // tube-radius multiplier, for frames like the belly weight stem
}

export const WIRE_FRAME_DEFS: Record<WireFrameStyle, WireFrameDef> = {
  throughWire: {
    label: 'Through wire',
    description: 'Wire runs straight through the lure body. Very strong and simple.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.5, y: 0, ring: true },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  threePointThroughWire: {
    label: '3-point through wire',
    description: 'Three attachment points (front, middle, back). Widely used for minnow lures.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.3, y: 0 },
        { x: 0.5, y: -0.6, ring: true },
        { x: 0.7, y: 0 },
        { x: 0.85, y: 0.3 },
        { x: 1, y: -0.15, ring: true },
      ],
    ],
  },
  fourPointThroughWire: {
    label: '4-point through wire',
    description: 'Extra attachment point for more support and balance. Ideal for larger lures.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.25, y: -0.35, ring: true },
        { x: 0.5, y: 0.3 },
        { x: 0.75, y: -0.35, ring: true },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  zoWire: {
    label: 'ZO wire (offset)',
    description: 'Offset design for more action and swimming motion. Popular on jerkbaits.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.25, y: 0.5 },
        { x: 0.5, y: -0.6 },
        { x: 0.75, y: 0.5 },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  doubleZWire: {
    label: 'Double Z wire',
    description: 'Double Z shape adds extra action and stability. Widely used in jerkbaits.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.2, y: 0.5 },
        { x: 0.35, y: -0.5 },
        { x: 0.5, y: 0, ring: true },
        { x: 0.65, y: 0.5 },
        { x: 0.8, y: -0.5 },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  vWire: {
    label: 'V wire',
    description: 'V-shaped frame for high action and fast movements.',
    segments: [
      [
        { x: 0.4, y: -0.7, z: 0, ring: true },
        { x: 0.65, y: 0.6, z: -0.6, ring: true },
      ],
      [
        { x: 0.4, y: -0.7, z: 0, ring: true },
        { x: 0.65, y: 0.6, z: 0.6, ring: true },
      ],
    ],
  },
  uWire: {
    label: 'U wire',
    description: 'U-shaped frame gives a wide, rolling action. Often used in crankbaits.',
    segments: [
      [
        { x: 0.3, y: 0.5, z: -0.5, ring: true },
        { x: 0.4, y: -0.3, z: -0.25 },
        { x: 0.5, y: -0.6, z: 0 },
        { x: 0.6, y: -0.3, z: 0.25 },
        { x: 0.7, y: 0.5, z: 0.5, ring: true },
      ],
    ],
  },
  jWire: {
    label: 'J wire',
    description: 'J-shaped frame for a natural swimming action. Widely used in swimbaits.',
    segments: [
      [
        { x: 0.2, y: 0.3, ring: true },
        { x: 0.5, y: 0 },
        { x: 0.7, y: -0.4 },
        { x: 0.8, y: -0.65 },
        { x: 0.73, y: -0.8, ring: true },
        { x: 0.6, y: -0.72 },
      ],
    ],
  },
  sWire: {
    label: 'S wire',
    description: 'S-shaped frame gives a smooth, stable swimming action.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.3, y: 0.5 },
        { x: 0.5, y: 0, ring: true },
        { x: 0.7, y: -0.5 },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  tWire: {
    label: 'T wire',
    description: 'T-shaped frame with vertical support. Gives stability and control in the water.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 1, y: 0, ring: true },
      ],
      [
        { x: 0.5, y: 0 },
        { x: 0.5, y: -0.85, ring: true },
      ],
    ],
  },
  yWire: {
    label: 'Y wire',
    description: 'Y shape spreads force and weight. Good for large, heavy lures.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.45, y: -0.25 },
      ],
      [
        { x: 0.45, y: -0.25 },
        { x: 0.72, y: 0.55, z: -0.5, ring: true },
      ],
      [
        { x: 0.45, y: -0.25 },
        { x: 0.72, y: 0.55, z: 0.5, ring: true },
      ],
    ],
  },
  twoPointWire: {
    label: '2-point wire',
    description: 'Front and back attachment point, no belly eye. For light or topwater lures.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  bellyWeightWire: {
    label: 'Belly weight wire',
    description: 'Design with an extra eyelet or mount for internal (belly) weight.',
    stemThickness: 1.6,
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 1, y: 0, ring: true },
      ],
      [
        { x: 0.5, y: 0 },
        { x: 0.5, y: -0.85, ring: true },
      ],
    ],
  },
  internalHarnessWire: {
    label: 'Internal harness wire',
    description: 'Internal harness linking multiple eyelets together. Very strong and stable.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.2, y: 0.25, ring: true },
        { x: 0.4, y: -0.25, ring: true },
        { x: 0.6, y: 0.25, ring: true },
        { x: 0.8, y: -0.25, ring: true },
        { x: 1, y: 0, ring: true },
      ],
    ],
  },
  customShapedWire: {
    label: 'Custom shaped wire',
    description: 'Custom design for specific action, diving depth, or lure shape.',
    segments: [
      [
        { x: 0, y: 0, ring: true },
        { x: 0.15, y: 0.3 },
        { x: 0.35, y: -0.5, ring: true },
        { x: 0.55, y: 0.1 },
        { x: 0.7, y: 0.4 },
        { x: 0.9, y: -0.3 },
        { x: 1, y: 0.2, ring: true },
      ],
    ],
  },
};

export const WIRE_FRAME_STYLES = Object.keys(WIRE_FRAME_DEFS) as WireFrameStyle[];
