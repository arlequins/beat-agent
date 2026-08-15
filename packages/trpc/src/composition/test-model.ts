import type { ModelProviderPort } from "@arlequins/agent-core";

/**
 * Deterministic model used only by the local/CI E2E profile.
 *
 * It deliberately lives behind an explicit test-stage flag so production can
 * never select it accidentally or incur model costs through a test shortcut.
 */
export const TEST_MODEL_ID = "deterministic-test-model";

export function createDeterministicTestModelProvider(): ModelProviderPort {
  return {
    capabilities: { toolUse: false },
    async *streamText({ messages }) {
      const question = [...messages]
        .reverse()
        .find((message) => message.role === "user")?.content;
      const evidence = messages
        .find((message) => message.role === "system")
        ?.content.match(/\[source:[^\]]+\]\s+([^\n]+)/)?.[1];
      yield `테스트 응답: ${question ?? "질문 없음"}`;
      if (evidence) yield `\n근거: ${evidence}`;
    },
  };
}
