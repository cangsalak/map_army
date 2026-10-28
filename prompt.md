# MASTER PROMPT — GeoMonitor 3D
## แก้ไข Map Bearing, Ground Geometry, Drone Mission Planner และระบบ Export แผนการบินให้ใช้งานได้จริง

คุณคือ Senior Full-Stack Engineer, GIS/3D Mapping Engineer และ Drone Photogrammetry Mission Planning Engineer มีหน้าที่ตรวจสอบและแก้ไขโปรเจกต์ GeoMonitor 3D ที่มีอยู่จริง โดยต้องแก้จากต้นเหตุใน Source Code, API, Database, Geometry Engine และ Export Pipeline

**ปัญหาปัจจุบันที่ต้องแก้ไข**

1. มุมหมุนแผนที่ยังเป็นประมาณ -46° ทั้งที่ต้องการ -90°
2. เมื่อวาดพื้นที่หรือสร้างแผนการบิน เส้นและรูปทรงบางส่วนลอยอยู่เหนือพื้นดิน
3. ระบบสร้างแผนการบินและแนวบินต้องใช้ข้อมูลจริง ไม่ใช่เส้นตัวอย่างหรือ Mock Data
4. การ Export แผนการบินยังใช้งานจริงไม่ได้ ต้องตรวจสอบและแก้ไขทั้งไฟล์ที่สร้าง เนื้อหาในไฟล์ และความเข้ากันได้กับโปรแกรมหรืออุปกรณ์ปลายทาง
5. ต้องเชื่อมโยง Project, Responsibility Area, Operation Planning, Mission Planner, Calculation, Validation, Export และ Execution Records ให้เป็นกระบวนการเดียวกัน

## กฎบังคับก่อนเริ่มงาน

- ตรวจสอบ Source Code และสถาปัตยกรรมที่มีอยู่ก่อน ห้ามเดา Stack หรือเปลี่ยนเทคโนโลยีโดยไม่มีเหตุผล
- แก้ไขโปรเจกต์เดิม ไม่สร้าง Demo Application แยกมาแทนระบบจริง
- ห้ามใช้ Mock Data, Fake Results, Hardcoded Mission, Dummy Waypoints, ตัวอย่าง Flight Lines หรือ Fake Export Success ใน Production
- ห้ามสร้างแผนการบินอัตโนมัติเมื่อเปิดหน้า วาดพื้นที่ หรือเปลี่ยนค่าพารามิเตอร์
- ผู้ใช้ต้องกดปุ่ม Calculate Flight Plan ด้วยตนเองก่อนจึงจะสร้างผลคำนวณ
- การกด Export ต้องสร้างไฟล์จากผลคำนวณจริงที่ผ่านการตรวจสอบแล้ว
- ห้ามแสดงสถานะ Success หากการสร้างไฟล์ การดาวน์โหลด หรือการตรวจสอบล้มเหลว
- ห้ามแสดงข้อความว่าแก้ไขหรือทดสอบผ่านแล้ว หากยังไม่ได้รันการทดสอบจริง
- หาก API, Database, Terrain Provider หรือ Export Engine ล้มเหลว ต้องแสดงข้อผิดพลาดจริง ห้ามเปลี่ยนไปใช้ข้อมูลจำลอง
- Test Fixtures อนุญาตเฉพาะใน Automated Test Environment และต้องไม่ถูกนำมาใช้ใน Production
- ห้ามลบหรือทำลายข้อมูลจริงเพื่อให้การทดสอบผ่าน
- หากข้อมูลไม่เพียงพอ ต้องแจ้งข้อจำกัดอย่างตรงไปตรงมา ไม่สร้างค่าความสูง พิกัด หรือความเข้ากันได้ขึ้นเอง

---

# PHASE 1 — ตรวจสอบระบบเดิมและหาต้นเหตุ

ดำเนินการตรวจสอบก่อนแก้ไข โดยระบุไฟล์และฟังก์ชันที่เกี่ยวข้องจริง

### 1.1 Map Engine

ตรวจสอบ:

- Map Engine และเวอร์ชันที่ใช้งาน
- Component ที่สร้างแผนที่และจัดการ Camera/View State
- จุดกำหนด bearing, heading, rotation, pitch และ initial view
- การเรียก fitBounds, flyTo, easeTo หรือ API อื่นที่อาจเปลี่ยนมุม
- การ Restore State จาก URL, Local Storage, Database หรือค่าเริ่มต้น
- Event Listener ที่เขียนทับมุมแผนที่
- ตำแหน่งที่แสดงค่ามุมบน UI เทียบกับค่าที่ Engine ใช้จริง

