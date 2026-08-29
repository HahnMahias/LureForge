import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore } from '../store/useFeatureStore';
import { computeCenterOfGravity } from '../utils/physics';

export default function PhysicsMarkers() {
  const bodyWeightG = useSceneStore((s) => s.bodyWeightG);
  const bodyCentroid = useSceneStore((s) => s.bodyCentroid);
  const bodyOffset = useSceneStore((s) => s.bodyOffset);
  const features = useFeatureStore((s) => s.features);

  const cog = useMemo(
    () =>
      computeCenterOfGravity(
        bodyWeightG,
        new THREE.Vector3(bodyCentroid.x, bodyCentroid.y, bodyCentroid.z),
        bodyOffset,
        features,
      ),
    [bodyWeightG, bodyCentroid, bodyOffset, features],
  );

  const dotRadius = 1.6;

  return (
    <>
      <mesh position={[cog.x, cog.y, cog.z]}>
        <sphereGeometry args={[dotRadius, 12, 12]} />
        <meshStandardMaterial color="#e5484d" roughness={0.4} metalness={0} />
      </mesh>
      <mesh position={[bodyCentroid.x, bodyCentroid.y, bodyCentroid.z]}>
        <sphereGeometry args={[dotRadius, 12, 12]} />
        <meshStandardMaterial color="#3d8bd4" roughness={0.4} metalness={0} />
      </mesh>
    </>
  );
}
