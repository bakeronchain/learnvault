import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Mock @stellar/design-system to avoid CSS import issues
vi.mock("@stellar/design-system", () => ({
	Alert: () => null,
	Button: () => null,
	Heading: () => null,
}))