ค้นหาค่าที่อาจทำให้เกิด -46° รวมถึงค่าคงที่ การคำนวณ offset และการคืนค่า Camera State

### 1.2 Ground Geometry

ตรวจสอบ:

- วิธีสร้าง Polygon, LineString, MultiLineString และ 3D Geometry
- ระบบพิกัดของข้อมูลแต่ละแหล่ง
- การกำหนดค่า Z และ altitude mode
- การใช้ Terrain, DEM และ Elevation Provider
- การแปลงพิกัดระหว่าง WGS84 กับ Projected CRS
- การแปลงความสูงระหว่าง AGL, AMSL และ Vertical Datum
- การใช้ clamp-to-ground, terrain draping หรือ relative altitude
- การแสดงผลผ่าน WebGL, Three.js หรือ Engine อื่น หากมี

### 1.3 Mission Planner และ Export

ตรวจสอบ:

- ที่มาของ Mission Area และ Boundary
- วิธีคำนวณ Grid, Flight Lines, Waypoints และ Camera Capture Positions
- การบันทึกและเรียกคืนผลคำนวณจาก Database/API
- ฟังก์ชัน Export และรูปแบบไฟล์ที่สร้างจริง
- MIME Type, File Extension, Coordinate Order, Altitude Reference และ Metadata
- ความครบถ้วนของไฟล์และความถูกต้องตาม Schema ของรูปแบบนั้น
- ปุ่ม Export เชื่อมต่อกับ Logic จริงหรือยัง
- มีการสร้างไฟล์ตัวอย่างหรือใช้ข้อมูลที่กำหนดตายตัวหรือไม่
- มีการตรวจสอบว่า Mission เป็นผลคำนวณล่าสุดหรือไม่

จัดทำรายงาน Root Cause ก่อนเริ่มแก้ไข โดยแยกปัญหาเป็นรายการ พร้อมไฟล์ ฟังก์ชัน ผลกระทบ และวิธีแก้

---

# PHASE 2 — แก้ไข Map Bearing ให้เป็น -90° จริง

กำหนดค่าเริ่มต้นของแผนที่เป็น -90° ตามความหมายและข้อกำหนดของ Map Engine ที่ใช้จริง

ข้อกำหนด:

1. เปิดหน้าแผนที่ครั้งแรกต้องมี Bearing -90°
2. Refresh หน้าแล้วต้องทำงานตามนโยบายการคืนค่า View ที่กำหนด
3. Reset Map View ต้องกลับมา -90°
4. การโหลดข้อมูลหรือเปลี่ยนพื้นที่ต้องไม่เขียนทับ Bearing โดยไม่จำเป็น
5. การหมุนแผนที่ด้วยมือของผู้ใช้ต้องทำงานตามปกติ
6. หาก Engine ใช้ช่วง 0–360° ให้แปลง -90° เป็น 270° ตอนส่งค่าเข้า Engine ตาม API ที่รองรับ
7. ห้ามเปลี่ยนเฉพาะตัวเลขบน UI โดยไม่ได้เปลี่ยน Camera จริง
8. แยก Map Bearing ออกจาก Mission Grid Bearing และ Flight Heading
9. การหมุนแผนที่ต้องไม่เปลี่ยนพิกัด GIS หรือแนวบินที่คำนวณไว้
10. ตรวจสอบการทำงานของ Reset, Initial State, State Restoration และ Camera Event ให้ครบ

เพิ่ม Unit Tests และ Integration Tests สำหรับ:

- Initial Bearing
- การแปลงมุม -90° และ 270°
- Reset View
- การหมุนแผนที่ด้วยผู้ใช้
- การเปลี่ยนข้อมูลพื้นที่
- การแยก Map Bearing จาก Mission Bearing

---

# PHASE 3 — แก้ไขการวาดพื้นที่ให้แนบพื้นดิน

ต้องแยก Ground Geometry ออกจาก Flight Geometry

## 3.1 Ground Geometry

ขอบเขตพื้นที่รับผิดชอบ ขอบเขตพื้นที่ปฏิบัติการ Polygon ที่ผู้ใช้วาด และแนวเส้นที่ใช้แสดงพื้นที่บนแผนที่ ต้องแนบกับพื้นผิวภูมิประเทศตามความสามารถของ Engine

