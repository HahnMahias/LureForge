import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

const exporter = new STLExporter();

/** Pure: builds binary STL data from a geometry. No side effects. */
export function buildStlArrayBuffer(geometry: THREE.BufferGeometry): ArrayBuffer {
  const mesh = new THREE.Mesh(geometry);
  // STLExporter's binary mode actually returns a DataView over the buffer,
  // despite its type/doc saying ArrayBuffer.
  const result = exporter.parse(mesh, { binary: true }) as unknown as DataView;
  return result.buffer as ArrayBuffer;
}

/** Side effect: saves the given STL data as a file via the browser. */
export function downloadStl(filename: string, data: ArrayBuffer) {
  const blob = new Blob([data], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
