import type {
  ContentListInput,
  ContentPage,
  ContentRecord,
} from "../../domain/content";

export type ContentRepository = {
  create(input: { content: string; title: string }): Promise<ContentRecord>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<ContentRecord | undefined>;
  list(input: Required<ContentListInput>): Promise<ContentPage>;
  update(
    id: string,
    input: { content: string; title: string },
    expectedVersion: number,
  ): Promise<
    | { status: "conflict" }
    | { status: "not-found" }
    | { status: "updated"; value: ContentRecord }
  >;
};