- ใช้ Ground Clamping หรือ Terrain Draping หาก Engine รองรับ
- ตรวจสอบการตีความ Z และ Altitude Mode ให้ถูกต้อง
- หากใช้ Terrain Provider ต้องรอข้อมูลที่จำเป็นและจัดการ Loading/Error State
- ตรวจสอบว่ารูปทรงไม่ได้ถูกวางไว้ในระดับความสูงคงที่โดยไม่ตั้งใจ
- ห้ามกำหนด Z = 0 แบบเหมารวม หากระบบใช้ระดับอ้างอิงอื่น
- ห้ามบวกหรือลบความสูงแบบเดาเพื่อทำให้รูปทรงดูติดพื้น
- ห้ามเปลี่ยนพิกัดจริงเพื่อแก้ปัญหาการแสดงผล

## 3.2 Flight Geometry

เส้นทางบินของโดรนต้องอยู่ในระดับความสูงที่คำนวณได้ ไม่ใช่ถูกกดลงไปที่พื้นทั้งหมด

- ระบุว่าความสูงอ้างอิงจาก AGL หรือ AMSL
- หากกำหนดความสูงเป็น AGL ต้องมีข้อมูล Terrain Elevation ที่เพียงพอสำหรับคำนวณระดับบิน
- หากกำหนดเป็น AMSL ต้องจัดการ Vertical Datum และการแปลงความสูงอย่างถูกต้อง
- หากไม่มี Terrain Data ที่น่าเชื่อถือ ให้แจ้งว่าคำนวณความสูงสัมพันธ์กับพื้นดินไม่ได้อย่างแม่นยำ
- ภูมิประเทศต่างระดับต้องไม่ถูกสมมติว่าเป็นระนาบเดียว
- บันทึก Altitude Reference ในข้อมูลภารกิจและไฟล์ส่งออก

## 3.3 Coordinate Reference System

ตรวจสอบ:

- CRS ของแผนที่
- CRS ของข้อมูลจาก Database/API
- CRS ที่ใช้คำนวณระยะทางและแนวบิน
- การแปลงระหว่าง Geographic และ Projected Coordinates
- ลำดับ Longitude/Latitude
- หน่วยของระยะทางและความสูง
- Vertical Datum ของข้อมูลระดับความสูง

ห้ามคำนวณระยะทางในหน่วยองศาเสมือนเป็นเมตร และห้ามใช้พิกัดจากคนละ CRS โดยไม่แปลง

---

# PHASE 4 — ปรับโครงสร้างข้อมูล Mission Geometry

ต้องแยกข้อมูลต่อไปนี้ออกจากกันอย่างชัดเจน:

1. Ground Boundary — ขอบเขตบนพื้นดิน
2. Mission Area — พื้นที่ที่ใช้คำนวณภารกิจ
3. Flight Lines — แนวบินที่คำนวณได้
4. Flight Path — เส้นทางบินสามมิติ
5. Waypoints — จุดนำทางพร้อมพิกัดและความสูงอ้างอิง
6. Camera Capture Positions — ตำแหน่งถ่ายภาพ
7. Transition Paths — เส้นทางเชื่อมระหว่างแนวบิน
8. Terrain/Elevation Data — ข้อมูลระดับความสูงภูมิประเทศ
9. Mission Metadata — พารามิเตอร์และเวอร์ชันการคำนวณ

การเปลี่ยน Map Bearing ต้องไม่เปลี่ยนพิกัดจริงของ Geometry

การเปลี่ยนพารามิเตอร์ภารกิจต้องทำให้ผลคำนวณเดิมเป็น OUTDATED จนกว่าจะกด Calculate Flight Plan ใหม่

---

# PHASE 5 — ทำให้ Mission Planner คำนวณจากข้อมูลจริง

ผู้ใช้ต้องสามารถทำงานตามลำดับ:

1. สร้างและบันทึก Project
2. ระบุ Responsibility Area
3. กรอก Master Data และข้อมูลที่เกี่ยวข้อง
4. วางแผนปฏิบัติการ
5. เปิด Drone Mission Planner
6. วาดหรือเลือก Mission Area
7. ตั้งค่าภารกิจ
8. กด Calculate Flight Plan
9. ตรวจสอบผลคำนวณและ Validation
10. Export ในรูปแบบที่ต้องการ
11. บันทึกผลการดำเนินงานจริง

