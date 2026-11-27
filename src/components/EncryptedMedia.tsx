import { useEffect, useState } from "react";
import { FileText, Download, Lock } from "lucide-react";
import type { ChatMessage } from "../services/chatService";
import { decryptMediaToBlobUrl, formatFileSize } from "../services/storageService";

type EncryptedMediaProps = {
  item: ChatMessage;
  onImageClick: (url: string) => void;
};

export function EncryptedMedia({ item, onImageClick }: EncryptedMediaProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    item.mediaKey && item.mediaIv ? null : item.mediaUrl ?? null
  );
  const [decryptError, setDecryptError] = useState(false);

  useEffect(() => {
    if (!item.mediaUrl) return;

    // Unencrypted legacy message fallback
    if (!item.mediaKey || !item.mediaIv) {
      setResolvedUrl(item.mediaUrl);
      return;
    }

    let isCancelled = false;
    let createdBlobUrl: string | null = null;

    decryptMediaToBlobUrl(
      item.mediaUrl,
      item.mediaKey,
      item.mediaIv,
      item.mimeType
    )
      .then((blobUrl) => {
        if (isCancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        createdBlobUrl = blobUrl;
        setResolvedUrl(blobUrl);
        setDecryptError(false);
      })
      .catch((err) => {
        console.error("Failed to decrypt media:", err);
        if (!isCancelled) {
          setDecryptError(true);
        }
      });

    return () => {
      isCancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [item.mediaUrl, item.mediaKey, item.mediaIv, item.mimeType]);

  if (!item.mediaUrl) return null;

  if (decryptError) {
    return (
      <div className="mb-1.5 flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
        <Lock size={14} className="shrink-0" />
        <span>Failed to decrypt attachment</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="mb-1.5 flex items-center gap-2 rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-xs text-[#667781] dark:text-[#aebac1]">
        <Lock size={14} className="shrink-0 animate-pulse text-[#00a884]" />
        <span>Decrypting {item.fileName || "media"}...</span>
      </div>
    );
  }

  if (item.mediaType === "image") {
    return (
      <button
        type="button"
        onClick={() => onImageClick(resolvedUrl)}
        className="mb-1.5 block cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0"
      >
        <img
          src={resolvedUrl}
          alt={item.fileName || "Image"}
          className="max-h-64 w-auto max-w-full rounded-md object-cover"
        />
      </button>
    );
  }

  if (item.mediaType === "video") {
    return (
      <video
        src={resolvedUrl}
        controls
        className="mb-1.5 max-h-64 w-full max-w-[320px] rounded-md bg-black"
      />
    );
  }

  if (item.mediaType === "audio") {
    return (
      <audio
        src={resolvedUrl}
        controls
        className="mb-1 h-10 w-[260px] max-w-full"
      />
    );
  }

  return (
    <a
      href={resolvedUrl}
      download={item.fileName || "attachment"}
      className="mb-1.5 flex items-center gap-2.5 rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-inherit no-underline hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
    >
      <FileText size={22} className="shrink-0 text-[#00a884]" />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs font-medium text-[#111b21] dark:text-[#e9edef]">
          {item.fileName || "Attachment"}
        </p>
        {item.fileSize !== undefined && (
          <p className="m-0 text-[10px] text-[#667781] dark:text-[#aebac1]">
            {formatFileSize(item.fileSize)}
          </p>
        )}
      </div>
      <Download size={16} className="shrink-0 text-[#54656f] dark:text-[#aebac1]" />
    </a>
  );
}
