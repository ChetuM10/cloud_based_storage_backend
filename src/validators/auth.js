const { z } = require("zod");

// Registration validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

// Login validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Validate request body against schema
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.parse(req.body);
      req.validatedBody = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors.map((e) => e.message).join(", "),
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
};

module.exports = {
  registerSchema,
  loginSchema,
  validate,
};