ห้ามข้ามขั้นตอนที่จำเป็น และห้ามสร้างข้อมูลอัตโนมัติแทนผู้ใช้

## 5.1 Grid Mapping

ต้องสร้าง:

- แนวบินหลายเส้นที่ขนานกันตาม Bearing ที่กำหนด
- เส้นที่ถูกตัดตามขอบเขต Polygon จริง
- รองรับ Polygon รูปทรงเว้า และรูภายใน Polygon หาก Geometry Engine รองรับ
- การจัดลำดับแนวบินเพื่อลดระยะทางเปลี่ยนแนว
- การสลับทิศทางบินแต่ละแนวเมื่อเหมาะสม
- Transition Paths
- Camera Capture Positions ตามระยะถ่ายภาพที่คำนวณได้
- ระยะทางบิน จำนวนแนวบิน จำนวนภาพ และเวลาโดยประมาณ

ห้ามสร้างเส้นเพียงสองจุดต่อหนึ่งแนวโดยไม่สร้างตำแหน่งถ่ายภาพเมื่อภารกิจต้องการถ่ายภาพต่อเนื่อง

## 5.2 Crosshatch Mapping

- สร้าง Grid ชุดที่สองตาม Bearing อีกทิศทางหนึ่ง
- ใช้แนวตั้งฉากเป็นค่าเริ่มต้นได้ แต่ต้องให้ผู้ใช้ปรับได้
- คำนวณแนวบินและตำแหน่งถ่ายภาพของทั้งสองชุดจริง
- แยกจำนวนภาพ ระยะทาง และเวลาของแต่ละชุด

## 5.3 3D Orbit / Circular Mapping

ให้ผู้ใช้กำหนด:

- จุดศูนย์กลาง
- รัศมีวงบิน
- จำนวนรอบ
- ระดับความสูงหรือระดับความสูงแต่ละชั้น
- ความเร็ว
- มุมกล้อง
- ระยะห่างระหว่างภาพ
- ทิศทางการบิน

คำนวณตำแหน่งและทิศทางกล้องตามพารามิเตอร์จริง ห้ามสร้างวงกลมตัวอย่างที่ไม่ได้มาจากค่าที่ผู้ใช้กำหนด

## 5.4 Corridor Mapping

รองรับพื้นที่ตามแนวถนน แม่น้ำ แนวโครงสร้างพื้นฐาน หรือเส้นทางที่ผู้ใช้ระบุ โดยคำนวณความกว้างพื้นที่ แนวบิน และตำแหน่งถ่ายภาพตามค่าจริง

## 5.5 Photogrammetry Parameters

รองรับการตั้งค่าตามความสามารถของระบบ:

- Drone/Camera Model
- Sensor Dimensions
- Image Resolution
- Focal Length
- Flight Altitude
- Front Overlap
- Side Overlap
- Flight Speed
- Grid Bearing
- Gimbal/Camera Angle
- Capture Interval
- Terrain Elevation

คำนวณ Camera Footprint, Ground Sampling Distance หากข้อมูลเพียงพอ, Photo Spacing, Flight-Line Spacing, จำนวนภาพ และเวลาโดยประมาณ

หากข้อมูลกล้องไม่ครบ ให้แสดง UNKNOWN หรือ ESTIMATED พร้อมเหตุผล ห้ามแสดงค่าที่ดูแม่นยำแต่ไม่มีข้อมูลรองรับ

เมื่อเปลี่ยนค่าพารามิเตอร์แล้วกด Calculate Flight Plan ใหม่ ผลลัพธ์ต้องเปลี่ยนตามค่าจริง ไม่ใช่เพียงเปลี่ยนข้อความบน UI

---

# PHASE 6 — แก้ไขระบบ Export แผนการบินที่ใช้งานจริงไม่ได้

**นี่เป็นข้อบกพร่องสำคัญและต้องได้รับการแก้ไขครบทั้ง Pipeline**

อย่าถือว่าการสร้างไฟล์สำเร็จเท่ากับการ Export ใช้งานจริงได้ ต้องตรวจสอบทั้งข้อมูล รูปแบบไฟล์ การดาวน์โหลด และความเข้ากันได้กับปลายทาง

## 6.1 ตรวจสอบปัญหาของระบบ Export ปัจจุบัน

ตรวจสอบ:

