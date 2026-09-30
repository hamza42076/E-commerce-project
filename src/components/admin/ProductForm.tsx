"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SelectField, TextAreaField, TextField } from "@/components/form/TextField";
import { productSchema, slugify, type ProductValues } from "@/lib/validation";
import { createProductAction } from "@/lib/admin/actions";
import { uploadProductImageAction } from "@/lib/admin/upload";
import { useUI } from "@/context/UIContext";
import type { Category } from "@/types";

/**
 * Kept separate so only this line re-renders as you type. React Compiler skips
 * memoizing any component that subscribes to a form value, and that cost should
 * fall on one <p>, not the whole form.
 */
function SlugPreview({ control }: { control: Control<ProductValues> }) {
  const name = useWatch({ control, name: "name" });

  return (
    <p className="mt-1.5 text-xs text-muted">
      {name ? (
        <>
          URL: <span className="font-mono">/products/{slugify(name)}</span>
        </>
      ) : (
        "The URL is built from the name."
      )}
    </p>
  );
}

export function ProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { showToast } = useUI();

  // The preview is tracked locally rather than with watch(), so the form keeps
  // its React Compiler optimisation. Both inputs that can set an image also
  // update this.
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Bumping this remounts the file input, which is how its selected filename is
  // cleared — no ref needed, so nothing reads a ref during render.
  const [fileKey, setFileKey] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      compareAtPrice: 0,
      category: categories[0]?.slug ?? "",
      image: "",
      stock: 0,
      featured: false,
    },
  });

  function clearImage() {
    setValue("image", "", { shouldValidate: true });
    setPreview("");
    setUploadError(null);
    setFileKey((key) => key + 1);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    const body = new FormData();
    body.append("file", file);
    const result = await uploadProductImageAction(body);

    setUploading(false);

    if (!result.ok) {
      setUploadError(result.message);
      setFileKey((key) => key + 1);
      return;
    }

    setValue("image", result.url, { shouldValidate: true });
    setPreview(result.url);
    showToast("Image uploaded");
  }

  async function onSubmit(values: ProductValues) {
    const result = await createProductAction(values);

    if (!result.ok) {
      setError("root", { message: result.message });
      return;
    }

    showToast("Product added", result.message);
    reset();
    clearImage();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 rounded-2xl border border-line bg-surface-raised p-5"
    >
      <div>
        <h2 className="font-semibold">Add a product</h2>
        <p className="mt-0.5 text-sm text-muted">
          It appears in the shop as soon as you save.
        </p>
      </div>

      {errors.root?.message && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errors.root.message}
        </p>
      )}

      <div>
        <TextField
          label="Product name"
          placeholder="Wireless Earbuds Pro"
          error={errors.name?.message}
          {...register("name")}
        />
        {!errors.name && <SlugPreview control={control} />}
      </div>

      <TextAreaField
        label="Description"
        placeholder="What it is, what is in the box, why someone would want it."
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Price (PKR)"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="4999"
          error={errors.price?.message}
          {...register("price")}
        />
        <TextField
          label="Compare-at price (optional)"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="6999"
          hint="Shown struck through. Leave 0 for no discount."
          error={errors.compareAtPrice?.message}
          {...register("compareAtPrice")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Category"
          error={errors.category?.message}
          {...register("category")}
        >
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Stock"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="25"
          error={errors.stock?.message}
          {...register("stock")}
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Product image (optional)</span>

        {preview.startsWith("http") || preview.startsWith("/uploads/") ? (
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            {/* A local /uploads path, so next/image would need no optimisation here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Selected product image"
              className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted">{preview}</p>
              <button
                type="button"
                onClick={clearImage}
                className="mt-1.5 text-xs text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
              >
                Remove image
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-7 text-center transition hover:border-brand-400 hover:bg-surface-sunken ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-subtle" aria-hidden="true">
              <path
                d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-medium">
              {uploading ? "Uploading..." : "Choose an image"}
            </span>
            <span className="text-xs text-muted">JPG, PNG or WebP · up to 5 MB</span>
            <input
              key={fileKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        )}

        {uploadError && (
          <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
        )}

        <div className="mt-3">
        <TextField
          label="…or paste an image URL"
          type="url"
          placeholder="https://example.com/photo.jpg"
          hint="Leave both blank to use the generated category tile."
          error={errors.image?.message}
          {...register("image", {
            onChange: (event) => setPreview(event.target.value),
          })}
        />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line-strong accent-brand-600"
          {...register("featured")}
        />
        Show on the homepage as featured
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
      >
        {isSubmitting ? "Saving..." : "Add product"}
      </button>
    </form>
  );
}
