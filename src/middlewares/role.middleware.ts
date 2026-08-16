import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

export function authorize(...allowedRoles: Array<"CREATOR" | "EVENTEE">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of roles: ${allowedRoles.join(", ")}`));
    }
    next();
  };
}
