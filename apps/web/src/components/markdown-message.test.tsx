import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownMessage } from "./markdown-message";

describe("MarkdownMessage", () => {
  it("renders emphasis, lists, and fenced code as formatted content", () => {
    render(
      <MarkdownMessage
        content={
          '**리액트**\n\n- 단방향 데이터 흐름\n\n```tsx\nconst app = "Beat";\n```'
        }
      />,
    );

    expect(screen.getByText("리액트").tagName).toBe("STRONG");
    expect(screen.getByText("단방향 데이터 흐름").tagName).toBe("LI");
    expect(screen.getByText('const app = "Beat";').tagName).toBe("CODE");
  });
});
