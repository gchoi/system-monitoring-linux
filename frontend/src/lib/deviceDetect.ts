// Client-side OS / GPU detection.
//
// The backend telemetry runs inside a Linux container, so it always reports
// "Linux" and only sees GPUs when the host passes them through (mock mode
// otherwise). The browser runs on the real host machine, so it is the
// reliable source for the actual OS and GPU.

export interface DetectedOS {
  /** Human-readable OS name: 'macOS' | 'Windows' | 'Linux' | 'Android' | 'iOS' | 'Unknown'. */
  name: string;
  /** Best-effort version detail, e.g. '15.5' or '10/11'. */
  detail: string;
}

export type GpuVendor =
  | 'nvidia'
  | 'amd'
  | 'intel'
  | 'apple'
  | 'qualcomm'
  | 'software'
  | 'unknown';

export interface DetectedGPU {
  vendor: GpuVendor;
  /** Human-readable vendor label. */
  vendorLabel: string;
  /** Raw renderer string reported by the browser (WebGPU or WebGL). */
  renderer: string;
  /** Cleaned-up GPU model name when it can be derived (e.g. 'Apple M1 Pro'). */
  model?: string;
  /** True when an NVIDIA GPU is detected. */
  isNvidia: boolean;
}

const VENDOR_LABELS: Record<GpuVendor, string> = {
  nvidia: 'NVIDIA',
  amd: 'AMD',
  intel: 'Intel',
  apple: 'Apple',
  qualcomm: 'Qualcomm',
  software: 'Software',
  unknown: 'Unknown',
};

/** Compute backend label per GPU vendor (what workloads would use on it). */
export function computeLabel(vendor: GpuVendor): string {
  switch (vendor) {
    case 'nvidia':
      return 'CUDA';
    case 'apple':
      return 'MPS (Metal Performance Shaders)';
    case 'amd':
      return 'ROCm';
    case 'intel':
      return 'oneAPI / SYCL';
    case 'qualcomm':
      return 'OpenCL';
    default:
      return '';
  }
}

/** Detect the real host OS from the browser's user agent. */
export function detectOS(): DetectedOS {
  if (typeof navigator === 'undefined') return { name: 'Unknown', detail: '' };

  const ua = navigator.userAgent || '';

  // iOS must be checked before macOS: iPadOS masquerades as "Macintosh".
  if (/iPad|iPhone|iPod/i.test(ua)) {
    const m = ua.match(/OS (\d+[._]\d+)/);
    return { name: 'iOS', detail: m ? m[1].replace('_', '.') : '' };
  }
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/);
    return { name: 'Android', detail: m ? m[1] : '' };
  }
  if (/Mac/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
    return { name: 'macOS', detail: m ? m[1].replace(/_/g, '.') : '' };
  }
  if (/Windows/i.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    const ver = m ? m[1] : '';
    return { name: 'Windows', detail: ver === '10.0' ? '10/11' : ver };
  }
  if (/Linux/i.test(ua)) {
    return { name: 'Linux', detail: '' };
  }
  return { name: 'Unknown', detail: '' };
}

/** Detect the real GPU from the browser (WebGPU first, WebGL fallback). */
export async function detectGPU(): Promise<DetectedGPU | null> {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return null;
  const webgpu = await detectGPUWebGPU();
  return webgpu ?? detectGPUWebGL();
}

// ── WebGPU ────────────────────────────────────────────────────────────
// Minimal local typings: `navigator.gpu` / `adapter.info` are not part of
// older lib.dom versions, so we describe only the fields we read.

interface WebGPUAdapterLike {
  info?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
}

interface WebGPUNavigator {
  gpu?: {
    requestAdapter?: () => Promise<WebGPUAdapterLike | null>;
  };
}

