import * as THREE from "three";
import type { FaceId } from "../state/store";

export const FACE_TRANSFORM: Record<
  FaceId,
  { position: [number, number, number]; rotation: [number, number, number] }
> = {
  "control-plane": { position: [0,  1, 0],  rotation: [-Math.PI / 2, 0, 0] },
  "nodes":         { position: [0,  0, 1],  rotation: [0, 0, 0] },
  "pods":          { position: [1,  0, 0],  rotation: [0,  Math.PI / 2, 0] },
  "networking":    { position: [-1, 0, 0],  rotation: [0, -Math.PI / 2, 0] },
  "storage":       { position: [0,  0, -1], rotation: [0,  Math.PI, 0] },
  "foundations":   { position: [0, -1, 0],  rotation: [ Math.PI / 2, 0, 0] },
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);

/** Map a face-local point (XY plane, +Z is outward) into world space. */
export function faceLocalToWorld(
  face: FaceId,
  localX: number,
  localY: number,
  localZ: number,
): THREE.Vector3 {
  const t = FACE_TRANSFORM[face];
  _v.set(t.position[0], t.position[1], t.position[2]);
  _e.set(t.rotation[0], t.rotation[1], t.rotation[2]);
  _q.setFromEuler(_e);
  _m.compose(_v, _q, _s);
  const out = new THREE.Vector3(localX, localY, localZ);
  return out.applyMatrix4(_m);
}
