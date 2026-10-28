import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isZod = err instanceof ZodError || err.name === 'ZodError' || (err as any).issues !== undefined;
  const statusCode = err.statusCode || (isZod ? 400 : 500);
  
  if (isZod) {
    const issues = (err as any).issues || (err as any).errors || [];
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด (Validation Failed)',
        details: issues.map((e: any) => ({
          path: Array.isArray(e.path) ? e.path.join('.') : e.path,
          message: e.message,
        })),
      },
    });
  }


  console.error(`[API Error] ${req.method} ${req.url}:`, err);

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
