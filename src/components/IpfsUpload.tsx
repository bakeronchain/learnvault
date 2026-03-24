import { useRef, useState } from "react"
import { getIpfsUrl } from "../lib/ipfs"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IpfsUploadResult {
  cid: string
  gatewayUrl: string
}

export interface IpfsUploadProps {
  /** JWT token for the Authorization header. */
  token: string
  /** Called when the file is successfully pinned. */
  onSuccess: (result: IpfsUploadResult) => void
  /** Optional: restrict which MIME types the file-picker shows. */
  accept?: string
  /** Optional label shown on the upload button. */
  label?: string
  /** Optional: show a preview after upload (images only). */
  showPreview?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api"

const ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.mp4"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IpfsUpload({
  token,
  onSuccess,
  accept = ALLOWED_EXTENSIONS,
  label = "Upload file",
  showPreview = false,
}: IpfsUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IpfsUploadResult | null>(null)

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side size guard (10 MB) — mirrors the server limit.
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10 MB limit.")
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(body.error ?? `Upload failed (${response.status})`)
      }

      const data = (await response.json()) as IpfsUploadResult
      setResult(data)
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setIsUploading(false)
      // Reset so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const isImage =
    result !== null &&
    /\.(png|jpe?g|gif|webp)$/i.test(
      result.gatewayUrl.split("?")[0] ?? "",
    )

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
      >
        {isUploading ? (
          <>
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              role="status"
              aria-label="Uploading"
            />
            Uploading…
          </>
        ) : (
          label
        )}
      </button>

      {/* Error */}
      {error !== null && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Success */}
      {result !== null && (
        <div className="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-800">
          <p className="break-all font-mono text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              CID:{" "}
            </span>
            {result.cid}
          </p>
          <a
            href={getIpfsUrl(result.cid)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline dark:text-blue-400"
          >
            View on IPFS gateway
          </a>

          {/* Optional image preview */}
          {showPreview && isImage && (
            <img
              src={result.gatewayUrl}
              alt="Uploaded file preview"
              className="mt-2 max-h-48 rounded object-contain"
            />
          )}
        </div>
      )}
    </div>
  )
}
