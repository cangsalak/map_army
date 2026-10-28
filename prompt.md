# GeoMonitor 3D — Global Design System Unification Based on NextAdmin

## 1. เป้าหมายหลัก

ปรับปรุง UI/UX ของ GeoMonitor 3D ให้ทุกหน้าใช้ Theme และ Design System เดียวกัน โดยอ้างอิงรูปแบบจาก:

- Demo: https://demo.nextadmin.co/
- Repository: https://github.com/NextAdminHQ/nextjs-admin-dashboard

ปัญหาปัจจุบันคือแต่ละหน้าใช้ Theme, สี, รูปแบบปุ่ม, การ์ด, ฟอร์ม, ตาราง, Header และองค์ประกอบ UI แตกต่างกัน ทำให้ระบบดูเหมือนประกอบจากหลาย Template

เป้าหมายคือทำให้ทุกหน้าดูเป็นผลิตภัณฑ์เดียวกัน มีรูปแบบสม่ำเสมอ ใช้งานง่าย และดูแลรักษาได้จากจุดศูนย์กลาง

**ข้อกำหนดสำคัญ:** ให้ใช้ NextAdmin เป็น Design Reference และนำแนวทาง Component, Design Tokens, Layout และ Interaction มาใช้กับโค้ดเดิมอย่างเหมาะสม ไม่ใช่สร้างหน้าใหม่ให้เหมือนตัวอย่างเพียงบางหน้า

## 2. ขั้นตอนที่ 1 — Audit ระบบก่อนแก้ไข

ก่อนเปลี่ยนโค้ด ให้ตรวจสอบ:

1. Framework และเวอร์ชัน Next.js, React, Tailwind CSS และ UI Libraries ที่ติดตั้งจริง
2. โครงสร้าง App Router และ Layout ทั้งหมด
3. Global CSS, CSS Variables, Tailwind Theme และ Theme Provider
4. Sidebar, Header, Navigation, Breadcrumbs และ Page Container
5. Component ที่แต่ละหน้าใช้สำหรับ Button, Input, Select, Dialog, Card, Table, Tabs และ Badge
6. ระบบ Dark/Light Mode และการเก็บค่าความชอบของผู้ใช้
7. CSS เฉพาะหน้าและ Inline Styles ที่ทำให้ Theme แตกต่างกัน
8. Component ที่ซ้ำซ้อนและมีหน้าตาหรือพฤติกรรมต่างกัน
9. หน้า Login และหน้าที่ไม่ควรใช้ Dashboard Layout
10. หน้า GeoMonitor Map, Cesium Viewer, Mission Planner, Area Management, Surveys, Change Analysis, Import/Export และรายงาน

สร้างตารางตรวจสอบทุก Route โดยระบุ:
- Route และหน้าที่
- Layout ที่ใช้งาน
- Theme และ Component ที่ใช้ในปัจจุบัน
- ปัญหาที่พบ
- Component กลางที่ควรเปลี่ยนไปใช้
- สถานะการดำเนินงาน

ห้ามเริ่มเขียน CSS ทับหลายหน้า ก่อนทราบโครงสร้าง Theme ที่มีอยู่จริง

## 3. ขั้นตอนที่ 2 — สร้าง Global Design System

กำหนด Design Tokens เป็นแหล่งอ้างอิงกลางเพียงชุดเดียว โดยใช้แนวทางจาก NextAdmin

### Color Tokens

กำหนด Semantic Tokens สำหรับ:
- Primary และ Primary Hover
- Background และ Page Background
- Surface และ Card Background
- Text Primary, Secondary และ Muted
- Border และ Divider
- Success, Warning, Error และ Info
- Input Background, Focus Ring และ Disabled State
- Sidebar, Header และ Navigation Active State

ใช้ CSS Variables หรือระบบ Token ที่เหมาะกับ Tailwind Version จริงของโปรเจกต์

ห้ามกำหนด Hex Colors กระจัดกระจายตาม Component โดยไม่จำเป็น และห้ามสร้างชุดสีใหม่เฉพาะหน้าโดยไม่มีเหตุผล

