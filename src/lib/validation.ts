import { z } from "zod";

// =====================================================
// COMMON VALIDATION PATTERNS
// =====================================================

export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s\-+().]*$/, { message: "Invalid phone number format" })
  .max(20, { message: "Phone number must be less than 20 characters" })
  .optional()
  .or(z.literal(""));

export const requiredStringSchema = z
  .string()
  .trim()
  .min(1, { message: "This field is required" })
  .max(500, { message: "Must be less than 500 characters" });

export const optionalStringSchema = z
  .string()
  .trim()
  .max(500, { message: "Must be less than 500 characters" })
  .optional()
  .or(z.literal(""));

export const positiveNumberSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .positive({ message: "Must be a positive number" });

export const nonNegativeNumberSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .min(0, { message: "Cannot be negative" });

export const priceSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .min(0, { message: "Price cannot be negative" })
  .max(999999999, { message: "Price is too large" });

// =====================================================
// INVENTORY ITEM VALIDATION
// =====================================================

export const inventoryItemSchema = z.object({
  partNumber: z.string().trim().min(1, "Part number is required").max(100, "Part number must be less than 100 characters"),
  serialNumber: z.string().trim().max(100, "Serial number must be less than 100 characters").optional().or(z.literal("")),
  description: z.string().trim().min(1, "Description is required").max(1000, "Description must be less than 1000 characters"),
  salePrice: priceSchema,
  cost: priceSchema,
  weight: nonNegativeNumberSchema.optional(),
  volume: nonNegativeNumberSchema.optional(),
  warranty: z.string().trim().max(100, "Warranty must be less than 100 characters").optional().or(z.literal("")),
  minReorderLevel: z.number().int().min(0).optional(),
  maxReorderLevel: z.number().int().min(0).optional(),
  shelfLocation: z.string().trim().max(100, "Shelf location must be less than 100 characters").optional().or(z.literal("")),
}).refine(
  (data) => {
    if (data.minReorderLevel !== undefined && data.maxReorderLevel !== undefined) {
      return data.minReorderLevel <= data.maxReorderLevel;
    }
    return true;
  },
  { message: "Minimum reorder level cannot exceed maximum", path: ["minReorderLevel"] }
);

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// =====================================================
// CONTACT / PERSON VALIDATION
// =====================================================

export const personSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100, "Job title must be less than 100 characters").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  companyId: z.string().uuid().optional().or(z.literal("")),
  branchId: z.string().uuid().optional().or(z.literal("")),
});

export type PersonInput = z.infer<typeof personSchema>;

// =====================================================
// COMPANY VALIDATION
// =====================================================

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200, "Company name must be less than 200 characters"),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
});

export type CompanyInput = z.infer<typeof companySchema>;

// =====================================================
// INVOICE VALIDATION
// =====================================================

export const invoiceSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(200, "Customer name must be less than 200 characters"),
  customerEmail: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  customerPhone: z.string().trim().max(20).optional().or(z.literal("")),
  customerAddress: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  shipToName: z.string().trim().max(200, "Ship to name must be less than 200 characters").optional().or(z.literal("")),
  shipToAddress: z.string().trim().max(500, "Ship to address must be less than 500 characters").optional().or(z.literal("")),
  salesmanName: z.string().trim().max(100, "Salesman name must be less than 100 characters").optional().or(z.literal("")),
  discount: nonNegativeNumberSchema.optional(),
  shippingCost: nonNegativeNumberSchema.optional(),
  items: z.array(z.object({
    itemId: z.string(),
    partNumber: z.string(),
    serialNumber: z.string().optional(),
    description: z.string(),
    price: priceSchema,
  })).min(1, { message: "At least one item is required" }),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

// =====================================================
// EXPENSE VALIDATION
// =====================================================

export const expenseSchema = z.object({
  employeeName: z.string().trim().min(1, "Employee name is required").max(100, "Employee name must be less than 100 characters"),
  amount: positiveNumberSchema,
  category: z.string().trim().min(1, "Category is required").max(100, "Category must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional().or(z.literal("")),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format" }),
  creditCardLast4: z
    .string()
    .regex(/^\d{4}$/, { message: "Must be 4 digits" })
    .optional()
    .or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

// =====================================================
// QUOTE VALIDATION
// =====================================================

export const quoteSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(200, "Customer name must be less than 200 characters"),
  customerEmail: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  customerPhone: z.string().trim().max(20).optional().or(z.literal("")),
  customerAddress: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  shipToName: z.string().trim().max(200, "Ship to name must be less than 200 characters").optional().or(z.literal("")),
  shipToAddress: z.string().trim().max(500, "Ship to address must be less than 500 characters").optional().or(z.literal("")),
  salesmanName: z.string().trim().max(100, "Salesman name must be less than 100 characters").optional().or(z.literal("")),
  discount: nonNegativeNumberSchema.optional(),
  shippingCost: nonNegativeNumberSchema.optional(),
  items: z.array(z.object({
    itemId: z.string(),
    partNumber: z.string(),
    serialNumber: z.string().optional(),
    description: z.string(),
    price: priceSchema,
  })).min(1, { message: "At least one item is required" }),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates data and returns parsed result or error messages
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });

  return { success: false, errors };
}

/**
 * Sanitizes a string for safe display (removes potential XSS)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes a string for use in URLs
 */
export function sanitizeForUrl(input: string): string {
  return encodeURIComponent(input.trim());
}

/**
 * Validates and cleans numeric input
 */
export function parseNumericInput(input: string, defaultValue = 0): number {
  const cleaned = input.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}
