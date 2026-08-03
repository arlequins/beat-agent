import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  createMemoryJsonObjectStore,
  createS3JsonObjectStore,
  ObjectAlreadyExistsError,
  ObjectConflictError,
} from "./s3-json-store";

describe("memory JSON object store", () => {
  it("creates, conditionally replaces, lists, and deletes records", async () => {
    const store = createMemoryJsonObjectStore();
    const created = await store.create("events/1.json", { value: 1 });
    await expect(store.create("events/1.json", {})).rejects.toBeInstanceOf(
      ObjectAlreadyExistsError,
    );
    await expect(
      store.replace("events/1.json", { value: 2 }, '"wrong"'),
    ).rejects.toBeInstanceOf(ObjectConflictError);
    const replaced = await store.replace(
      "events/1.json",
      { value: 2 },
      created.etag ?? "",
    );
    expect(await store.list<{ value: number }>("events/")).toEqual([
      { key: "events/1.json", value: { value: 2 } },
    ]);
    await store.delete("events/1.json", replaced.etag);
    expect(await store.get("events/1.json")).toBeUndefined();
  });
});

describe("S3 JSON object store", () => {
  it("rejects unsafe bucket and object names", async () => {
    expect(() => createS3JsonObjectStore({ bucket: "" })).toThrow("required");
    const store = createS3JsonObjectStore({
      bucket: "beat-data",
      client: { send: vi.fn() } as never,
    });
    await expect(store.create("../escape", {})).rejects.toThrow("safe path");
  });

  it("uses conditional S3 requests and scopes keys to the configured prefix", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ETag: '"1"', VersionId: "v1" })
      .mockResolvedValueOnce({
        Body: { transformToString: async () => '{"ok":true}' },
        ETag: '"1"',
        VersionId: "v1",
      })
      .mockResolvedValueOnce({ ETag: '"2"', VersionId: "v2" })
      .mockResolvedValueOnce({});
    const store = createS3JsonObjectStore({
      bucket: "beat-data",
      client: { send } as never,
      prefix: "/production/",
    });
    await store.create("events/1.json", { ok: true });
    await store.get("events/1.json");
    await store.replace("events/1.json", { ok: false }, '"1"');
    await store.delete("events/1.json", '"2"');

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: "beat-data",
      IfNoneMatch: "*",
      Key: "production/events/1.json",
    });
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[2]?.[0].input).toMatchObject({ IfMatch: '"1"' });
    expect(send.mock.calls[3]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("paginates list results and reads each listed object", async () => {
    let listPage = 0;
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        listPage += 1;
        return listPage === 1
          ? {
              Contents: [{ Key: "prod/events/1.json" }],
              IsTruncated: true,
              NextContinuationToken: "next",
            }
          : { Contents: [{ Key: "prod/events/2.json" }] };
      }
      if (command instanceof GetObjectCommand)
        return {
          Body: {
            transformToString: async () =>
              command.input.Key?.endsWith("1.json")
                ? '{"id":"1"}'
                : '{"id":"2"}',
          },
          ETag: '"1"',
        };
      throw new Error("unexpected command");
    });
    const store = createS3JsonObjectStore({
      bucket: "beat-data",
      client: { send } as never,
      prefix: "prod",
    });
    await expect(store.list<{ id: string }>("events/")).resolves.toEqual([
      { key: "events/1.json", value: { id: "1" } },
      { key: "events/2.json", value: { id: "2" } },
    ]);
    const firstCommand = send.mock.calls[0]?.[0];
    expect(firstCommand).toBeInstanceOf(ListObjectsV2Command);
    expect((firstCommand as ListObjectsV2Command).input.Prefix).toBe(
      "prod/events/",
    );
  });

  it("maps S3 not-found and precondition failures to stable contracts", async () => {
    const notFound = Object.assign(new Error("missing"), {
      $metadata: { httpStatusCode: 404 },
    });
    const conflict = Object.assign(new Error("conflict"), {
      $metadata: { httpStatusCode: 412 },
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce(notFound)
      .mockRejectedValue(conflict);
    const store = createS3JsonObjectStore({
      bucket: "beat-data",
      client: { send } as never,
    });
    await expect(store.get("missing.json")).resolves.toBeUndefined();
    await expect(store.create("exists.json", {})).rejects.toBeInstanceOf(
      ObjectAlreadyExistsError,
    );
    await expect(
      store.replace("changed.json", {}, '"old"'),
    ).rejects.toBeInstanceOf(ObjectConflictError);
    await expect(store.delete("changed.json", '"old"')).rejects.toBeInstanceOf(
      ObjectConflictError,
    );
  });
});
