"use client";

export type SoundEvent = "notification" | "message" | "success" | "react";

let audioContext: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function playTone(freq: number, duration: number, volume = 0.06, type: OscillatorType = "sine") {
  const ctx = getContext();
  if (!ctx) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = freq;

  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

export function playActionSound(event: SoundEvent) {
  if (typeof window === "undefined") {
    return;
  }

  if (event === "notification") {
    playTone(740, 0.18, 0.05, "triangle");
    setTimeout(() => playTone(940, 0.13, 0.04, "triangle"), 90);
    return;
  }

  if (event === "message") {
    playTone(620, 0.08, 0.04, "sine");
    setTimeout(() => playTone(540, 0.08, 0.035, "sine"), 80);
    return;
  }

  if (event === "react") {
    playTone(520, 0.07, 0.03, "square");
    setTimeout(() => playTone(680, 0.1, 0.03, "square"), 60);
    return;
  }

  playTone(480, 0.1, 0.04, "triangle");
  setTimeout(() => playTone(720, 0.1, 0.03, "triangle"), 70);
}
