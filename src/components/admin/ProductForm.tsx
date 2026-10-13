"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SelectField, TextAreaField, TextField } from "@/components/form/TextField";
import { VariantFields } from "./VariantFields";
import { VideoPicker } from "./ImagePicker";
import {
  PRODUCT_BADGES,
  productSchema,
  slugify,
  type ProductFormValues,
} from "@/lib/validation";
import { createProductAction, updateProductAction } from "@/lib/admin/actions";
import { useUIStore } from "@/stores/ui";
import type { Category, Product } from "@/types";

/**
 * One form for adding and for editing, so the two can never drift apart in what
 * they accept. Same zod schema, same field names, same variant structure the
 * database stores.
 */

/** Kept separate so only this line re-renders as you type. */
function SlugPreview({ control }: { control: Control<ProductFormValues> }) {
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

const BLANK_VARIANT = { color: "", colorCode: "", image: "", images: [], stock: 0 };

function defaultsFor(product: Product | undefined, categories: Category[]): ProductFormValues {
  if (!product) {
    return {
      name: "",
      description: "",
      category: categories[0]?.slug ?? "",
      sku: "",
      price: 0,
      compareAtPrice: 0,
      material: "",
      strapType: "",
      badge: "",
      video: "",
      featured: false,
      variants: [BLANK_VARIANT],
    };
  }

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    sku: product.sku,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? 0,
    material: product.material ?? "",
    strapType: product.strapType ?? "",
    badge: (product.badge ?? "") as ProductFormValues["badge"],
    video: product.video ?? "",
    featured: product.featured ?? false,
    // A product created before variants existed has none. Seed the form with
    // its old image and stock as a single unnamed colour, which the admin can
    // then name — rather than inventing a colour on its behalf.
    variants:
      product.variants.length > 0
        ? product.variants.map((variant) => ({
            color: variant.color,
            colorCode: variant.colorCode,
            image: variant.image,
            images: variant.images,
            stock: variant.stock,
          }))
        : [{ ...BLANK_VARIANT, image: product.image, stock: product.stock }],
  };
}

export function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  /** Present when editing. Absent when adding. */
  product?: Product;
}) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const editing = product !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onBlur",
    defaultValues: defaultsFor(product, categories),
  });

  async function onSubmit(values: ProductFormValues) {
    const result = editing
      ? await updateProductAction(product.id, values)
      : await createProductAction(values);

    if (!result.ok) {
      // SKU collisions are only knowable on the server, so the message is
      // attached to the field it belongs to rather than the form as a whole.
      setError(result.message.includes("SKU") ? "sku" : "root", {
        message: result.message,
      });
      return;
    }

    showToast(editing ? "Product saved" : "Product added", result.message);

    if (editing) {
      router.push("/admin/products");
    } else {
      reset(defaultsFor(undefined, categories));
    }
    router.refresh();
  }

  // Flattened for VariantFields, which should not have to know RHF's error shape.
  const variantErrors: Record<
    number,
    { color?: string; colorCode?: string; stock?: string; image?: string }
  > = {};
  errors.variants?.forEach?.((entry, index) => {
    if (!entry) return;
    variantErrors[index] = {
      color: entry.color?.message,
      colorCode: entry.colorCode?.message,
      stock: entry.stock?.message,
      image: entry.image?.message,
    };
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5 rounded-2xl border border-line bg-surface-raised p-5"
    >
      <div>
        <h2 className="font-semibold">{editing ? "Edit product" : "Add a product"}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {editing
            ? "Changes show in the shop as soon as you save."
            : "It appears in the shop as soon as you save."}
        </p>
      </div>

      {errors.root?.message && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errors.root.message}
        </p>
      )}

      {/* Basic information */}
      <div className="space-y-4">
        <div>
          <TextField
            label="Product name"
            placeholder="YSL-Inspired Quilted Hand Bag"
            error={errors.name?.message}
            {...register("name")}
          />
          {!errors.name && <SlugPreview control={control} />}
        </div>

        <TextAreaField
          label="Description"
          placeholder="What it is, what it is made of, why someone would want it."
          error={errors.description?.message}
          {...register("description")}
        />

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
            label="SKU"
            placeholder="SS-BAG-001"
            hint="Your own code. Must be unique."
            error={errors.sku?.message}
            {...register("sku")}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <TextField
          label="Price (PKR)"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="3799"
          error={errors.price?.message}
          {...register("price")}
        />
        <TextField
          label="Compare-at price (optional)"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="4999"
          hint="Shown struck through. Leave 0 for no discount."
          error={errors.compareAtPrice?.message}
          {...register("compareAtPrice")}
        />
      </div>

      {/* Product details */}
      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <TextField
          label="Material (optional)"
          placeholder="Soft quilted faux leather"
          error={errors.material?.message}
          {...register("material")}
        />
        <TextField
          label="Strap type (optional)"
          placeholder="Long detachable shoulder strap"
          error={errors.strapType?.message}
          {...register("strapType")}
        />
      </div>

      {/* Variants */}
      <div className="border-t border-line pt-5">
        <VariantFields control={control} register={register} errors={variantErrors} />
        {typeof errors.variants?.message === "string" && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {errors.variants.message}
          </p>
        )}
      </div>

      {/* Store settings */}
      <div className="space-y-4 border-t border-line pt-5">
        <SelectField label="Badge (optional)" error={errors.badge?.message} {...register("badge")}>
          <option value="">No badge</option>
          {PRODUCT_BADGES.map((badge) => (
            <option key={badge} value={badge}>
              {badge}
            </option>
          ))}
        </SelectField>

        {/*
          Controller rather than register: VideoPicker holds a URL it produces
          itself from an upload, so it needs a value and an onChange rather
          than a ref onto an input.
        */}
        <Controller
          control={control}
          name="video"
          render={({ field, fieldState }) => (
            <VideoPicker
              value={field.value ?? ""}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line-strong accent-brand-600"
            {...register("featured")}
          />
          Show on the homepage as featured
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
      >
        {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add product"}
      </button>
    </form>
  );
}
