import { useEffect, useMemo } from "react";
import { SRGBColorSpace, TextureLoader } from "three";

export type Point = readonly [x: number, y: number, z: number];

/** Where a camera is and what it's looking at. */
export interface CameraPose {
  position: Point;
  target: Point;
}

/** An HTML label kept above a point in the scene, which stops it being blurred or thin at 4K. */
export interface SceneLabel {
  text: string;
  position: Point;
  className?: string;
  testId?: string;
  /** Which way out of the globe it faces, for a label on the surface, which hides on the far side. */
  facing?: Point;
}

export const degreesToRadians = Math.PI / 180;

export function useTexture(fileName: string) {
  return useMemo(() => {
    const texture = new TextureLoader().load(
      `${import.meta.env.BASE_URL}art/${fileName}`,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 16;
    return texture;
  }, [fileName]);
}

/** Frees a geometry made in a component when it's replaced or no longer needed. */
export function useDisposal(geometry: { dispose: () => void }) {
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
}
