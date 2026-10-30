// Makes the game's sound effects from nothing but arithmetic, so they have no outside source or
// licence to track (ADR 0005). The output is committed. Rerun this only to change a sound:
//   node scripts/generate-sounds.mjs
import { writeFileSync } from "node:fs";

const sampleRate = 22_050;

/** A fixed sequence rather than Math.random, so rerunning this gives identical files. */
function noiseSource() {
  let value = 12345;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value / 2147483647) * 2 - 1;
  };
}

function render(seconds, sampleAt) {
  return Float64Array.from(
    { length: Math.floor(seconds * sampleRate) },
    (_, index) => sampleAt(index / sampleRate),
  );
}

/** One note that starts sharply and rings away. */
function bell(time, frequency, start, ring) {
  if (time < start) return 0;
  const since = time - start;
  return (
    Math.sin(2 * Math.PI * frequency * since) *
    Math.exp(-since / ring) *
    Math.min(1, since / 0.005)
  );
}

function launch() {
  const noise = noiseSource();
  let rumble = 0;
  return render(2, (time) => {
    // Filtered noise that builds, roars and fades, under a rising tone.
    rumble += (noise() - rumble) * 0.06;
    const swell = Math.min(1, time / 0.5) * Math.min(1, (2 - time) / 0.8);
    const tone = Math.sin(2 * Math.PI * (70 + 45 * time) * time);
    return swell * (rumble * 2.6 + tone * 0.2);
  });
}

function failure() {
  return render(1.1, (time) => {
    // A falling buzz, made harsh by a few odd harmonics.
    const phase = 2 * Math.PI * (300 * time - 110 * time * time);
    const buzz =
      Math.sin(phase) + Math.sin(3 * phase) / 3 + Math.sin(5 * phase) / 5;
    return (
      buzz * 0.6 * Math.min(1, time / 0.01) * Math.min(1, (1.1 - time) / 0.4)
    );
  });
}

function milestone() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  return render(1.3, (time) =>
    notes.reduce(
      (total, note, index) =>
        total + bell(time, note, index * 0.13, 0.35) * 0.4,
      0,
    ),
  );
}

function fundingThreshold() {
  return render(0.8, (time) =>
    [
      [1318.5, 0],
      [1975.5, 0.09],
    ].reduce(
      (total, [note, start]) =>
        total +
        (bell(time, note, start, 0.18) + bell(time, note * 2, start, 0.09)) *
          0.3,
      0,
    ),
  );
}

/** Mono 16-bit PCM, which every browser can play. */
function toWav(samples) {
  const dataSize = samples.length * 2;
  const file = Buffer.alloc(44 + dataSize);
  file.write("RIFF", 0, "ascii");
  file.writeUInt32LE(36 + dataSize, 4);
  file.write("WAVEfmt ", 8, "ascii");
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 2, 28);
  file.writeUInt16LE(2, 32);
  file.writeUInt16LE(16, 34);
  file.write("data", 36, "ascii");
  file.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    file.writeInt16LE(Math.round(clipped * 32767), 44 + index * 2);
  });
  return file;
}

const sounds = {
  "launch.wav": launch,
  "failure.wav": failure,
  "milestone.wav": milestone,
  "funding-threshold.wav": fundingThreshold,
};

for (const [fileName, make] of Object.entries(sounds)) {
  writeFileSync(`public/sounds/${fileName}`, toWav(make()));
}
