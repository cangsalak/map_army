# GeoMonitor 3D — Shared UI Components Reference

> **Baseline**: NextAdmin Component Architecture  
> **Source Directory**: `apps/web/src/components/ui/` & `apps/web/src/components/layout/`  
> **Status**: Production Ready  
> **Last Updated**: October 2026

---

## 1. Component Catalog Index

| Component | File Location | Key Purpose | Variants / States |
| :--- | :--- | :--- | :--- |
| `Button` | `components/ui/primitives.tsx` | Universal action trigger | `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`, `cyan`, `surface`; sizes `sm`, `md`, `lg`; `isLoading` |
| `Badge` | `components/ui/primitives.tsx` | Status and category tags | `default`, `success`, `warning`, `danger`, `info`, `cyan`, `outline` |
| `Card` | `components/ui/primitives.tsx` | Content container | Includes `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `FormField` | `components/ui/primitives.tsx` | Form input wrapper | Label, Required indicator, Helper text, Error text |
| `Input` | `components/ui/primitives.tsx` | Text/Number input | Normal, Focus ring, Disabled, Error ring |
| `Textarea` | `components/ui/primitives.tsx` | Multiline text input | Normal, Focus ring, Disabled, Error ring |
| `Select` | `components/ui/primitives.tsx` | Native styled dropdown | Normal, Focus ring, Disabled, Error ring |
| `Table` | `components/ui/primitives.tsx` | Tabular data display | `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableEmpty` |
| `Modal` | `components/ui/primitives.tsx` | Dialog/Pop-up modal | Backdrop blur, Escape key handling, Close icon, Custom footer |
| `Tabs` | `components/ui/primitives.tsx` | Horizontal tab bar | NextAdmin pill style with active indicator |
| `Breadcrumbs` | `components/ui/primitives.tsx` | Hierarchical route trail | Clickable parent crumbs, active child crumb |
| `ThemeToggle` | `components/ui/ThemeToggle.tsx` | Dual-mode switcher | Light/Dark smooth toggle with icon rotation |
| `PageHeader` | `components/ui/PageHeader.tsx` | Standard page heading | Title, description, breadcrumbs, action button dock |
| `DashboardLayout` | `components/layout/DashboardLayout.tsx` | Full administrative shell | NextAdmin Sidebar, Navbar, and responsive page container |

---

## 2. Component API & Code Examples

### 2.1 `Button`

Universal button component supporting micro-animations, loading spinners, and NextAdmin semantic color variants.

```tsx
import { Button } from '@/components/ui/primitives';
import { Plus, Trash2 } from 'lucide-react';

// Primary Action
<Button variant="primary" size="md" onClick={handleSave}>
  บันทึกข้อมูล
</Button>

// Loading State
<Button variant="primary" isLoading={isSubmitting}>
  กำลังบันทึก...
</Button>

// Danger Action with Icon
<Button variant="danger" size="sm" onClick={handleDelete}>
  <Trash2 className="w-4 h-4 mr-1.5" />
  ลบโครงการ
</Button>

// Outline Action
<Button variant="outline" onClick={handleCancel}>
  ยกเลิก
</Button>
```

### 2.2 `Card` Family

NextAdmin-styled card containers providing structured headers, descriptions, content bodies, and action footers.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/primitives';

<Card className="hover:border-primary/40 transition-colors">
  <CardHeader>
    <CardTitle>ความก้าวหน้าโครงการ</CardTitle>
    <CardDescription>สรุปการสำรวจและการเปลี่ยนแปลงของพื้นที่</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-foreground">รายละเอียดข้อมูล...</p>
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline" size="sm">ดูรายละเอียด</Button>
  </CardFooter>
</Card>
```

### 2.3 `FormField`, `Input`, `Select`, `Textarea`

Accessible form components automatically linked to Design Tokens for background, border, focus rings, and validation errors.

```tsx
import { FormField, Input, Select, Textarea } from '@/components/ui/primitives';

<FormField label="ชื่อโครงการ" required error={errors.name}>
  <Input
    placeholder="ระบุชื่อโครงการ..."
    value={name}
    onChange={(e) => setName(e.target.value)}
  />
</FormField>

<FormField label="หมวดหมู่งาน">
  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
    <option value="DEFENSE">งานความมั่นคง</option>
    <option value="SURVEY">งานสำรวจภูมิประเทศ</option>
  </Select>
</FormField>

<FormField label="หมายเหตุเพิ่มเติม">
  <Textarea rows={3} placeholder="ระบุรายละเอียด..." />
</FormField>
```

### 2.4 `Table` Family

NextAdmin table architecture featuring hover highlights, styled headers, and an integrated `TableEmpty` state.

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '@/components/ui/primitives';
import { Badge } from '@/components/ui/primitives';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>ชื่อโครงการ</TableHead>
      <TableHead>สถานะ</TableHead>
      <TableHead className="text-right">การจัดการ</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.length === 0 ? (
      <TableEmpty colSpan={3} message="ยังไม่มีข้อมูลโครงการในระบบ" />
    ) : (
      items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium text-foreground">{item.name}</TableCell>
          <TableCell>
            <Badge variant={item.status === 'ACTIVE' ? 'success' : 'outline'}>
              {item.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">แก้ไข</Button>
          </TableCell>
        </TableRow>
      ))
    )}
  </TableBody>
</Table>
```

### 2.5 `Modal`

Accessible dialog modal with backdrop blur, smooth entrance animation, escape key listener, and click-outside dismissal.

```tsx
import { Modal, Button } from '@/components/ui/primitives';

<Modal
  isOpen={isModalOpen}
  onClose={() => setModalOpen(false)}
  title="สร้างโครงการใหม่"
  description="กรอกข้อมูลเพื่อเริ่มต้นบันทึกพื้นที่ปฏิบัติการ"
  footer={
    <div className="flex justify-end gap-3">
      <Button variant="outline" onClick={() => setModalOpen(false)}>ยกเลิก</Button>
      <Button variant="primary" onClick={handleCreate}>บันทึก</Button>
    </div>
  }
>
  <div className="space-y-4">
    <FormField label="ชื่อโครงการ" required>
      <Input autoFocus placeholder="เช่น โครงการตรวจการชายแดน..." />
    </FormField>
  </div>
</Modal>
```

### 2.6 `PageHeader` & `Breadcrumbs`

NextAdmin page heading pattern standardizing the title, description, hierarchical breadcrumb path, and primary call-to-action dock.

```tsx
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/primitives';
import { Plus } from 'lucide-react';

<PageHeader
  title="การจัดการโครงการ"
  description="กำหนดและติดตามโครงการสำรวจภูมิประเทศทั้งหมดในระบบ"
  breadcrumbs={[
    { label: 'แดชบอร์ด', href: '/admin' },
    { label: 'โครงการ' },
  ]}
  action={
    <Button variant="primary" onClick={() => setModalOpen(true)}>
      <Plus className="w-4 h-4 mr-1.5" />
      สร้างโครงการใหม่
    </Button>
  }
/>
```

### 2.7 `DashboardLayout`

Shared layout providing consistent sidebar navigation, top navbar with theme toggling, and structured container spacing.

```tsx
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';

export default function MyPage() {
  return (
    <DashboardLayout>
      <PageHeader title="ชื่อหน้า" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Content goes here */}
      </div>
    </DashboardLayout>
  );
}
```