async function detectGPUWebGPU(): Promise<DetectedGPU | null> {
  const nav = navigator as Navigator & WebGPUNavigator;
  if (!nav.gpu?.requestAdapter) return null;
  try {
    const adapter = await nav.gpu.requestAdapter();
    const info = adapter?.info;
    if (!info) return null;

    const raw = [info.description, info.device, info.architecture, info.vendor]
      .filter(Boolean)
      .join(' ');
    if (!raw.trim()) return null;

    const vendor = normalizeVendor(raw);
    // Strip PCI vendor/device hex ids (e.g. "0x10de", "0x2206") from display.
    const stripped = raw.replace(/\b0x[0-9a-fA-F]+\b/g, '').trim();
    const renderer = stripped || raw;
    return buildGpuInfo(renderer, vendor, info.description || undefined);
  } catch {
    return null;
  }
}

// ── WebGL ─────────────────────────────────────────────────────────────

function detectGPUWebGL(): DetectedGPU | null {
  try {
    let canvas = document.createElement('canvas');
    let gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) {
      canvas = document.createElement('canvas');
      gl = canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    }
    if (!gl) return null;

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return null;

    const renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').trim();
    if (!renderer) return null;
    return buildGpuInfo(renderer, normalizeVendor(renderer));
  } catch {
    return null;
  }
}

// ── Normalization helpers ─────────────────────────────────────────────

function normalizeVendor(renderer: string): GpuVendor {
  const r = renderer.toLowerCase();
  if (/nvidia|0x10de/i.test(r)) return 'nvidia';
  if (/amd|radeon|advanced micro devices|0x1002/i.test(r)) return 'amd';
  if (/apple|apple silicon|m[1-5]\b/i.test(r)) return 'apple';
  if (/intel|iris|uhd graphics|\barc\b|0x8086/i.test(r)) return 'intel';
  if (/qualcomm|adreno|0x5143/i.test(r)) return 'qualcomm';
  if (/swiftshader|llvmpipe|software|microsoft basic render|mesa/i.test(r)) return 'software';
  return 'unknown';
}

function buildGpuInfo(
  renderer: string,
  vendor: GpuVendor,
  preferredModel?: string
): DetectedGPU {
  return {
    vendor,
    vendorLabel: VENDOR_LABELS[vendor],
    renderer,
    model: extractModel(renderer, vendor, preferredModel),
    isNvidia: vendor === 'nvidia',
  };
}

function extractModel(
  renderer: string,
  vendor: GpuVendor,
  preferred?: string
): string | undefined {
  // WebGPU exposes a clean human-readable description; use it when present.
  if (preferred && preferred.trim().length > 2 && !/^0x[0-9a-f]+$/i.test(preferred.trim())) {
    return preferred.trim();
  }

  if (vendor === 'software') return 'Software Rendering';

  // WebGL renderer strings are comma-separated segments, e.g.:
  //   "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1 Metal - 86.1)"
  //   "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  const vendorRe = VENDOR_SEGMENT_RE[vendor];
  if (!vendorRe) return undefined;

  const segment = renderer
    .split(',')
    .map((s) => s.trim())
    .find((s) => !/angle/i.test(s) && vendorRe.test(s));
  if (!segment) return undefined;

  const cleaned = segment
    .replace(/\b0x[0-9a-fA-F]+\b/g, '')
    .replace(/\s+(?:Direct3D|D3D1|OpenGL|Vulkan|Metal|ampere|ada|hopper|turing|volta|pascal|maxwell|kepler|rdna\d*).*/i, '')
    .trim();
  if (!cleaned) return undefined;

  if (vendor === 'apple') {
    const m = cleaned.match(/Apple\s+M[1-5](?:\s+(?:Pro|Max|Ultra))?/i);
    if (m) return m[0];
  }
  return cleaned;
}

const VENDOR_SEGMENT_RE: Partial<Record<GpuVendor, RegExp>> = {
  nvidia: /nvidia/i,
  amd: /amd|radeon/i,
  intel: /intel/i,
  apple: /apple/i,
  qualcomm: /qualcomm|adreno/i,
};
