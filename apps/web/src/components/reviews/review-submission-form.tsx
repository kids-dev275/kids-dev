"use client";

import React, { useState, useEffect, useRef } from "react";
import { Star, Upload, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel, FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/form/input";
import { Textarea } from "@/components/ui/form/textarea";
import { signReviewMedia, submitReview } from "@/lib/api";

export interface ReviewProductOption {
  id: string;
  name: string;
  slug: string;
  storefrontSlug: string;
}

export interface ReviewSubmissionFormProps {
  products: ReviewProductOption[];
  preselectedProductId?: string;
  preselectedProductName?: string;
  className?: string;
}

interface SelectedFile {
  file: File;
  previewUrl: string;
}

export function ReviewSubmissionForm({
  products,
  preselectedProductId,
  preselectedProductName,
  className = "",
}: ReviewSubmissionFormProps) {
  const [name, setName] = useState("");
  const [productId, setProductId] = useState(preselectedProductId || "");
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const previewUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const validFiles: File[] = [];

    for (const f of filesArray) {
      if (!allowedTypes.includes(f.type)) {
        setErrorMessage("Only JPEG, PNG, and WebP images are allowed.");
        return;
      }
      validFiles.push(f);
    }

    if (selectedFiles.length + validFiles.length > 3) {
      setErrorMessage("Maximum of 3 images allowed.");
      return;
    }

    setErrorMessage(null);
    const newSelected: SelectedFile[] = validFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { file, previewUrl };
    });

    setSelectedFiles((prev) => [...prev, ...newSelected]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedText = reviewText.trim();

    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
      errors.name = "Name must be between 2 and 100 characters.";
    }

    if (!productId) {
      errors.productId = "Please select a product.";
    }

    if (!rating || rating < 1 || rating > 5) {
      errors.rating = "Rating must be between 1 and 5 stars.";
    }

    if (!trimmedText || trimmedText.length < 10 || trimmedText.length > 2000) {
      errors.reviewText = "Review text must be between 10 and 2000 characters.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImages: Array<{ publicId: string }> | undefined = undefined;
      let reviewSubmissionId: string | null = null;

      if (selectedFiles.length > 0) {
        reviewSubmissionId = crypto.randomUUID();
        const uploadedPublicIds: Array<{ publicId: string }> = [];

        for (const item of selectedFiles) {
          // 1. Get signed Cloudinary params
          const signRes = await signReviewMedia(reviewSubmissionId);
          if (!signRes.success) {
            const msg =
              "error" in signRes ? signRes.error.message : "Failed to prepare secure image upload";
            throw new Error(msg);
          }

          const signData = signRes.data;

          // 2. Direct upload to Cloudinary
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("api_key", signData.apiKey);
          formData.append("timestamp", String(signData.timestamp));
          formData.append("signature", signData.signature);
          formData.append("folder", signData.folder);
          formData.append("public_id", signData.publicId);

          const uploadRes = await fetch(
            `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadRes.ok) {
            throw new Error("Failed to upload review image to Cloudinary.");
          }

          const uploadJson = await uploadRes.json();
          uploadedPublicIds.push({ publicId: uploadJson.public_id || signData.publicId });
        }

        uploadedImages = uploadedPublicIds;
      }

      // 3. Submit review to backend
      const res = await submitReview({
        name: name.trim(),
        productId,
        rating,
        reviewText: reviewText.trim(),
        reviewSubmissionId,
        images: uploadedImages,
      });

      if (!res.success) {
        const msg = "error" in res ? res.error.message : "Failed to submit review.";
        setErrorMessage(msg);
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccessMessage("Your review has been submitted for approval.");
      setName("");
      setReviewText("");
      selectedFiles.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      });
      setSelectedFiles([]);
      if (!preselectedProductId) {
        setProductId("");
      }
      setRating(5);
      setClientErrors({});
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-subtle ${className}`}
      data-testid="review-submission-form-container"
    >
      <div className="mb-6">
        <h2 className="font-editorial text-2xl text-ink font-normal">Write a Review</h2>
        <p className="font-sans text-xs sm:text-sm text-text-muted mt-1">
          Share your experience with our collection. Reviews are moderated prior to publication.
        </p>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3"
          data-testid="review-success-message"
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" aria-hidden="true" />
          <h3 className="font-editorial text-lg text-emerald-900 font-medium">
            Thank You for Your Feedback!
          </h3>
          <p className="font-sans text-sm text-emerald-800 max-w-md mx-auto leading-relaxed">
            {successMessage}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="mt-2"
          >
            Submit Another Review
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5" data-testid="review-form">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-sans text-rose-800 flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Reviewer Name */}
          <FormField isInvalid={!!clientErrors.name} isRequired>
            <FieldLabel htmlFor="review-name">Your Name</FieldLabel>
            <Input
              id="review-name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (clientErrors.name) setClientErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g. Fatima Ali"
              disabled={isSubmitting}
            />
            {clientErrors.name && <FieldError>{clientErrors.name}</FieldError>}
          </FormField>

          {/* PDP reviews are bound to the current product; the community page retains its picker. */}
          {preselectedProductId ? (
            <div className="rounded-md border border-border bg-surface-soft px-3.5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Product</p>
              <p className="mt-1 text-sm font-medium text-ink">{preselectedProductName}</p>
            </div>
          ) : (
            <FormField isInvalid={!!clientErrors.productId} isRequired>
              <FieldLabel htmlFor="review-product">Product</FieldLabel>
              <select
                id="review-product"
                required
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  if (clientErrors.productId) setClientErrors((prev) => ({ ...prev, productId: "" }));
                }}
                disabled={isSubmitting}
                aria-invalid={!!clientErrors.productId || undefined}
                aria-describedby={clientErrors.productId ? "review-product-error" : undefined}
                className={`w-full rounded-md border bg-surface px-3 py-2.5 text-sm font-sans text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-accent-storefront ${
                  clientErrors.productId ? "border-rose-500" : "border-border"
                }`}
              >
                <option value="">-- Choose a Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {clientErrors.productId && <FieldError id="review-product-error">{clientErrors.productId}</FieldError>}
            </FormField>
          )}

          {/* Star Rating Group */}
          <fieldset className="space-y-1.5" aria-describedby={clientErrors.rating ? "review-rating-error" : undefined}>
            <legend className="block font-sans text-xs font-semibold uppercase tracking-wider text-text-base">
              Rating *
            </legend>
            <div
              className="flex items-center gap-2 pt-1"
              role="radiogroup"
              aria-label="Rating selection from 1 to 5 stars"
            >
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isSelected = rating === starVal;
                return (
                  <label
                    key={starVal}
                    className="cursor-pointer p-1 rounded-md hover:bg-surface-soft transition-colors flex items-center justify-center focus-within:ring-2 focus-within:ring-accent-storefront"
                  >
                    <input
                      type="radio"
                      name="review-rating"
                      value={starVal}
                      checked={isSelected}
                      onChange={() => setRating(starVal)}
                      disabled={isSubmitting}
                      className="sr-only"
                    />
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        starVal <= rating
                          ? "fill-current text-amber-400"
                          : "text-border fill-transparent"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {starVal} star{starVal > 1 ? "s" : ""}
                    </span>
                  </label>
                );
              })}
              <span className="font-sans text-xs text-text-muted ml-2 font-medium">
                {rating} / 5 Stars
              </span>
            </div>
            {clientErrors.rating && (
              <p id="review-rating-error" role="alert" className="font-sans text-xs text-rose-600">{clientErrors.rating}</p>
            )}
          </fieldset>

          {/* Review Text */}
          <FormField isInvalid={!!clientErrors.reviewText} isRequired>
            <FieldLabel htmlFor="review-text">Review Text</FieldLabel>
            <Textarea
              id="review-text"
              required
              rows={4}
              value={reviewText}
              onChange={(e) => {
                setReviewText(e.target.value);
                if (clientErrors.reviewText)
                  setClientErrors((prev) => ({ ...prev, reviewText: "" }));
              }}
              placeholder="Share details about fit, quality, or style..."
              disabled={isSubmitting}
            />
            {clientErrors.reviewText && <FieldError>{clientErrors.reviewText}</FieldError>}
          </FormField>

          {/* Image Upload (Optional, max 3) */}
          <div className="space-y-2">
            <label className="block font-sans text-xs font-semibold uppercase tracking-wider text-text-base">
              Photos (Optional, Maximum 3)
            </label>
            <p className="font-sans text-xs text-text-muted">
              Add JPEG, PNG, or WebP images of the product.
            </p>

            {selectedFiles.length < 3 && (
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-surface-soft hover:bg-surface text-xs font-sans font-medium text-ink cursor-pointer transition-colors shadow-subtle focus-within:ring-2 focus-within:ring-accent-storefront">
                  <Upload className="h-4 w-4 text-accent-storefront" aria-hidden="true" />
                  <span>Choose Images</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                    className="sr-only"
                    data-testid="review-image-input"
                  />
                </label>
                <span className="font-sans text-xs text-text-muted">
                  {selectedFiles.length} of 3 selected
                </span>
              </div>
            )}

            {/* Thumbnail previews */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {selectedFiles.map((sf, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-border group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sf.previewUrl}
                      alt={`Preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 h-5 w-5 bg-ink/75 hover:bg-ink text-white rounded-full flex items-center justify-center transition-opacity"
                      aria-label={`Remove photo ${idx + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
              data-testid="submit-review-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Submitting Review...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