- ปุ่ม Export เรียก API หรือ Function จริงหรือไม่
- ใช้ Mission ID และผลคำนวณล่าสุดจาก Database/API หรือไม่
- Export ใช้ข้อมูล Mock หรือ Hardcoded Waypoints หรือไม่
- ไฟล์ที่ได้มีเนื้อหาครบถ้วนหรือเป็นเพียงไฟล์เปล่า/ตัวอย่าง
- Coordinate Order และ CRS ถูกต้องหรือไม่
- Altitude Reference และหน่วยถูกต้องหรือไม่
- Flight Lines, Waypoints, Mission Parameters และ Capture Positions ถูกส่งออกครบหรือไม่
- MIME Type และ File Extension ตรงกับรูปแบบไฟล์หรือไม่
- ไฟล์เสียหาย ถูกตัดข้อมูล หรือมี Schema ไม่ถูกต้องหรือไม่
- Browser ดาวน์โหลดไฟล์จริงหรือเพียงแสดงข้อความ Success
- Export ใช้ข้อมูลจาก Calculation Version ล่าสุดหรือไม่
- Validation Error ถูกข้ามไปหรือไม่
- Server มีข้อผิดพลาดที่ถูกซ่อนจากผู้ใช้หรือไม่

ต้องสร้างรายการ Root Cause ที่พบจริง และแก้ไขทุกข้อที่เกี่ยวข้อง

## 6.2 แยกประเภท Export ให้ชัดเจน

ออกแบบ Export ให้ผู้ใช้เลือกประเภทการใช้งานอย่างชัดเจน ไม่ใช้คำว่า Export แบบกว้าง ๆ โดยไม่ระบุความหมาย

### A. GIS / Visualization Export

ตัวอย่างรูปแบบที่อาจรองรับ:

- KML
- KMZ
- GeoJSON

ไฟล์ต้องมีข้อมูลจริงตามประเภทที่เลือก เช่น:

- Mission Boundary
- Ground Boundary
- Flight Lines
- Waypoints
- Camera Capture Positions หากเหมาะสม
- Mission Metadata
- Coordinate Reference
- Altitude Reference
- Validation Summary
- Compatibility Warnings

ตรวจสอบว่าไฟล์เปิดได้จริงด้วย Parser หรือซอฟต์แวร์ที่เหมาะสม

**ข้อจำกัด:** KML/KMZ ที่เปิดใน Google Earth ได้ ไม่ได้ยืนยันว่าจะใช้เป็นคำสั่งบินอัตโนมัติของโดรนได้

### B. Planning / Simulation Export

รองรับเฉพาะรูปแบบที่โปรแกรมวางแผนหรือจำลองการบินปลายทางรองรับจริง

ต้องระบุชื่อโปรแกรม เวอร์ชัน รูปแบบไฟล์ และข้อกำหนดการนำเข้าที่ตรวจสอบได้

ห้ามตั้งชื่อไฟล์เป็นรูปแบบของโปรแกรมปลายทาง หากเนื้อหาภายในไม่ตรงตาม Format นั้น

### C. Autonomous Flight Mission Export

ก่อนพัฒนาการส่งออกเพื่อบินอัตโนมัติ ต้องระบุข้อมูล:

- Drone Brand
- Drone Model
- Remote Controller Model
- Flight-Control Application
- Application Version
- Firmware Version หากเกี่ยวข้อง
- Mission Format ที่อุปกรณ์รองรับ
- ข้อกำหนด Waypoint, Altitude, Camera Action และ Safety Limits

จากนั้นตรวจสอบความเข้ากันได้กับเอกสารผู้ผลิตหรือ SDK ที่เกี่ยวข้องจริง

ห้ามสร้างรูปแบบไฟล์สำหรับ DJI, Autel หรือยี่ห้ออื่นขึ้นเองโดยไม่มีข้อกำหนดรองรับ

ห้ามสมมติว่าโดรนทุกรุ่นหรือรีโมตทุกรุ่นนำเข้า KML เพื่อบินอัตโนมัติได้

หากไม่สามารถยืนยันการรองรับได้ ต้องแจ้งผู้ใช้ว่าเป็นไฟล์สำหรับ Visualization หรือเป็นรูปแบบที่ยังไม่ได้ตรวจสอบ ไม่ใช่ไฟล์พร้อมบิน

## 6.3 Compatibility Status

ทุกประเภท Export ต้องมีสถานะความเข้ากันได้ที่สื่อความหมายชัดเจน:

