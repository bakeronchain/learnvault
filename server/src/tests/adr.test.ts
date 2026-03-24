import fs from "fs"
import path from "path"

describe("ADR files", () => {
  it("should have all 7 ADR files", () => {
    const adrDir = path.join(__dirname, "../../../docs/adr")
    const files = fs.readdirSync(adrDir)

    const expected = [
      "ADR-001.md",
      "ADR-002.md",
      "ADR-003.md",
      "ADR-004.md",
      "ADR-005.md",
      "ADR-006.md",
      "ADR-007.md",
    ]

    expected.forEach(file => {
      expect(files).toContain(file)
    })
  })
})
