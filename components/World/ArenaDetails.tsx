import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { GameStatus } from '../../types';

const SHIRTS = ['#e9e5dc', '#225bc1', '#d96a25', '#172439', '#bc3345', '#c69d42'];
const SKIN = ['#6b3e28', '#a16a46', '#dba57a', '#edc4a0', '#422b22'];
const ROWS = 7;
const COLUMNS = 104;
const COUNT = ROWS * COLUMNS * 2;

// A full crowd in six draw calls; no separate React objects for each spectator.
export function ArenaSpectators() {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const cheer = useRef(0);
  const time = useRef(0);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const fans = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const side = i < COUNT / 2 ? -1 : 1;
    const row = Math.floor((i % (COUNT / 2)) / COLUMNS);
    const column = i % COLUMNS;
    return { side, x: side * (17.5 + row * 1.55), y: 0.65 + row * 0.95,
      z: 14 - column * 1.65 - Math.floor(column / 24) * 2.2,
      phase: i * 2.399, scale: 0.88 + ((i * 17) % 13) / 65 };
  }), []);

  useEffect(() => {
    const color = new THREE.Color();
    meshes.current.forEach((mesh, part) => {
      if (!mesh) return;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      fans.forEach((_, i) => mesh.setColorAt(i, color.set(
        part === 0 || part === 2 ? SHIRTS[(i * 7 + Math.floor(i / 9)) % SHIRTS.length] :
        part === 1 || part === 3 ? SKIN[(i * 3 + Math.floor(i / 11)) % SKIN.length] :
        part === 5 ? '#243e60' : '#202630'
      )));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    const celebrate = () => { cheer.current = 2.8; };
    window.addEventListener('dunk-success', celebrate);
    return () => window.removeEventListener('dunk-success', celebrate);
  }, [fans]);

  useFrame((_, delta) => {
    if (useStore.getState().status !== GameStatus.PAUSED && !reducedMotion) {
      time.current += Math.min(delta, 0.05);
      cheer.current = Math.max(0, cheer.current - delta);
    }
    fans.forEach((fan, i) => {
      const wave = reducedMotion ? 0 : Math.max(0, Math.sin(time.current * 3 + fan.phase)) * Math.min(1, cheer.current);
      const bob = reducedMotion ? 0 : Math.sin(time.current * 1.6 + fan.phase) * 0.025;
      const y = fan.y + bob + wave * 0.28;
      const put = (part: number, x: number, py: number, z: number, sx: number, sy: number, sz: number, tilt = 0) => {
        dummy.position.set(x, py, z);
        dummy.rotation.set(0, fan.side < 0 ? Math.PI / 2 : -Math.PI / 2, tilt);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        meshes.current[part]?.setMatrixAt(i, dummy.matrix);
      };
      put(0, fan.x, y + 0.74, fan.z, 0.48 * fan.scale, 0.65 * fan.scale, 0.3);
      put(1, fan.x, y + 1.23 * fan.scale, fan.z, 0.2, 0.24, 0.2);
      put(2, fan.x - fan.side * wave * 0.15, y + 0.75 + wave * 0.52, fan.z - 0.32, 0.14, 0.58, 0.16, -0.25 - wave * 2.2);
      put(3, fan.x - fan.side * wave * 0.15, y + 0.75 + wave * 0.52, fan.z + 0.32, 0.13, 0.58, 0.15, 0.25 + wave * 2.2);
      put(4, fan.x - fan.side * 0.15, fan.y + 0.3, fan.z, 0.4, 0.55, 0.42);
      put(5, fan.x + fan.side * 0.22, fan.y + 0.5, fan.z, 0.62, 0.75, 0.12);
    });
    meshes.current.forEach(mesh => { if (mesh) mesh.instanceMatrix.needsUpdate = true; });
  });

  return <group>{Array.from({ length: 6 }, (_, part) =>
    <instancedMesh key={part} ref={mesh => { meshes.current[part] = mesh; }} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      {part === 1 ? <sphereGeometry args={[1, 8, 6]} /> : <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial roughness={0.88} />
    </instancedMesh>
  )}</group>;
}

function boardTexture(title: string, subtitle: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#091321'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = '#eaa447'; ctx.fillRect(0, 0, 1024, 8);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f3eee2';
  ctx.font = 'bold 76px sans-serif'; ctx.fillText(title, 512, 115);
  ctx.fillStyle = '#67b5eb'; ctx.font = '26px sans-serif'; ctx.fillText(subtitle, 512, 188);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function ArenaArchitecture() {
  const ribbon = useMemo(() => boardTexture('SPORTBIZ  •  BASKETBALL', 'HOME COURT   /   MAKE SOME NOISE'), []);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  return <group>
    {[-1, 1].map(side => <group key={side}>
      {Array.from({ length: ROWS }, (_, row) => <mesh key={row} position={[side * (17.5 + row * 1.55), row * 0.475 + 0.3, -76]} receiveShadow>
        <boxGeometry args={[1.6, 0.6 + row * 0.95, 184]} />
        <meshStandardMaterial color={row % 2 ? '#303a49' : '#394453'} roughness={0.95} />
      </mesh>)}
      {[-8, -38, -68, -98, -128, -158].map(z => <group key={z} position={[side * 15.6, 0, z]}>
        <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.35, 1.3, 26]} /><meshStandardMaterial color="#0d1827" /></mesh>
        <mesh position={[-side * 0.19, 0.72, 0]} rotation={[0, -side * Math.PI / 2, 0]}>
          <planeGeometry args={[25.6, 1.05]} /><meshBasicMaterial map={ribbon} toneMapped={false} />
        </mesh>
      </group>)}
      <mesh position={[side * 29, 10, -75]}><boxGeometry args={[0.5, 24, 200]} /><meshStandardMaterial color="#172332" /></mesh>
      <mesh position={[side * 27.4, 9, -75]}><boxGeometry args={[0.12, 0.12, 194]} /><meshBasicMaterial color="#e7b86a" /></mesh>
      {[-20, -70, -120].map(z => <group key={z} position={[side * 12.8, 0, z]}>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.8, 0.18, 5]} /><meshStandardMaterial color="#172a43" /></mesh>
        {[-2, 2].map(leg => <mesh key={leg} position={[0, 0.24, leg]}><boxGeometry args={[0.55, 0.48, 0.14]} /><meshStandardMaterial color="#6c7580" metalness={0.6} roughness={0.4} /></mesh>)}
      </group>)}
    </group>)}
    <mesh position={[0, 23, -75]}><boxGeometry args={[60, 0.4, 204]} /><meshStandardMaterial color="#111a26" side={THREE.DoubleSide} /></mesh>
    {[-5, -35, -65, -95, -125, -155].map(z => <group key={z} position={[0, 20, z]}>
      <mesh><boxGeometry args={[57, 0.22, 0.25]} /><meshStandardMaterial color="#64707e" metalness={0.65} roughness={0.4} /></mesh>
      {[-11, 0, 11].map(x => <mesh key={x} position={[x, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, 1]} /><meshBasicMaterial color="#fff1cf" toneMapped={false} /></mesh>)}
    </group>)}
  </group>;
}

export function ArenaScoreboard() {
  const score = useStore(state => state.score);
  const texture = useMemo(() => boardTexture(String(Math.floor(score)).padStart(4, '0'), 'SPORTBIZ ARENA   •   LIVE SCORE'), [score]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[0, 12, -62]}>
    <mesh position={[0, 5, 0]}><boxGeometry args={[0.16, 10, 0.16]} /><meshStandardMaterial color="#536171" /></mesh>
    <mesh><boxGeometry args={[10.5, 3.2, 2.4]} /><meshStandardMaterial color="#0b111c" metalness={0.5} roughness={0.4} /></mesh>
    {[0, Math.PI].map(angle => <group key={angle} rotation={[0, angle, 0]}><mesh position={[0, 0, 1.22]}><planeGeometry args={[10, 2.8]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh></group>)}
  </group>;
}