- VERIFIED_IMPORT — ตรวจสอบการนำเข้ากับปลายทางที่ระบุแล้ว
- VERIFIED_WITH_LIMITATIONS — นำเข้าได้แต่มีข้อจำกัดที่ระบุชัดเจน
- VISUALIZATION_ONLY — สำหรับแสดงผล ไม่ใช่คำสั่งบินอัตโนมัติ
- NEEDS_DEVICE_TEST — ต้องทดสอบกับอุปกรณ์จริง
- NOT_SUPPORTED — ปลายทางไม่รองรับ
- NOT_VERIFIED — ยังไม่มีหลักฐานยืนยันความเข้ากันได้

ห้ามกำหนด VERIFIED_IMPORT เพียงเพราะสร้างไฟล์สำเร็จหรือเปิดไฟล์ใน GIS ได้

หากไม่มีข้อมูล Drone/Remote/Application ให้เลือก Export สำหรับ Visualization ได้ แต่ต้องไม่แสดงสถานะว่าเป็น Mission ที่พร้อมนำไปบิน

## 6.4 Export Validation

ก่อนสร้างไฟล์ ต้องตรวจสอบอย่างน้อย:

- Project และ Mission มีอยู่จริง
- มี Mission Area ที่ถูกต้อง
- มีผลคำนวณจากการกด Calculate Flight Plan
- Calculation Version เป็นเวอร์ชันล่าสุด
- ไม่มีพารามิเตอร์เปลี่ยนหลังการคำนวณ
- Geometry ถูกต้องและไม่ว่าง
- Waypoints มีพิกัดถูกต้อง
- หน่วยและ CRS ถูกต้อง
- Altitude Reference ระบุชัดเจน
- Flight Lines และ Waypoints อยู่ในขอบเขตตามเงื่อนไขของภารกิจ
- ไม่มี Validation Error ที่ทำให้ Export ไม่ปลอดภัยหรือใช้ไม่ได้

หากผลคำนวณเป็น OUTDATED ให้ปิดกั้น Mission Export และให้ผู้ใช้คำนวณใหม่ก่อน

หากมี Error ที่ทำให้ไฟล์ผิดรูปแบบหรือไม่สามารถใช้ตามวัตถุประสงค์ได้ ให้ปิดกั้นการ Export ประเภทนั้น แต่อนุญาตให้ Export Visualization ได้เฉพาะเมื่อข้อมูลที่เหลือยังถูกต้อง พร้อมระบุข้อจำกัด

## 6.5 File Integrity และ Download

ต้องตรวจสอบ:

- เนื้อหาไฟล์ไม่ว่างและถูกต้องตาม Schema
- File Extension และ MIME Type ถูกต้อง
- การดาวน์โหลดส่งไฟล์จริงจาก Server/Browser
- ชื่อไฟล์สื่อถึง Project และ Mission โดยไม่ทำให้เข้าใจผิด
- ข้อผิดพลาดจาก API แสดงข้อความที่เข้าใจได้
- ไม่มีการสร้างไฟล์สำเร็จเทียมเมื่อเกิด Exception
- การ Export ซ้ำด้วย Calculation Version เดิมให้ผลตามข้อมูลเดียวกัน
- หาก Export สำเร็จ ให้บันทึก Audit/Export Record ตามโครงสร้างระบบจริง

อย่าบันทึกว่าไฟล์ถูกนำเข้าอุปกรณ์แล้วหรือมีการบินสำเร็จ หากระบบไม่ได้รับหลักฐานจากขั้นตอนนั้นจริง

## 6.6 Export Test Matrix

สร้าง Automated Tests สำหรับ:

1. Export KML ที่มี Boundary และ Flight Lines จริง
2. Export KMZ ที่มีไฟล์ภายในครบและอ่านได้
3. Export GeoJSON ที่ผ่าน JSON Parse และ Geometry Validation
4. ตรวจสอบ Coordinate Order และ CRS
5. ตรวจสอบ Altitude Reference
6. ตรวจสอบไฟล์ที่ไม่มี Mission Area
7. ตรวจสอบ Mission ที่ยังไม่ Calculate
8. ตรวจสอบ Mission ที่ Calculation Version เก่า
9. ตรวจสอบ API Failure และ Database Failure
10. ตรวจสอบการดาวน์โหลดไฟล์จริง
11. ตรวจสอบ Schema ของรูปแบบ Mission ที่รองรับ
12. ตรวจสอบกรณีอุปกรณ์ปลายทางไม่รองรับหรือยังไม่ยืนยัน
13. ตรวจสอบว่าไม่มี Mock Data ในไฟล์ Export
14. ตรวจสอบว่าไฟล์ Export สะท้อนค่าพารามิเตอร์ที่ผู้ใช้กำหนดจริง

