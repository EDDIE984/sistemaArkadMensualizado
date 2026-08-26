// Compresión de imágenes en el navegador antes de subir. Reutilizada por la
// captura con cámara (recibe un Blob del canvas) y por el fallback de archivo
// (recibe el File del <input>). Salida siempre JPEG.

export type CompressResult = { blob: Blob; width: number; height: number };

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.85;

function targetSize(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(source: Blob): Promise<{ width: number; height: number; draw: CanvasImageSource; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(source);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: img,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function compressToJpeg(
  source: Blob,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<CompressResult> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  const decoded = await decode(source);
  try {
    const { width, height } = targetSize(decoded.width, decoded.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no soporta el procesamiento de imágenes.");
    ctx.drawImage(decoded.draw, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    return { blob, width, height };
  } finally {
    decoded.release();
  }
}