### Typography

กำหนดมาตรฐานกลางสำหรับ:
- Font Family ที่รองรับภาษาไทยและภาษาอังกฤษ
- Page Title และ Section Title
- Heading, Body, Label และ Helper Text
- ตาราง ตัวเลข และข้อความสถานะ
- Line Height, Font Weight และ Text Hierarchy

### Spacing และ Layout

กำหนดมาตรฐานกลางสำหรับ:
- Page Padding
- Section Spacing
- Card Padding
- Grid และ Flex Gap
- Border Radius
- Border Width
- Shadow
- Control Height
- Responsive Breakpoints

### Theme Modes

รองรับ Light Mode และ Dark Mode อย่างครบถ้วน

- ใช้ Token ชุดเดียวกันทั้งสองโหมด
- ทุกหน้าเปลี่ยน Theme ได้พร้อมกัน
- ป้องกัน Flash จาก Theme ที่ไม่ตรงกับค่าที่บันทึกไว้
- ป้องกัน Hydration Mismatch
- หากมี Theme Preference เดิม ให้รักษาและย้ายข้อมูลอย่างปลอดภัย
- กำหนดค่าเริ่มต้นและพฤติกรรมเมื่อผู้ใช้ยังไม่เคยเลือก Theme ให้ชัดเจน

อย่าทำให้ Theme Mode เปลี่ยนเฉพาะ Header หรือเฉพาะหน้าที่กำลังเปิด

## 4. ขั้นตอนที่ 3 — สร้าง Shared UI Components

ตรวจสอบ Component เดิมก่อน หากมี Component ที่เหมาะสมอยู่แล้ว ให้ปรับปรุงและนำกลับมาใช้ซ้ำ แทนการสร้างชุดใหม่ซ้อนกัน

กำหนดมาตรฐานอย่างน้อยดังนี้:

- Button: Primary, Secondary, Outline, Ghost, Danger และ Loading
- Input, Textarea, Select และ Checkbox
- Form Label, Validation Error และ Helper Text
- Card, Card Header, Card Body และ Card Footer
- Table, Pagination, Sorting และ Empty State
- Badge สำหรับสถานะ
- Dialog, Modal, Dropdown และ Tooltip
- Tabs, Breadcrumbs และ Page Header
- Loading Skeleton, Error State และ Empty State
- Toast หรือ Notification
- Search, Filter Bar และ Action Toolbar

ทุก Component ต้องมี:
- API และ Props ที่สอดคล้องกัน
- สีและ Typography จาก Design Tokens
- ขนาดและระยะห่างตามมาตรฐาน
- Hover, Focus, Active, Disabled และ Loading States
- Keyboard Accessibility และ ARIA ตามความเหมาะสม
- Responsive Behavior

ห้ามเปลี่ยนเฉพาะรูปลักษณ์จนทำให้ Event Handler, Form Validation, API Integration หรือ Permission เดิมหยุดทำงาน

## 5. ขั้นตอนที่ 4 — รวม Dashboard Layout

ปรับหน้า Dashboard ทั้งหมดให้ใช้ Shared Layout เดียวกัน

### Sidebar
- ขนาดและระยะห่างสม่ำเสมอ
- รูปแบบ Icon, Label และ Active Item เหมือนกัน
- รองรับ Expanded/Collapsed State
- รองรับ Mobile Navigation
- แสดงเมนูตามสิทธิ์จริงของผู้ใช้
- ไม่สร้างเมนูซ้ำและไม่ทำให้ Route เดิมหายไป

### Header
- รูปแบบความสูง สี และ Border สม่ำเสมอ
- Search และ Notification หากระบบมีอยู่แล้ว
- User Menu และ Logout เชื่อมกับ Authentication จริง
- Theme Toggle ควบคุม Theme กลาง
- Responsive Behavior เหมือนกันทุกหน้า

