import { z } from "zod";

const textInput = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z.string(),
);

const emailFormatSchema = z.string().email();

const emailSchema = textInput
  .transform((value) => value.trim().toLowerCase())
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({
        code: "custom",
        message: "Email is required.",
      });
      return;
    }

    if (value.length > 254 || !emailFormatSchema.safeParse(value).success) {
      context.addIssue({
        code: "custom",
        message: "Enter a valid email address.",
      });
    }
  });

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const DISALLOWED_PASSWORDS = new Set([
  "11111111",
  "12345678",
  "admin123",
  "aurbit123",
  "letmein1",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "welcome1",
]);

const isWithinPasswordByteLimit = (value: string) =>
  new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES;

const loginPasswordSchema = textInput.superRefine((value, context) => {
  if (!value) {
    context.addIssue({
      code: "custom",
      message: "Password is required.",
    });
    return;
  }

  if (!isWithinPasswordByteLimit(value)) {
    context.addIssue({
      code: "custom",
      message: "Password is too long.",
    });
  }
});

const newPasswordSchema = textInput.superRefine((password, context) => {
  if (!password) {
    context.addIssue({
      code: "custom",
      message: "Password is required.",
    });
    return;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    context.addIssue({
      code: "custom",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }

  if (!isWithinPasswordByteLimit(password)) {
    context.addIssue({
      code: "custom",
      message: "Password is too long.",
    });
  }

  if (DISALLOWED_PASSWORDS.has(password.toLowerCase())) {
    context.addIssue({
      code: "custom",
      message: "Choose a less common password.",
    });
  }
});

const confirmPasswordSchema = textInput.superRefine((value, context) => {
  if (!value) {
    context.addIssue({
      code: "custom",
      message: "Confirm your password.",
    });
  }
});

const matchingPasswordsSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (confirmPassword && password !== confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });

const personNameSchema = textInput
  .transform((value) => value.trim())
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({
        code: "custom",
        message: "Name is required.",
      });
      return;
    }

    if (value.length < 2) {
      context.addIssue({
        code: "custom",
        message: "Name must be at least 2 characters.",
      });
    }

    if (value.length > 100) {
      context.addIssue({
        code: "custom",
        message: "Name must be 100 characters or fewer.",
      });
    }
  });

function resourceNameSchema(label: "Organization" | "Project") {
  return textInput
    .transform((value) => value.trim())
    .superRefine((value, context) => {
      if (!value) {
        context.addIssue({
          code: "custom",
          message: `${label} name is required.`,
        });
        return;
      }

      if (value.length < 2) {
        context.addIssue({
          code: "custom",
          message: `${label} name must be at least 2 characters.`,
        });
      }

      if (value.length > 100) {
        context.addIssue({
          code: "custom",
          message: `${label} name must be 100 characters or fewer.`,
        });
      }
    });
}

const tokenSchema = textInput
  .transform((value) => value.trim())
  .refine((value) => value.length >= 32, "Invalid token.");

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const signupSchema = z
  .object({
    name: personNameSchema,
    email: emailSchema,
  })
  .and(matchingPasswordsSchema);

export const emailSchemaInput = z.object({ email: emailSchema });

export const resetPasswordSchema = matchingPasswordsSchema.and(
  z.object({ token: tokenSchema }),
);

export const verificationTokenSchema = z.object({
  token: tokenSchema,
});

export const organizationSchema = z.object({
  name: resourceNameSchema("Organization"),
});

export const projectSchema = z.object({
  name: resourceNameSchema("Project"),
});

export const resourceIdSchema = textInput
  .transform((value) => value.trim())
  .refine((value) => value.length >= 1 && value.length <= 100);

export function safeRedirectPath(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}
