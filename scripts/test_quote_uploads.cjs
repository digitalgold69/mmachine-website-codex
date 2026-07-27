const assert = require("node:assert/strict");
const path = require("node:path");

process.env.QUOTE_UPLOAD_SECRET = "test-upload-secret-value";

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, ".."),
  },
  cache: false,
});

const {
  UPLOAD_PART_BYTES,
  abortQuoteUpload,
  completeQuoteUpload,
  startQuoteUpload,
  uploadQuoteFilePart,
} = jiti("../lib/quote-upload-handler.ts");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function byteLength(value) {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value.size;
  if (typeof value === "string") return Buffer.byteLength(value);
  throw new Error("Unsupported mock upload body");
}

function createMockBucket(options = {}) {
  let uploadNumber = 0;
  const uploads = new Map();
  const deleted = [];

  function makeUpload(state) {
    return {
      key: state.key,
      uploadId: state.uploadId,
      async uploadPart(partNumber, value) {
        const size = byteLength(value);
        const etag = `etag-${partNumber}-${size}`;
        state.parts.set(partNumber, { partNumber, etag, size });
        return { partNumber, etag };
      },
      async abort() {
        state.aborted = true;
      },
      async complete(parts) {
        state.completedParts = parts;
        const size = options.forceCompleteSize ?? parts.reduce((sum, part) => {
          const stored = state.parts.get(part.partNumber);
          assert.equal(stored?.etag, part.etag);
          return sum + stored.size;
        }, 0);
        return { size };
      },
    };
  }

  const bucket = {
    async createMultipartUpload(key, uploadOptions) {
      const state = {
        key,
        uploadId: `upload-${++uploadNumber}`,
        uploadOptions,
        parts: new Map(),
        aborted: false,
        completedParts: null,
      };
      uploads.set(`${key}:${state.uploadId}`, state);
      return makeUpload(state);
    },
    resumeMultipartUpload(key, uploadId) {
      const state = uploads.get(`${key}:${uploadId}`);
      if (!state) throw new Error("Unknown upload session");
      return makeUpload(state);
    },
    async delete(key) {
      deleted.push(key);
    },
  };

  return {
    bucket,
    deleted,
    latestUpload() {
      return Array.from(uploads.values()).at(-1);
    },
  };
}

async function rejectsClient(promise, message) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.name, "QuoteUploadClientError");
    if (message) assert.equal(error.message, message);
    return error;
  }
  assert.fail("Expected QuoteUploadClientError");
}

test("validates exact signed upload part sizes", async () => {
  const mock = createMockBucket();
  const { token } = await startQuoteUpload({
    action: "start",
    name: "drawing.dxf",
    size: UPLOAD_PART_BYTES + 3,
    type: "application/dxf",
  }, mock.bucket);

  await rejectsClient(
    uploadQuoteFilePart(token, 1, new ArrayBuffer(UPLOAD_PART_BYTES - 1), mock.bucket),
    "Invalid file part."
  );

  const first = await uploadQuoteFilePart(token, 1, new ArrayBuffer(UPLOAD_PART_BYTES), mock.bucket);
  const second = await uploadQuoteFilePart(token, 2, new ArrayBuffer(3), mock.bucket);

  assert.deepEqual(first, { partNumber: 1, etag: `etag-1-${UPLOAD_PART_BYTES}` });
  assert.deepEqual(second, { partNumber: 2, etag: "etag-2-3" });
});

test("rejects invalid upload tokens", async () => {
  const mock = createMockBucket();

  await rejectsClient(
    uploadQuoteFilePart("not-a-token", 1, new ArrayBuffer(1), mock.bucket),
    "Invalid upload session."
  );
  await rejectsClient(
    completeQuoteUpload({ action: "complete", token: "not-a-token", parts: [] }, mock.bucket),
    "Invalid upload session."
  );
});

test("completes a multipart upload and returns a completed file token", async () => {
  const mock = createMockBucket();
  const { token } = await startQuoteUpload({
    action: "start",
    name: "..\\unsafe*name.txt",
    size: 5,
    type: "text/plain",
  }, mock.bucket);
  const part = await uploadQuoteFilePart(token, 1, new ArrayBuffer(5), mock.bucket);

  const result = await completeQuoteUpload({ action: "complete", token, parts: [part] }, mock.bucket);

  assert.equal(result.file.name, "unsafe-name.txt");
  assert.equal(result.file.size, 5);
  assert.equal(result.file.type, "text/plain");
  assert.equal(result.file.extension, "txt");
  assert.match(result.file.key, /^quote-uploads\/[^/]+\/[^/]+-unsafe-name\.txt$/);
  assert.match(result.file.token, /^[^.]+\.[^.]+$/);
});

test("rejects incomplete completion payloads", async () => {
  const mock = createMockBucket();
  const { token } = await startQuoteUpload({
    action: "start",
    name: "drawing.pdf",
    size: 5,
    type: "application/pdf",
  }, mock.bucket);
  await uploadQuoteFilePart(token, 1, new ArrayBuffer(5), mock.bucket);

  await rejectsClient(
    completeQuoteUpload({ action: "complete", token, parts: [] }, mock.bucket),
    "The uploaded file is incomplete."
  );
});

test("aborts an upload session", async () => {
  const mock = createMockBucket();
  const { token } = await startQuoteUpload({
    action: "start",
    name: "drawing.step",
    size: 9,
    type: "model/step",
  }, mock.bucket);

  assert.deepEqual(await abortQuoteUpload({ action: "abort", token }, mock.bucket), { ok: true });
  assert.equal(mock.latestUpload().aborted, true);
});

(async () => {
  for (const item of tests) {
    await item.fn();
    console.log(`ok - ${item.name}`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
