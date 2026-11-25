import type { ReactNode } from "react";
import { DoubleSide, FrontSide, ShaderMaterial, type Material } from "three";
import { Batched } from "../surface/modelParts";
import { partLookOf } from "../surface/surfaceShading";

// The surface models carry Mars' light in their materials. Light the batched Earth parts from
// a low dawn sun instead. Smooth interpolation around each barrel avoids per-pixel lighting at 4K.
const sunlit = new WeakMap<Material, Material>();
function daylight(source: Material) {
  const cached = sunlit.get(source);
  if (cached) return cached;
  const look = partLookOf(source);
  if (!look) return source;
  const material = new ShaderMaterial({
    side: look.double ? DoubleSide : FrontSide,
    uniforms: { paint: { value: look.color } },
    vertexShader: `uniform vec3 paint; varying vec3 lit;
      void main() {
        vec3 n=normalize(transpose(mat3(viewMatrix))*(normalMatrix*normal));
        vec3 sun=normalize(vec3(-7.,6.,2.));
        float warm=max(0.,dot(n,sun));
        vec3 sky=vec3(.47,.53,.62)*(.82+.18*n.y);
        lit=paint*(sky+warm*vec3(.83,.73,.56));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `varying vec3 lit;
      void main() {
        gl_FragColor=vec4(lit,1.);
        #include <colorspace_fragment>
      }`,
  });
  sunlit.set(source, material);
  return material;
}

export function SunlitParts({ children }: { children: ReactNode }) {
  return <Batched materialFor={daylight}>{children}</Batched>;
}
