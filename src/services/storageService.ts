import axios from "axios";

export type MediaType = "image" | "video" | "file";

export type MediaAttachment = {
  mediaUrl: string;
  mediaType: MediaType;
  fileName: string;
  fileSize: number;
  mediaKey: string;
  mediaIv: string;
  mimeType: string;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function detectMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMediaPreviewLabel(media: MediaAttachment): string {
  if (media.mediaType === "image") return "📷 Photo";
  if (media.mediaType === "video") return "🎥 Video";
  return `📎 ${media.fileName}`;
}

// ── Base64 helpers ─────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── AES-256-GCM Encrypt & Decrypt ──────────────────────────────────

async function encryptFile(file: File): Promise<{
  encryptedBlob: Blob;
  mediaKey: string;
  mediaIv: string;
}> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBuffer = await file.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBuffer
  );

  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedBlob: new Blob([encryptedBuffer], {
      type: "application/octet-stream",
    }),
    mediaKey: arrayBufferToBase64(rawKey),
    mediaIv: arrayBufferToBase64(iv),
  };
}

export async function decryptMediaToBlobUrl(
  mediaUrl: string,
  mediaKey: string,
  mediaIv: string,
  mimeType?: string
): Promise<string> {
  const response = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: "arraybuffer",
  });

  const rawKeyBytes = base64ToUint8Array(mediaKey);
  const ivBytes = base64ToUint8Array(mediaIv);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    cryptoKey,
    response.data
  );

  const decryptedBlob = new Blob([decryptedBuffer], {
    type: mimeType || "application/octet-stream",
  });

  return URL.createObjectURL(decryptedBlob);
}

// ── Upload Encrypted File to Cloudinary ────────────────────────────

export async function uploadChatMedia(
  chatId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<MediaAttachment> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary is not configured. Check VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env."
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size cannot exceed 10 MB.");
  }

  // Encrypt file client-side before upload
  const { encryptedBlob, mediaKey, mediaIv } = await encryptFile(file);

  const formData = new FormData();
  formData.append("file", encryptedBlob, `${Date.now()}_encrypted.txt`);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `whatsapp_chat_media/${chatId}`);

  // Upload as 'raw' so Cloudinary stores encrypted bytes untouched
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

  let response: { data: { secure_url: string } };
  try {
    response = await axios.post<{ secure_url: string }>(
      uploadUrl,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            onProgress(percent);
          }
        },
      }
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const cloudinaryMessage = (
        err.response?.data as { error?: { message?: string } } | undefined
      )?.error?.message;
      if (cloudinaryMessage) {
        throw new Error(`Cloudinary upload failed: ${cloudinaryMessage}`);
      }
    }
    throw err;
  }

  return {
    mediaUrl: response.data.secure_url,
    mediaType: detectMediaType(file.type),
    fileName: file.name,
    fileSize: file.size,
    mediaKey,
    mediaIv,
    mimeType: file.type || "application/octet-stream",
  };
}
