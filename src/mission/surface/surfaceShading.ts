import {
  Color,
  DataTexture,
  DoubleSide,
  FrontSide,
  LinearFilter,
  LinearMipmapNearestFilter,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  type Texture,
} from "three";
import { detailTexels, detailTextureSize } from "./detailTexture";
import { horizonColor, toSun } from "./terrain";

/**
 * The materials of everything at the surface. None takes the scene's lights, which would fall on the other views too:
 * each works out its own light from the same low Sun the terrain is lit by, so the land, the rocks and the models
 * agree, and the land and rocks fade into a haze towards the horizon.
 */

const sun = `const vec3 toSun = normalize(vec3(${toSun.x}, ${toSun.y}, ${toSun.z}));`;

/** How much the distance hides, from none near the camera to over half the colour far off. */
const haze = `
float hazeAt(vec3 world) {
  return 0.55 * smoothstep(5.0, 19.0, distance(world, cameraPosition));
}`;

const horizon = new Color(...horizonColor);

/** The ground's fine grain, as a texture that repeats across it. */
export function detailTexture(): Texture {
  const size = detailTextureSize;
  const texture = new DataTexture(detailTexels(), size, size, RedFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapNearestFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The terrain's colours, already lit, scaled by the fine grain where the terrain says it shows. The grain is read once
 * per pixel, from the nearest size of it, as each extra read costs software rendering at 4K a few per cent of its frame.
 */
export function terrainMaterial(grain: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexColors: true,
    uniforms: { grain: { value: grain }, horizon: { value: horizon } },
    vertexShader: `
      attribute float detail;
      varying vec3 vColor;
      varying float vDetail;
      varying vec2 vGrain;
      varying float vHaze;
      ${haze}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vColor = color;
        vDetail = detail;
        vGrain = position.xz * 0.9;
        vHaze = hazeAt(world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D grain;
      uniform vec3 horizon;
      varying vec3 vColor;
      varying float vDetail;
      varying vec2 vGrain;
      varying float vHaze;
      void main() {
        float grit = texture2D(grain, vGrain).r * 2.0;
        vec3 land = vColor * mix(1.0, grit, vDetail * 0.6);
        gl_FragColor = vec4(mix(land, horizon, vHaze), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** The rocks, each in its own colour, lit face by face as the terrain is, and fading into the haze. */
export function rockMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { horizon: { value: horizon } },
    vertexShader: `
      uniform vec3 horizon;
      varying vec3 vColor;
      ${sun}
      ${haze}
      void main() {
        mat4 placed = modelMatrix * instanceMatrix;
        vec4 world = placed * vec4(position, 1.0);
        vec3 normalOut = normalize(mat3(placed) * normal);
        float light = 0.35 + 1.05 * max(dot(normalOut, toSun), 0.0);
        vColor = mix(instanceColor * light, horizon, hazeAt(world.xyz));
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * How a model's part takes the light. A matte part, such as a thermal blanket or a tyre, only darkens away from the
 * Sun. The others also catch a glint of the bright sky, broad on painted parts and crinkled foil, and small and sharp
 * on bare metal and on glass, such as solar cells and windows. `roughness` and `metalness` are what the Asset cards'
 * pictures, which take real lights, use instead.
 */
export const finishes = {
  matte: { gloss: 0, shine: 1, roughness: 0.95, metalness: 0 },
  paint: { gloss: 0.06, shine: 10, roughness: 0.6, metalness: 0.1 },
  foil: { gloss: 0.3, shine: 5, roughness: 0.32, metalness: 0.5 },
  metal: { gloss: 0.32, shine: 28, roughness: 0.35, metalness: 0.55 },
  glass: { gloss: 0.55, shine: 70, roughness: 0.15, metalness: 0.3 },
} as const;

export type Finish = keyof typeof finishes;

/** What a part's material says about it, for the Asset cards' pictures to light it the same way. */
export interface PartLook {
  color: Color;
  finish: Finish;
  double: boolean;
}

/**
 * Lighter on top and on the Sun's side, darker underneath and away from it, but never far from the part's own colour,
 * which is what the models were painted to read as. The glint comes from high in the sky behind the camera. The light
 * is worked out at each corner rather than each pixel, which software rendering at 4K can't spare, and for both sides
 * of a face only for the parts seen from inside as well, such as a dish.
 */
const partVertex = `
  uniform vec3 color;
  uniform float gloss;
  uniform float shine;
  varying vec3 vFront;
  varying vec3 vBack;
  ${sun}
  const vec3 toGlint = normalize(vec3(-0.35, 0.85, -0.4));
  vec3 litFacing(vec3 normalOut, vec3 toCamera) {
    vec3 sunAcross = normalize(vec3(toSun.x, 0.0, toSun.z));
    float light = 0.9 + 0.16 * normalOut.y + 0.14 * dot(normalOut, sunAcross);
    float glint = pow(max(dot(reflect(-toGlint, normalOut), toCamera), 0.0), shine);
    return color * light + gloss * glint;
  }
  void main() {
    mat4 placed = modelMatrix;
    #ifdef USE_INSTANCING
      placed = modelMatrix * instanceMatrix;
    #endif
    vec4 world = placed * vec4(position, 1.0);
    vec3 normalOut = normalize(mat3(placed) * normal);
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    vFront = litFacing(normalOut, toCamera);
    #ifdef DOUBLE_SIDED
      vBack = litFacing(-normalOut, toCamera);
    #else
      vBack = vFront;
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const partFragment = `
  varying vec3 vFront;
  varying vec3 vBack;
  void main() {
    gl_FragColor = vec4(gl_FrontFacing ? vFront : vBack, 1.0);
    #include <colorspace_fragment>
  }`;

const partMaterials = new Map<string, ShaderMaterial>();

/** The material for a part of a model, shared by every part of the same colour and finish, as there are many. */
export function partMaterial(
  color: string,
  finish: Finish = "paint",
  double = false,
): ShaderMaterial {
  const key = `${color} ${finish} ${String(double)}`;
  const known = partMaterials.get(key);
  if (known) return known;
  const { gloss, shine } = finishes[finish];
  const look: PartLook = { color: new Color(color), finish, double };
  const material = new ShaderMaterial({
    uniforms: {
      color: { value: look.color },
      gloss: { value: gloss },
      shine: { value: shine },
    },
    vertexShader: partVertex,
    fragmentShader: partFragment,
    side: double ? DoubleSide : FrontSide,
  });
  material.userData = { part: look };
  partMaterials.set(key, material);
  return material;
}

/** What a material says about the part it's on, if it's a part of a surface model. */
export function partLookOf(material: unknown): PartLook | null {
  if (!(material instanceof ShaderMaterial)) return null;
  const { part } = material.userData as { part?: PartLook };
  return part ?? null;
}
