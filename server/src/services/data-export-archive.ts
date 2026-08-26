import { gzipSync } from "node:zlib"

const TAR_BLOCK_SIZE = 512

function writeTarString(
	header: Buffer,
	offset: number,
	length: number,
	value: string,
): void {
	header.write(value.slice(0, length), offset, length, "utf8")
}

function writeTarOctal(
	header: Buffer,
	offset: number,
	length: number,
	value: number,
): void {
	const encoded = value.toString(8).padStart(length - 1, "0")
	writeTarString(header, offset, length, `${encoded}\0`)
}

function createHeader(name: string, size: number, modifiedAt: Date): Buffer {
	const header = Buffer.alloc(TAR_BLOCK_SIZE)
	writeTarString(header, 0, 100, name)
	writeTarOctal(header, 100, 8, 0o644)
	writeTarOctal(header, 108, 8, 0)
	writeTarOctal(header, 116, 8, 0)
	writeTarOctal(header, 124, 12, size)
	writeTarOctal(header, 136, 12, Math.floor(modifiedAt.getTime() / 1000))
	header.fill(0x20, 148, 156)
	header[156] = "0".charCodeAt(0)
	writeTarString(header, 257, 6, "ustar\0")
	writeTarString(header, 263, 2, "00")

	let checksum = 0
	for (const byte of header) checksum += byte
	writeTarString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `)
	return header
}

/** Creates a deterministic gzip-compressed POSIX tar archive. */
export function createTarGzip(
	files: ReadonlyArray<{ name: string; contents: string }>,
	modifiedAt: Date,
): Buffer {
	const chunks: Buffer[] = []
	for (const file of files) {
		const contents = Buffer.from(file.contents, "utf8")
		chunks.push(createHeader(file.name, contents.length, modifiedAt), contents)
		const padding =
			(TAR_BLOCK_SIZE - (contents.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE
		if (padding > 0) chunks.push(Buffer.alloc(padding))
	}
	chunks.push(Buffer.alloc(TAR_BLOCK_SIZE * 2))
	return gzipSync(Buffer.concat(chunks))
}
