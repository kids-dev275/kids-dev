"use client";

import React from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormField, FieldLabel, FieldError, Input, Textarea } from "@/components/ui/form";
import type { CheckoutFormData } from "@/lib/checkout-validation";

export interface CheckoutCustomerFormProps {
  register: UseFormRegister<CheckoutFormData>;
  errors: FieldErrors<CheckoutFormData>;
  onFieldChange?: () => void;
  disabled?: boolean;
}

export function CheckoutCustomerForm({
  register,
  errors,
  onFieldChange,
  disabled = false,
}: CheckoutCustomerFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onFieldChange?.();
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-border">
        <h2 className="font-editorial text-2xl text-ink font-normal tracking-tight">
          Delivery Details
        </h2>
        <p className="font-sans text-xs text-text-muted mt-1">
          Please enter the shipping address for your order.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name (Required) */}
        <div className="sm:col-span-2">
          <FormField isRequired isInvalid={Boolean(errors.fullName)}>
            <FieldLabel>Full Name</FieldLabel>
            <Input
              type="text"
              autoComplete="name"
              placeholder="e.g. Ayesha Khan"
              disabled={disabled}
              {...register("fullName", { onChange: handleChange })}
            />
            <FieldError>{errors.fullName?.message}</FieldError>
          </FormField>
        </div>

        {/* Phone (Required) */}
        <div>
          <FormField isRequired isInvalid={Boolean(errors.phone)}>
            <FieldLabel>Phone Number</FieldLabel>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="e.g. 03001234567"
              disabled={disabled}
              {...register("phone", { onChange: handleChange })}
            />
            <FieldError>{errors.phone?.message}</FieldError>
          </FormField>
        </div>

        {/* Email (Optional) */}
        <div>
          <FormField isInvalid={Boolean(errors.email)}>
            <FieldLabel>Email (Optional)</FieldLabel>
            <Input
              type="email"
              autoComplete="email"
              placeholder="e.g. ayesha@example.com"
              disabled={disabled}
              {...register("email", { onChange: handleChange })}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </FormField>
        </div>

        {/* Address (Required) */}
        <div className="sm:col-span-2">
          <FormField isRequired isInvalid={Boolean(errors.address)}>
            <FieldLabel>Street Address</FieldLabel>
            <Textarea
              rows={3}
              autoComplete="street-address"
              placeholder="House/Apartment #, Street, Block/Sector, Area"
              disabled={disabled}
              {...register("address", { onChange: handleChange })}
            />
            <FieldError>{errors.address?.message}</FieldError>
          </FormField>
        </div>

        {/* City (Required) */}
        <div>
          <FormField isRequired isInvalid={Boolean(errors.city)}>
            <FieldLabel>City</FieldLabel>
            <Input
              type="text"
              autoComplete="address-level2"
              placeholder="e.g. Lahore, Karachi, Islamabad"
              disabled={disabled}
              {...register("city", { onChange: handleChange })}
            />
            <FieldError>{errors.city?.message}</FieldError>
          </FormField>
        </div>

        {/* Province (Required) */}
        <div>
          <FormField isRequired isInvalid={Boolean(errors.province)}>
            <FieldLabel>Province</FieldLabel>
            <Input
              type="text"
              autoComplete="address-level1"
              placeholder="e.g. Punjab, Sindh, KPK"
              disabled={disabled}
              {...register("province", { onChange: handleChange })}
            />
            <FieldError>{errors.province?.message}</FieldError>
          </FormField>
        </div>

        {/* Postal Code (Optional) */}
        <div className="sm:col-span-2">
          <FormField isInvalid={Boolean(errors.postalCode)}>
            <FieldLabel>Postal Code (Optional)</FieldLabel>
            <Input
              type="text"
              autoComplete="postal-code"
              placeholder="e.g. 54000"
              disabled={disabled}
              {...register("postalCode", { onChange: handleChange })}
            />
            <FieldError>{errors.postalCode?.message}</FieldError>
          </FormField>
        </div>

        {/* Order Notes (Optional) */}
        <div className="sm:col-span-2">
          <FormField isInvalid={Boolean(errors.orderNotes)}>
            <FieldLabel>Order Notes (Optional)</FieldLabel>
            <Textarea
              rows={2}
              placeholder="Special delivery instructions or gate code..."
              disabled={disabled}
              {...register("orderNotes", { onChange: handleChange })}
            />
            <FieldError>{errors.orderNotes?.message}</FieldError>
          </FormField>
        </div>
      </div>
    </div>
  );
}
