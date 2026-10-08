import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeEditor } from "./CodeEditor";
import { SOROBAN_EXERCISES } from "./exercises";

describe("Soroban In-Browser Playground (Issue #1063)", () => {
  const sampleExercise = SOROBAN_EXERCISES[0];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders exercise details and honest guided check disclaimer", () => {
    render(<CodeEditor exercise={sampleExercise} />);

    expect(screen.getByText(sampleExercise.title)).toBeDefined();
    expect(screen.getByText(sampleExercise.description)).toBeDefined();
    expect(
      screen.getByText(/guided structural check against expected Soroban patterns/i)
    ).toBeDefined();
  });

  it("renders read-only scaffold blocks", () => {
    render(<CodeEditor exercise={sampleExercise} />);
    expect(screen.getByText(/Read-only Contract Scaffold/i)).toBeDefined();
    expect(screen.getByText(/#\!\[no_std\]/i)).toBeDefined();
  });

  it("allows editing in the workspace textarea", () => {
    render(<CodeEditor exercise={sampleExercise} />);
    const textarea = screen.getByRole("textbox", {
      name: new RegExp(sampleExercise.title, "i"),
    }) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "let modified = true;" } });
    expect(textarea.value).toBe("let modified = true;");
  });

  it("resets code back to starterCode upon clicking reset button", () => {
    render(<CodeEditor exercise={sampleExercise} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "junk input" } });
    expect(textarea.value).toBe("junk input");

    const resetBtn = screen.getByText(/Reset Starter/i);
    fireEvent.click(resetBtn);
    expect(textarea.value).toBe(sampleExercise.starterCode);
  });

  it("reveals hints sequentially on demand", () => {
    render(<CodeEditor exercise={sampleExercise} />);

    expect(screen.queryByText(/Hints:/i)).toBeNull();

    const hintBtn = screen.getByText(/Show Hint/i);
    fireEvent.click(hintBtn);

    expect(screen.getByText(/Hints:/i)).toBeDefined();
    expect(screen.getByText(new RegExp(sampleExercise.hints[0], "i"))).toBeDefined();
  });

  it("fails validation and outputs specific failure messages for incomplete code", () => {
    render(<CodeEditor exercise={sampleExercise} />);

    const checkBtn = screen.getByText(/Check My Solution/i);
    fireEvent.click(checkBtn);

    // Initial starter code should fail the vector and symbol rules
    expect(screen.getByText(/Construct the returned vector using/i)).toBeDefined();
    expect(screen.getByText(/Must include symbol_short!\("Hello"\)/i)).toBeDefined();
  });

  it("passes validation on correct solution and triggers onComplete callback", () => {
    const onComplete = vi.fn();
    render(<CodeEditor exercise={sampleExercise} onComplete={onComplete} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: sampleExercise.solution } });

    const checkBtn = screen.getByText(/Check My Solution/i);
    fireEvent.click(checkBtn);

    expect(
      screen.getByText(/Great work! Your code matches what this exercise expects/i)
    ).toBeDefined();
    expect(onComplete).toHaveBeenCalledWith(sampleExercise.id);
  });

  it("persists in-progress code to localStorage", () => {
    const { unmount } = render(<CodeEditor exercise={sampleExercise} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "persisted user code" } });
    unmount();

    // Re-mount component and verify value is restored
    render(<CodeEditor exercise={sampleExercise} />);
    const restoredTextarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(restoredTextarea.value).toBe("persisted user code");
  });
});