หากมีปลายทางที่ระบุชัดเจน ให้เพิ่ม Import Test กับโปรแกรมที่รองรับ หรือทดสอบกับอุปกรณ์จริงเมื่อสามารถเข้าถึงได้

ห้ามอ้างว่า Autonomous Mission Export ใช้งานได้จริงหากมีเพียง Unit Test สำหรับสร้างไฟล์ แต่ยังไม่เคยตรวจสอบการนำเข้าในปลายทาง

---

# PHASE 7 — ปรับปรุง UI และ Workflow

ทุกหน้าต้องใช้ข้อมูลจาก Database/API จริง

## 7.1 Project

- สร้าง แก้ไข และบันทึก Project ได้จริง
- แสดงสถานะและข้อมูล Project ที่บันทึกไว้
- ไม่สร้าง Project ตัวอย่างเมื่อฐานข้อมูลว่าง

## 7.2 Responsibility Area

- วาดพื้นที่บนแผนที่จริง
- บันทึกและเรียกคืน Polygon จริง
- ตรวจสอบ Geometry และ CRS
- แสดงขอบเขตบนพื้นดินตามที่ Engine รองรับ

## 7.3 Mission Planner

- เริ่มต้นด้วย Empty State เมื่อยังไม่มี Mission
- มีช่องกรอกค่าพารามิเตอร์ที่ผู้ใช้แก้ไขได้
- ไม่มีแผนการบินที่ล็อกค่ามาให้หรือสร้างล่วงหน้า
- ไม่มี Flight Lines หรือ Capture Points ก่อนกด Calculate
- แสดง Loading, Success และ Error จากผลการทำงานจริง
- เมื่อเปลี่ยนพารามิเตอร์ ให้แสดงสถานะ OUTDATED สำหรับผลคำนวณเดิม
- ปุ่ม Export ต้องทำงานตามประเภทและสถานะของ Mission จริง

## 7.4 Error Handling

หากไม่มีข้อมูล ให้แสดง Empty State และปุ่มเริ่มดำเนินการ

หาก API หรือ Database ล้มเหลว ให้แสดง Error State พร้อมทางเลือก Retry

ห้ามแสดงผลจาก Mock Data เพื่อปิดบังความผิดพลาด

---

# PHASE 8 — Integration และ Regression Tests

ทดสอบ Workflow เต็มรูปแบบ:

Login → Create Project → Responsibility Area → Master Data → Operation Planning → Draw Mission Area → Set Parameters → Calculate Flight Plan → Validate → Export → Verify Export File

เพิ่มการทดสอบต่อไปนี้:

### Authentication

- ผู้ใช้ที่ยังไม่เข้าสู่ระบบไม่สามารถเข้าถึง Protected Pages ได้
- Root `/` เปลี่ยนเส้นทางไป `/dashboard` เมื่อเข้าสู่ระบบแล้ว และไป `/login` เมื่อยังไม่ได้เข้าสู่ระบบ
- Logout ต้องล้าง Session/Cookie ตามกลไกจริงและเปลี่ยนไปหน้า Login
- API ต้องตรวจสอบ Authentication/Authorization ฝั่ง Server
- ป้องกัน Redirect Loop และการแสดงหน้าที่ป้องกันไว้จาก Cache หลัง Logout

### No-Demo Regression

- Mission Planner ว่างต้องไม่มีเส้นบินหรือจุดถ่ายภาพ
- การวาดพื้นที่ต้องไม่สร้าง Mission โดยอัตโนมัติ
- API ล้มเหลวต้องไม่แสดงข้อมูลตัวอย่าง
- Production ต้องไม่มี Seed หรือ Mock Data ที่ทำให้เกิดแผนการบินปลอม
- Export ต้องไม่สร้างข้อมูลจาก Hardcoded Mission
- Mission ที่เปลี่ยนพารามิเตอร์แล้วต้องไม่สามารถ Export ผลคำนวณเก่าได้

### Map and Geometry Regression

