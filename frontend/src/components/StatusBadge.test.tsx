import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the Open status", () => {
    render(<StatusBadge status="Open" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders the Paid status", () => {
    render(<StatusBadge status="Paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders the Disputed status", () => {
    render(<StatusBadge status="Disputed" />);
    expect(screen.getByText("Disputed")).toBeInTheDocument();
  });
});
