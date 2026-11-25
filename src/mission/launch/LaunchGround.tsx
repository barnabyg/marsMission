// The coastal plain surrounding the apron. Broad changes of colour and a distant belt of haze
// are interpolated from the mesh, keeping the cost of the full-screen ground low at 4K.
export function LaunchGround() {
  return (
    <mesh position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[480, 480, 64, 64]} />
      <shaderMaterial
        vertexShader={`varying vec3 grass;
      void main() {
        vec2 field = position.xy;
        float patches=.5+.23*sin(field.x*.42+sin(field.y*.28))+.19*sin(field.y*.19+field.x*.07);
        vec3 near=mix(vec3(.055,.094,.071),vec3(.23,.26,.13),patches);
        vec4 eye=modelViewMatrix*vec4(position,1.);
        grass=mix(near,vec3(.48,.50,.46),smoothstep(5.,43.,-eye.z));
        gl_Position=projectionMatrix*eye;
      }`}
        fragmentShader={`varying vec3 grass;
      void main() {
        gl_FragColor=vec4(grass,1.);
        #include <colorspace_fragment>
      }`}
      />
    </mesh>
  );
}
