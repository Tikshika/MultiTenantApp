const MAX_SOURCE_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const WEBP_QUALITY = 0.8;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function optimizeImageForUpload(file: File, maxOutputSize: number): Promise<File> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size === 0 || file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error("Source images must be 25 MB or smaller.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image optimization is not supported by this browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const webp = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not optimize this image in your browser."));
        },
        "image/webp",
        WEBP_QUALITY,
      );
    });
    if (webp.type !== "image/webp") {
      throw new Error("This browser cannot encode WebP images. Try a recent browser.");
    }

    const optimizedFile =
      webp.size < file.size
        ? new File([webp], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
            type: "image/webp",
            lastModified: file.lastModified,
          })
        : file;

    if (optimizedFile.size > maxOutputSize) {
      const maxOutputMegabytes = Math.floor(maxOutputSize / (1024 * 1024));
      throw new Error(`Image is still too large after optimization. Choose a smaller image (max ${maxOutputMegabytes} MB).`);
    }

    return optimizedFile;
  } finally {
    bitmap.close();
  }
}
