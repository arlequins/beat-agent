import { render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Select } from "./select";
import { Textarea } from "./textarea";

describe("application state primitives", () => {
  it("exposes form and feedback semantics", () => {
    render(
      <>
        <Textarea aria-label="Description" />
        <Select aria-label="Status">
          <option>Active</option>
        </Select>
        <Alert>Try again</Alert>
        <Pagination
          onPageChange={() => undefined}
          page={1}
          pageSize={10}
          total={24}
        />
        <EmptyState description="Create one" icon={FileText} title="No items" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Try again");
    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toHaveTextContent("Page 1 of 3");
    expect(screen.getByText("No items")).toBeVisible();
  });
});
