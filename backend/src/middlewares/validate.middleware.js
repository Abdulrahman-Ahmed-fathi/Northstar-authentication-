
import { ApiError } from "../utils/ApiError.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new ApiError(400, "Validation failed", details)
      );
    }

    // Use the validated and transformed data.
    req.body = result.data;

    return next();
  };
}
