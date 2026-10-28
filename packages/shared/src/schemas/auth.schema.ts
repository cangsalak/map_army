import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('กรุณาระบุอีเมลที่ถูกต้อง (Invalid email format)'),
  password: z.string().min(6, 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'),
});

export const RegisterUserSchema = z.object({
  email: z.string().email('กรุณาระบุอีเมลที่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'),
  fullName: z.string().min(2, 'กรุณาระบุชื่อ-นามสกุล'),
  role: z.enum(['admin', 'project_manager', 'analyst', 'viewer']).default('viewer'),
  organizationId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
