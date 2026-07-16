// Client-side media handling for complaint uploads (F15).
// Physical categories only — must match the server's PHYSICAL_CATEGORIES.
export const PHYSICAL_CATEGORIES = new Set(["plumbing", "electrical", "cleaning"]);

export const VIDEO_MAX_SECONDS = 15;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_MAX_DIM = 1600;
const IMAGE_QUALITY = 0.8;

export interface SelectedMedia {
  blob: Blob;
  type: "image" | "video";
  filename: string;
  previewUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

/** Downscale to ≤1600px and re-encode as JPEG (~1MB) before upload. */
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > IMAGE_MAX_DIM) {
    const scale = IMAGE_MAX_DIM / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/jpeg",
      IMAGE_QUALITY
    )
  );
}

/** Read a video's duration (seconds) from the selected file. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(v.src);
      resolve(d);
    };
    v.onerror = () => reject(new Error("Could not read the video"));
    v.src = URL.createObjectURL(file);
  });
}

/**
 * Validate + prepare a selected file. Throws a friendly Error on rejection.
 * Images are compressed; videos are checked for duration/size (no re-encode).
 */
export async function prepareMedia(file: File): Promise<SelectedMedia> {
  if (file.type.startsWith("image/")) {
    const blob = await compressImage(file);
    return {
      blob,
      type: "image",
      filename: "photo.jpg",
      previewUrl: URL.createObjectURL(blob),
    };
  }
  if (file.type.startsWith("video/")) {
    if (file.size > VIDEO_MAX_BYTES) {
      throw new Error("That video is over 25 MB — please pick a shorter one.");
    }
    const duration = await readVideoDuration(file);
    if (duration > VIDEO_MAX_SECONDS + 0.5) {
      throw new Error(`Keep it under ${VIDEO_MAX_SECONDS} seconds (that clip is ${Math.round(duration)}s).`);
    }
    return {
      blob: file,
      type: "video",
      filename: file.name || "clip.mp4",
      previewUrl: URL.createObjectURL(file),
    };
  }
  throw new Error("Please choose a photo or a video.");
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
}

/** Upload directly to Cloudinary with progress; returns the public_id. */
export function uploadToCloudinary(
  media: SelectedMedia,
  sig: UploadSignature,
  onProgress: (pct: number) => void
): Promise<{ publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", media.blob, media.filename);
    fd.append("api_key", sig.apiKey);
    fd.append("timestamp", String(sig.timestamp));
    fd.append("folder", sig.folder);
    fd.append("signature", sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${media.type}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const r = JSON.parse(xhr.responseText);
        resolve({ publicId: r.public_id, secureUrl: r.secure_url });
      } else {
        reject(new Error("Upload failed — you can submit without the photo."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — you can submit without the photo."));
    xhr.send(fd);
  });
}
