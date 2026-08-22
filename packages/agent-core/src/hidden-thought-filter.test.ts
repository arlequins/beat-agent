import { describe, expect, it } from "vitest";
import { createHiddenThoughtFilter } from "./hidden-thought-filter";

describe("createHiddenThoughtFilter", () => {
  it("removes hidden reasoning and keeps the final answer", () => {
    const filter = createHiddenThoughtFilter();

    const output = [
      filter.push("<thinking>내부 계획"),
      filter.push("과정</thinking>안녕하세요, Arlequin님."),
      filter.flush(),
    ].join("");

    expect(output).toBe("안녕하세요, Arlequin님.");
  });

  it("handles tags split across streamed chunks", () => {
    const filter = createHiddenThoughtFilter();

    const output = [
      filter.push("답변 <thin"),
      filter.push("king>숨김</think"),
      filter.push("ing> 계속 답변"),
      filter.flush(),
    ].join("");

    expect(output).toBe("답변  계속 답변");
  });

  it("does not emit an unterminated hidden section", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("<analysis>비공개")).toBe("");
    expect(filter.flush()).toBe("");
  });

  it("waits for a split tag terminator before entering hidden mode", () => {
    const filter = createHiddenThoughtFilter();

    expect(filter.push("<analysis ")).toBe("");
    expect(filter.push(">비공개</analysis>완료")).toBe("완료");
  });
});
