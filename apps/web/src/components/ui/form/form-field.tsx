import React, { createContext, useContext, useId } from "react";

interface FormFieldContextValue {
  id: string;
  errorId: string;
  hintId: string;
  isInvalid: boolean;
  isDisabled: boolean;
  isRequired: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function useFormField() {
  return useContext(FormFieldContext);
}

export interface FormFieldProps {
  id?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id: customId,
  isInvalid = false,
  isDisabled = false,
  isRequired = false,
  className = "",
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = customId || `field-${generatedId}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <FormFieldContext.Provider value={{ id, errorId, hintId, isInvalid, isDisabled, isRequired }}>
      <div className={`space-y-1.5 ${className}`.trim()}>{children}</div>
    </FormFieldContext.Provider>
  );
}

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function FieldLabel({ className = "", children, ...rest }: FieldLabelProps) {
  const context = useFormField();
  const id = context?.id;
  const isRequired = context?.isRequired;
  const isDisabled = context?.isDisabled;

  return (
    <label
      htmlFor={id}
      className={`block text-xs font-semibold uppercase tracking-wider font-sans ${
        isDisabled ? "text-text-muted opacity-60 cursor-not-allowed" : "text-text-primary"
      } ${className}`.trim()}
      {...rest}
    >
      {children}
      {isRequired && (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export function FieldError({ className = "", children, ...rest }: FieldErrorProps) {
  const context = useFormField();
  const errorId = context?.errorId;

  if (!children) return null;

  return (
    <p
      id={errorId}
      role="alert"
      className={`text-xs font-sans text-danger font-medium ${className}`.trim()}
      {...rest}
    >
      {children}
    </p>
  );
}

export interface FieldHintProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export function FieldHint({ className = "", children, ...rest }: FieldHintProps) {
  const context = useFormField();
  const hintId = context?.hintId;

  if (!children) return null;

  return (
    <p id={hintId} className={`text-xs font-sans text-text-muted ${className}`.trim()} {...rest}>
      {children}
    </p>
  );
}