### Page Container
- ทุกหน้าใช้ Page Header และ Content Container รูปแบบเดียวกัน
- Breadcrumbs สอดคล้องกับ Route จริง
- Card, Table, Filter และ Action Bar ใช้ Spacing เดียวกัน
- หน้า Login หรือ Public Pages ใช้ Layout แยกตามความเหมาะสม

ห้ามสร้าง Dashboard Layout ซ้ำในแต่ละ Route หากสามารถใช้ Shared Layout ได้

## 6. ขั้นตอนที่ 5 — ปรับทุกหน้าให้ใช้มาตรฐานเดียวกัน

ตรวจสอบและปรับทุก Route ที่มีอยู่จริง รวมถึง:

- Dashboard
- Project Management
- Responsibility Areas
- Master Data
- Surveys และ Change Analysis
- GeoMonitor Map / Cesium 3D
- Drone Mission Planner
- Flight Plan Validation
- Import KML/KMZ
- Export และ Reports
- User Management และ Settings
- Login, Error Pages และหน้าที่เกี่ยวข้อง

สำหรับแต่ละหน้า:
1. เปลี่ยน Component ให้ใช้ Shared UI Components
2. ลบ CSS ที่ซ้ำซ้อนเมื่อยืนยันแล้วว่าไม่จำเป็น
3. ใช้ Semantic Design Tokens แทนสีเฉพาะหน้า
4. รักษา Business Logic, API, Database และ Route เดิม
5. ตรวจสอบ Loading, Empty, Error และ Success States
6. ตรวจสอบ Layout ทั้ง Light และ Dark Mode
7. ตรวจสอบ Desktop, Tablet และ Mobile
8. ทดสอบ Interaction ที่มีอยู่จริง

ห้ามหยุดหลังปรับ Dashboard เพียงหน้าเดียว ต้องมีรายการ Route และหลักฐานว่าหน้าอื่นได้รับการตรวจสอบด้วย

## 7. ข้อกำหนดเฉพาะสำหรับ Cesium และแผนที่ 3D

GeoMonitor 3D มีแผนที่ Cesium ซึ่งต้องแยกการจัดการ Style ออกจาก Dashboard Theme อย่างระมัดระวัง

- ห้ามให้ Global CSS ของ Button, Input, SVG, Canvas หรือ Element ทั่วไปทำลาย Cesium Viewer
- จำกัด CSS เฉพาะ Map Components เมื่อจำเป็น
- ตรวจสอบ Overlay, Toolbar, Layer Controls และ Map Popovers ให้ใช้ Design Tokens กลาง
- ป้องกัน z-index และ stacking context ที่ทำให้ Dialog หรือ Dropdown แสดงผิดตำแหน่ง
- รักษา Map Bearing เริ่มต้น -90° หรือ 270° ตามระบบมุมของ Engine
- รักษาพิกัด CRS, Terrain, Ground Geometry, Mission Planner และ Import/Export
- ห้ามแก้ปัญหา Theme ด้วยการเปลี่ยน Map Engine หรือสร้างแผนที่จำลอง

## 8. ขั้นตอนที่ 6 — ตรวจสอบ NextAdmin Repository

ศึกษาจาก Source Code และเอกสารของ NextAdmin เพื่อระบุองค์ประกอบที่นำมาใช้ได้จริง ได้แก่:

- Design Tokens และ Theme Architecture
- Shared Components
- Dashboard Layout
- Forms และ Tables
- Responsive Behavior
- Light/Dark Mode
- Accessibility Patterns

ก่อนนำ Dependency หรือ Component มาใช้ ต้องตรวจสอบ:
- License และเงื่อนไขการใช้งาน
- ความเข้ากันได้กับ Framework และ Dependency ปัจจุบัน
- ความแตกต่างของ API และโครงสร้าง Component
- ผลกระทบต่อ Build, Bundle Size และ Runtime

ห้ามคัดลอกไฟล์ทั้งหมดจาก Repository มาเขียนทับโปรเจกต์ และห้ามอัปเกรด Next.js หรือ Dependency ทั้งชุดโดยไม่จำเป็น

