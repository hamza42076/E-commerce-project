import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, isCloudinaryConfigured, uploadToCloudinary, uploadVideoToCloudinary, mkdir, writeFile } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    isCloudinaryConfigured: vi.fn(),
    uploadToCloudinary: vi.fn(),
    uploadVideoToCloudinary: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ getSession }));
vi.mock("./cloudinary", () => ({
  isCloudinaryConfigured,
  uploadToCloudinary,
  uploadVideoToCloudinary,
}));
vi.mock("node:fs/promises", () => ({ mkdir, writeFile }));

import { uploadProductImageAction, uploadProductVideoAction } from "./upload";

function formWithFile(file: File): FormData {
  const form = new FormData();
  form.set("file", file);
  return form;
}

const validImage = () =>
  formWithFile(new File([new Uint8Array([0xff, 0xd8, 0xff, ...Array(9).fill(0)])], "image.jpg"));

const validVideo = () =>
  formWithFile(
    new File([new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, ...Array(4).fill(0)])], "video.mp4"),
  );

describe("admin product uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    getSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    isCloudinaryConfigured.mockReturnValue(false);
  });

  it("rejects unauthorized image and video uploads before processing files", async () => {
    getSession.mockResolvedValue(null);

    await expect(uploadProductImageAction(validImage())).resolves.toMatchObject({ ok: false });
    await expect(uploadProductVideoAction(validVideo())).resolves.toMatchObject({ ok: false });
    expect(isCloudinaryConfigured).not.toHaveBeenCalled();
  });

  it("rejects invalid image signatures and oversized images", async () => {
    await expect(
      uploadProductImageAction(formWithFile(new File(["not an image"], "image.jpg"))),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("Only JPG") });

    await expect(
      uploadProductImageAction(
        formWithFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg")),
      ),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("over 5 MB") });
  });

  it("rejects missing persistent storage configuration in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(uploadProductImageAction(validImage())).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("persistent storage"),
    });
    await expect(uploadProductVideoAction(validVideo())).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("persistent storage"),
    });
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("uses Cloudinary when configured and propagates its failure result", async () => {
    isCloudinaryConfigured.mockReturnValue(true);
    uploadToCloudinary.mockResolvedValue({ ok: false, message: "Image upload failed." });
    uploadVideoToCloudinary.mockResolvedValue({ ok: false, message: "Video upload failed." });

    await expect(uploadProductImageAction(validImage())).resolves.toEqual({
      ok: false,
      message: "Image upload failed.",
    });
    await expect(uploadProductVideoAction(validVideo())).resolves.toEqual({
      ok: false,
      message: "Video upload failed.",
    });
    expect(mkdir).not.toHaveBeenCalled();
  });
});
