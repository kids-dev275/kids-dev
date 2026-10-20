"use client";

import React, { useState, useEffect } from "react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { AccountShell } from "@/components/account/account-shell";
import { updateCustomerProfile, getCustomerCsrf } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel, FieldError, FieldHint } from "@/components/ui/form";
import { Input } from "@/components/ui/form/input";
import { Alert, LoadingSpinner, SuccessMessage } from "@/components/ui/feedback";

export default function AccountProfilePage() {
  const { customer, refreshCustomer, setCustomerDirect } = useCustomerAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [errors, setErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const syncForm = async () => {
      await Promise.resolve();
      if (!isMounted || !customer) return;
      setFullName(customer.fullName || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
    };
    void syncForm();
    return () => {
      isMounted = false;
    };
  }, [customer]);

  const validate = () => {
    const errs: { fullName?: string; email?: string; phone?: string } = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      errs.fullName = "Full name is required";
    } else if (trimmedName.length < 2) {
      errs.fullName = "Full name must be at least 2 characters";
    } else if (trimmedName.length > 100) {
      errs.fullName = "Full name must not exceed 100 characters";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 7) {
        errs.phone = "Phone number must be at least 7 characters";
      } else if (trimmedPhone.length > 20) {
        errs.phone = "Phone number must not exceed 20 characters";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Obtain CSRF token
      const csrfRes = await getCustomerCsrf();
      const csrfToken = csrfRes.success ? csrfRes.data.csrfToken : undefined;

      const res = await updateCustomerProfile(
        {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() ? phone.trim() : null,
        },
        csrfToken
      );

      if (res.success) {
        setCustomerDirect(res.data.customer);
        setSuccessMessage("Your profile information has been successfully updated.");
      } else {
        const errorMsg =
          res.error.code === "EMAIL_ALREADY_EXISTS"
            ? "This email address is already in use by another account."
            : res.error.message || "Failed to update profile. Please try again.";
        setServerError(errorMsg);
      }
    } catch {
      setServerError("A network error occurred while updating your profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccountShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal">
            Profile Settings
          </h2>
          <p className="text-xs sm:text-sm text-text-muted font-sans mt-1">
            Update your account details and contact preferences.
          </p>
        </div>

        {successMessage && (
          <Alert variant="success" title="Profile Updated">
            {successMessage}
          </Alert>
        )}

        {serverError && (
          <Alert variant="error" title="Update Failed">
            {serverError}
          </Alert>
        )}

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <FormField isInvalid={!!errors.fullName} isRequired>
              <FieldLabel>Full Name</FieldLabel>
              <Input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                disabled={isSubmitting}
              />
              {errors.fullName && <FieldError>{errors.fullName}</FieldError>}
            </FormField>

            <FormField isInvalid={!!errors.email} isRequired>
              <FieldLabel>Email Address</FieldLabel>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={isSubmitting}
              />
              <FieldHint>Account sign-in email and order notifications recipient.</FieldHint>
              {errors.email && <FieldError>{errors.email}</FieldError>}
            </FormField>

            <FormField isInvalid={!!errors.phone}>
              <FieldLabel>Phone Number</FieldLabel>
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="+923001234567 or 03001234567"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                disabled={isSubmitting}
              />
              <FieldHint>
                Optional contact number (7–20 characters) for order updates and delivery.
              </FieldHint>
              {errors.phone && <FieldError>{errors.phone}</FieldError>}
            </FormField>

            <div className="pt-2 flex items-center justify-end">
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AccountShell>
  );
}
