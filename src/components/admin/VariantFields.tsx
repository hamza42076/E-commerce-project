"use client";

import { Controller, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { TextField } from "@/components/form/TextField";
import { ExtraImagesPicker, MainImagePicker } from "./ImagePicker";
import type { ProductFormValues } from "@/lib/validation";

/**
 * The colours a product comes in. Any number of them — one bag might be in two
 * colours, another in ten — so this is a field array rather than a fixed set of
 * inputs.
 *
 * Each colour carries its own stock and its own photography, because that is
 * what the rest of the app reads: the swatch, the gallery, the stock line, the
 * cart line and the order snapshot all come from one of these.
 */

const EMPTY_VARIANT = { color: "", colorCode: "", image: "", images: [], stock: 0 };

export function VariantFields({
  control,
  register,
  errors,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  /** Per-variant messages, including the duplicate-colour one from the schema. */
  errors: Record<number, { color?: string; colorCode?: string; stock?: string; image?: string }>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Available colours</h3>
        <p className="mt-0.5 text-xs text-muted">
          Each colour has its own stock and its own images. The customer picks one
          of these on the product page.
        </p>
      </div>

      {fields.map((field, index) => (
        <fieldset
          key={field.id}
          // min-w-0: a fieldset's default min-inline-size is min-content, so
          // without this it refuses to shrink below the widest thing inside and
          // pushes the whole page sideways on a phone.
          className="min-w-0 rounded-xl border border-line bg-surface p-3.5"
        >
          <legend className="flex w-full items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium">Colour {index + 1}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              className="text-xs text-muted transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-rose-400"
            >
              Remove
            </button>
          </legend>

          {/* Colour name gets its own row; code and stock share the next one.
              Three across never fitted — on a phone there is no room, and on a
              desktop this form sits in a 26rem sidebar, which is narrower than
              the viewport breakpoints assume. */}
          <div className="mt-2 space-y-3">
            <TextField
              label="Colour name"
              placeholder="Beige"
              error={errors[index]?.color}
              {...register(`variants.${index}.color`)}
            />

            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-sm font-medium">Colour code</span>
                <Controller
                  control={control}
                  name={`variants.${index}.colorCode`}
                  render={({ field: code }) => (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={code.value || "#cccccc"}
                        onChange={(event) => code.onChange(event.target.value)}
                        aria-label={`Pick colour ${index + 1}`}
                        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                      />
                      <input
                        type="text"
                        value={code.value}
                        onChange={(event) => code.onChange(event.target.value)}
                        placeholder="#D8C3A5"
                        aria-label={`Colour ${index + 1} hex code`}
                        className="w-full min-w-0 rounded-xl border border-line bg-surface px-2.5 py-2.5 font-mono text-xs outline-none transition focus:border-brand-500"
                      />
                    </div>
                  )}
                />
                {errors[index]?.colorCode && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                    {errors[index]?.colorCode}
                  </p>
                )}
              </div>

              <div className="w-20 shrink-0">
                <TextField
                  label="Stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  error={errors[index]?.stock}
                  {...register(`variants.${index}.stock`)}
                />
              </div>
            </div>
          </div>

          {/* Stacked rather than side by side: each picker holds a 64px
              thumbnail plus a URL field, which does not fit two-up in this
              sidebar. */}
          <div className="mt-3 space-y-3">
            <Controller
              control={control}
              name={`variants.${index}.image`}
              render={({ field: image }) => (
                <MainImagePicker
                  value={image.value ?? ""}
                  onChange={image.onChange}
                  error={errors[index]?.image}
                />
              )}
            />

            <Controller
              control={control}
              name={`variants.${index}.images`}
              render={({ field: images }) => (
                <ExtraImagesPicker
                  value={(images.value ?? []).filter(
                    (url): url is string => typeof url === "string",
                  )}
                  onChange={images.onChange}
                />
              )}
            />
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => append(EMPTY_VARIANT)}
        className="w-full rounded-xl border border-dashed border-line-strong px-4 py-2.5 text-sm font-medium text-muted transition hover:border-brand-400 hover:text-brand-600"
      >
        + Add another colour
      </button>
    </div>
  );
}