- Initial Map Bearing และ Reset View เป็น -90° ตามข้อกำหนด
- Map Rotation ไม่เปลี่ยนพิกัด GIS
- Ground Boundary แนบพื้นตาม Engine
- Flight Path รักษาความสูงตาม Reference ที่กำหนด
- การเปลี่ยน Bearing, Overlap, Altitude และ Speed เปลี่ยนผลคำนวณจริงเมื่อ Recalculate

### Export Regression

- ไฟล์ที่สร้างสามารถอ่านและตรวจสอบได้
- ไฟล์สะท้อนผลคำนวณล่าสุด
- ข้อมูล CRS, Coordinate Order และ Altitude Reference ถูกต้อง
- Error ต้องไม่ถูกแสดงเป็น Success
- สถานะ Compatibility ต้องไม่อ้างเกินหลักฐาน
- การ Export ต้องไม่ทำให้ข้อมูลภารกิจต้นฉบับเปลี่ยนโดยไม่ตั้งใจ

---

# PHASE 9 — Build, Verify และรายงานผล

หลังแก้ไข ให้รันคำสั่งตรวจสอบตาม Stack จริงของโปรเจกต์ เช่น Type Check, Lint, Unit Tests, Integration Tests, E2E Tests และ Production Build

ห้ามข้ามการทดสอบที่มีอยู่ และห้ามแก้ Test ให้ผ่านด้วยการลดข้อกำหนดที่จำเป็นของระบบ

ส่งมอบรายงาน:

1. Root Cause ของ Map Bearing
2. Root Cause ของ Geometry ที่ลอยเหนือพื้น
3. Root Cause ของ Export ที่ใช้งานไม่ได้
4. รายชื่อไฟล์ที่แก้ไขและรายละเอียดการเปลี่ยนแปลง
5. วิธีจัดการ CRS, Terrain Elevation, AGL และ AMSL
6. รูปแบบ Export ที่รองรับจริง
7. ผลการตรวจสอบไฟล์ Export ด้วย Parser หรือโปรแกรมปลายทาง
8. Compatibility Status ของแต่ละประเภท Export
9. ผล Unit, Integration, E2E, Lint, Type Check และ Build ตามที่รันจริง
10. ข้อจำกัดที่ยังเหลือและขั้นตอนที่ต้องทดสอบกับอุปกรณ์จริง

แยกสถานะให้ชัดเจน:

- FIXED AND TESTED — แก้ไขและทดสอบผ่านจริง
- FIXED, DEVICE TEST PENDING — แก้ไขแล้วแต่ยังต้องทดสอบอุปกรณ์
- PARTIALLY FIXED — แก้ได้บางส่วน
- BLOCKED — ติดข้อจำกัดที่ระบุชัดเจน
- NOT FIXED — ยังไม่สามารถแก้ไขได้

## ลำดับการดำเนินงาน

ให้ทำตามลำดับนี้:

1. Audit Source Code และระบุ Root Cause
2. แก้ Map Bearing
3. แก้ Ground Geometry และ Altitude Reference
4. ตรวจสอบ Mission Geometry และ Calculation Engine
5. แก้ Export Pipeline
6. เพิ่ม Validation และ Compatibility Checking
7. เพิ่ม Automated Tests
8. รัน Workflow จริงตั้งแต่ต้นจนจบ
9. ส่งรายงานผลพร้อมหลักฐาน

ห้ามหยุดเพียงการเสนอแนวทางหรือสร้างโค้ดตัวอย่าง ให้ดำเนินการแก้ไขโปรเจกต์จริงตามสิทธิ์และเครื่องมือที่มี หากขาดข้อมูลจำเป็น เช่น Drone Model, Remote Controller หรือ Flight Application ให้ดำเนินการส่วนที่ทำได้ก่อน และระบุข้อมูลที่ยังต้องใช้เพื่อยืนยัน Autonomous Mission Export

**เป้าหมายสุดท้าย:** GeoMonitor 3D ต้องแสดงแผนที่ด้วยมุมที่ถูกต้อง วาดพื้นที่บนพื้นดิน สร้างแผนการบินจากข้อมูลและพารามิเตอร์จริง และส่งออกไฟล์ที่มีรูปแบบถูกต้อง ตรวจสอบได้ และระบุชัดเจนว่าสามารถนำไปใช้กับระบบปลายทางใดได้บ้าง โดยไม่อ้างว่าสามารถบินอัตโนมัติได้หากยังไม่มีหลักฐานยืนยัน