โปรดระบุว่าแต่ละส่วนใช้ Reference, Adapted Component หรือ Dependency ใหม่

## 9. ขั้นตอนที่ 7 — ป้องกัน Theme แตกต่างในอนาคต

จัดทำหรืออัปเดตเอกสารต่อไปนี้:

### `docs/DESIGN_SYSTEM.md`
อธิบาย Tokens, Theme Modes, Typography, Spacing, Components และแนวทางการใช้งาน

### `docs/UI_COMPONENTS.md`
ระบุ Shared Components, ตำแหน่งไฟล์, Props และตัวอย่างการใช้งาน

### `docs/UI_AUDIT.md`
บันทึก Route ทั้งหมด สถานะก่อนปรับปรุง สถานะหลังปรับปรุง และข้อที่ยังไม่ผ่าน

### `AGENTS.md`
เพิ่มกฎที่ AI Coding Agent ต้องปฏิบัติตาม:
- อ่าน Design System ก่อนแก้ UI
- ห้ามสร้างสีหรือ Button Style เฉพาะหน้าโดยไม่จำเป็น
- ต้องใช้ Shared Components ที่มีอยู่ก่อน
- ห้ามสร้าง Theme Provider ซ้ำ
- ต้องตรวจสอบ Light/Dark Mode
- ต้องรักษา API, Business Logic และ Authentication
- ต้องอัปเดต UI Audit หลังเพิ่มหรือแก้ Route
- ห้ามใช้ Mock Data ใน Production

## 10. ขั้นตอนที่ 8 — Verification

รันคำสั่งตาม Scripts ที่มีอยู่จริงในโปรเจกต์:
- TypeScript Type Check
- ESLint
- Production Build
- Automated Tests
- Visual Regression Tests หากมีเครื่องมือรองรับ

ทดสอบ:
1. ทุก Route ที่มีอยู่
2. การเปลี่ยน Light/Dark Mode จากทุกหน้าที่มี Theme Toggle
3. การ Reload หน้าและการจำค่า Theme
4. Login, Logout และ Permission
5. Forms, Tables, Dialogs และ Navigation
6. Map Viewer และ Cesium Toolbar
7. Loading, Empty และ Error States
8. Responsive Layout
9. Browser Console และ Network Errors
10. Regression ของ API และฟังก์ชันเดิม

ห้ามรายงานว่าผ่าน หากยังไม่ได้รันการทดสอบจริง

## 11. ลำดับการทำงาน

Phase 1: Audit Routes, Theme และ Components

Phase 2: สร้าง Design Tokens และ Theme Provider กลาง

Phase 3: ปรับ Shared UI Components

Phase 4: ปรับ Dashboard Layout

Phase 5: ปรับทุก Route ให้ใช้ Theme เดียวกัน

Phase 6: ตรวจ Cesium และหน้าเฉพาะทาง

Phase 7: Regression Tests และจัดทำเอกสาร

เริ่มจาก Phase 1 ก่อน ห้ามเปลี่ยนโค้ดจำนวนมากโดยไม่มี Audit และแผนการแก้ไข

## 12. รายงานส่งมอบ

สรุป:
- จำนวน Route ทั้งหมด
- จำนวน Route ที่ตรวจสอบและปรับปรุงแล้ว
- จำนวน Shared Components ที่นำมาใช้
- รายการ CSS และ Theme ซ้ำซ้อนที่จัดการ
- ไฟล์ที่แก้ไข
- Dependency ใหม่และเหตุผล หากมี
- ผล TypeScript, Lint, Build และ Tests
- Route ที่ยังมี Theme แตกต่าง
- ข้อจำกัดและงานที่ยังไม่เสร็จ

เกณฑ์สำเร็จคือทุก Route ใช้ Design Tokens และ Shared Components กลางอย่างสม่ำเสมอ โดยไม่ทำให้ฟังก์ชันเดิมหรือข้อมูลจริงเสียหาย