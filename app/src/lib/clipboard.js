// Copy text; returns false if the clipboard is unavailable or the browser refuses.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Download a text file (marketing materials, exports). Returns false if the browser refuses.
export const downloadText = (fileName, text, type = "text/plain") => downloadBlob(fileName, new Blob([text], { type }));

// Download a Blob (exports, share images). The URL is revoked after the download has started.
export function downloadBlob(fileName, blob) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
