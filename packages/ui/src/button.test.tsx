import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("supports accessible interaction", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>Save changes</Button>);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prevents interaction when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={onClick}>
        Save changes
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
