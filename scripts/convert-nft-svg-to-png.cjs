const fs = require("fs")
const path = require("path")
const { Resvg } = require("@resvg/resvg-js")

const projectRoot = path.join(__dirname, "..")
const nftDir = path.join(projectRoot, "public/assets/brand/nft")
const svgs = [
	"scholar-nft-base.svg",
	"scholar-nft-stellar.svg",
	"scholar-nft-soroban.svg",
	"scholar-nft-defi.svg",
]

async function convertSvgs() {
	for (const svgFile of svgs) {
		const svgPath = path.join(nftDir, svgFile)
		const pngFile = svgFile.replace(".svg", ".png")
		const pngPath = path.join(nftDir, pngFile)

		const svgData = fs.readFileSync(svgPath)
		const resvg = new Resvg(svgData, {
			fitTo: {
				mode: "width",
				value: 2000,
			},
		})

		const pngData = resvg.render()
		fs.writeFileSync(pngPath, pngData.asPng())

		console.log(`Created: ${pngFile} (${pngData.width}x${pngData.height})`)
	}
}

convertSvgs().catch(console.error)
