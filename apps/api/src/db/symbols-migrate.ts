import { pool } from './index.js';

export async function runSymbolsMigrations() {
  console.log('[Migration] Starting Symbol Catalog & Drawing Tools schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Symbol Catalog Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS symbol_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        icon_key VARCHAR(100) NOT NULL,
        default_color VARCHAR(20) DEFAULT '#38bdf8',
        default_size INT DEFAULT 24,
        default_rotation NUMERIC(5, 2) DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        asset_path TEXT,
        svg_content TEXT,
        is_custom BOOLEAN DEFAULT FALSE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_catalog_cat ON symbol_catalog(category);
      CREATE INDEX IF NOT EXISTS idx_symbol_catalog_icon ON symbol_catalog(icon_key);
    `);

    // 2. User Favorites Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_symbol_favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol_id UUID NOT NULL REFERENCES symbol_catalog(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_symbol_fav UNIQUE (user_id, symbol_id)
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_fav_user ON user_symbol_favorites(user_id);
    `);

    // 3. User Recent Symbols Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_recent_symbols (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol_id UUID NOT NULL REFERENCES symbol_catalog(id) ON DELETE CASCADE,
        used_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_symbol_recent UNIQUE (user_id, symbol_id)
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_recent_user_time ON user_recent_symbols(user_id, used_at DESC);
    `);

    // 4. Enhance map_layers with order_index
    await client.query(`
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
    `);

    // 5. Enhance map_features with project_id, symbol_id, name, description, style, updated_by
    await client.query(`
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS symbol_id UUID REFERENCES symbol_catalog(id) ON DELETE SET NULL;
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS name VARCHAR(200);
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS style JSONB DEFAULT '{}';
      ALTER TABLE map_features ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    // 6. Seed Initial 30+ Standard Symbols across 10 Categories
    const seedSymbols = [
      // Category 1: General Locations
      { name: 'หมุดระบุตำแหน่งทั่วไป', desc: 'จุดสังเกตหรือหมุดอ้างอิงทั่วไป', cat: 'general_locations', icon: 'MapPin', color: '#38bdf8', tags: ['pin', 'location', 'general'] },
      { name: 'จุดนำทาง / พิกัดเดินทาง', desc: 'จุดเลี้ยวหรือพิกัดบนเส้นทาง', cat: 'general_locations', icon: 'Navigation', color: '#06b6d4', tags: ['waypoint', 'nav', 'route'] },
      { name: 'ธงจุดหมายภารกิจ', desc: 'เป้าหมายปลายทางหรือจุดสิ้นสุด', cat: 'general_locations', icon: 'Flag', color: '#f59e0b', tags: ['flag', 'target', 'goal'] },
      { name: 'จุดตรวจทิศอ้างอิง', desc: 'หมุดควบคุมแนวแกนทิศทาง', cat: 'general_locations', icon: 'Compass', color: '#10b981', tags: ['compass', 'datum', 'bearing'] },

      // Category 2: Offices and Facilities
      { name: 'อาคารกองบัญชาการ', desc: 'ศูนย์ควบคุมและสั่งการหลัก', cat: 'offices_facilities', icon: 'Building2', color: '#3b82f6', tags: ['hq', 'office', 'command'] },
      { name: 'คลังพัสดุและยุทโธปกรณ์', desc: 'จุดเก็บรักษาอุปกรณ์และยานพาหนะ', cat: 'offices_facilities', icon: 'Warehouse', color: '#6366f1', tags: ['depot', 'storage', 'warehouse'] },
      { name: 'แคมป์ที่พักบุคลากร', desc: 'ที่พักชั่วคราวสำหรับทีมสำรวจ', cat: 'offices_facilities', icon: 'Home', color: '#8b5cf6', tags: ['camp', 'quarters', 'housing'] },
      { name: 'ศูนย์ซ่อมบำรุงอากาศยาน', desc: 'โรงเก็บและซ่อมบำรุงโดรน', cat: 'offices_facilities', icon: 'Factory', color: '#ec4899', tags: ['maintenance', 'hanger', 'workshop'] },

      // Category 3: People and Teams
      { name: 'ชุดปฏิบัติการค้นหากู้ภัย', desc: 'ทีมภาคสนามพร้อมอุปกรณ์ช่วยเหลือ', cat: 'people_teams', icon: 'Users', color: '#10b981', tags: ['sar', 'team', 'search'] },
      { name: 'หัวหน้าชุดปฏิบัติการ', desc: 'ผู้ควบคุมหน่วยภาคสนาม', cat: 'people_teams', icon: 'UserCheck', color: '#059669', tags: ['leader', 'commander', 'chief'] },
      { name: 'หน่วยรักษาความปลอดภัย', desc: 'กำลังพลดูแลความสงบเรียบร้อย', cat: 'people_teams', icon: 'Shield', color: '#d97706', tags: ['security', 'guard', 'patrol'] },
      { name: 'ช่างสำรวจ / วิศวกร', desc: 'เจ้าหน้าที่รังวัดและคำนวณงานดิน', cat: 'people_teams', icon: 'HardHat', color: '#eab308', tags: ['engineer', 'surveyor', 'specialist'] },

      // Category 4: Vehicles and Equipment
      { name: 'รถบรรทุกอุปกรณ์หนัก', desc: 'ยานพาหนะขนย้ายเครื่องมือ', cat: 'vehicles_equipment', icon: 'Truck', color: '#f97316', tags: ['truck', 'heavy', 'logistics'] },
      { name: 'รถยนต์ตรวจการณ์ 4x4', desc: 'ยานพาหนะเข้าพื้นที่ทุรกันดาร', cat: 'vehicles_equipment', icon: 'Car', color: '#ea580c', tags: ['car', 'patrol', '4wd'] },
      { name: 'เรือสำรวจชายฝั่ง', desc: 'ยานสำรวจทางน้ำและริมตลิ่ง', cat: 'vehicles_equipment', icon: 'Ship', color: '#0284c7', tags: ['boat', 'vessel', 'water'] },
      { name: 'สถานีวิทยุสื่อสารเคลื่อนที่', desc: 'หน่วยส่งสัญญาณสื่อสารความถี่สูง', cat: 'vehicles_equipment', icon: 'Radio', color: '#8b5cf6', tags: ['radio', 'comms', 'relay'] },

      // Category 5: Medical and Emergency Services
      { name: 'จุดปฐมพยาบาลเบื้องต้น', desc: 'เต็นท์พยาบาลสนามฉุกเฉิน', cat: 'medical_emergency', icon: 'Cross', color: '#ef4444', tags: ['firstaid', 'medical', 'clinic'] },
      { name: 'จุดส่งกลับสายแพทย์ฉุกเฉิน', desc: 'ลานเฮลิคอปเตอร์พยาบาล Medevac', cat: 'medical_emergency', icon: 'HeartPulse', color: '#dc2626', tags: ['medevac', 'triage', 'hospital'] },
      { name: 'จุดเกิดเหตุเพลิงไหม้', desc: 'ตำแหน่งไฟไหม้หรือเปลวควัน', cat: 'medical_emergency', icon: 'Flame', color: '#f97316', tags: ['fire', 'flame', 'danger'] },
      { name: 'รถพยาบาลฉุกเฉินสนาม', desc: 'หน่วยเคลื่อนย้ายผู้บาดเจ็บ', cat: 'medical_emergency', icon: 'Ambulance', color: '#ef4444', tags: ['ambulance', 'emergency', 'ems'] },

      // Category 6: Infrastructure
      { name: 'เสาส่งสัญญาณโทรคมนาคม', desc: 'เสาสัญญาณวิทยุและเครือข่าย', cat: 'infrastructure', icon: 'TowerControl', color: '#6366f1', tags: ['tower', 'telecom', 'signal'] },
      { name: 'สถานีไฟฟ้าย่อย / หม้อแปลง', desc: 'แหล่งจ่ายพลังงานไฟฟ้าโครงการ', cat: 'infrastructure', icon: 'Zap', color: '#eab308', tags: ['power', 'grid', 'electric'] },
      { name: 'สถานีจ่ายน้ำและระบบประปา', desc: 'ท่อส่งและถังเก็บน้ำอุปโภค', cat: 'infrastructure', icon: 'Droplets', color: '#0284c7', tags: ['water', 'pipe', 'hydrant'] },
      { name: 'จุดเติมน้ำมันเชื้อเพลิง', desc: 'คลังสำรองน้ำมันอากาศยาน/รถ', cat: 'infrastructure', icon: 'Fuel', color: '#d97706', tags: ['fuel', 'gas', 'refuel'] },

      // Category 7: Environmental Monitoring
      { name: 'สถานีตรวจวัดสภาพอากาศ', desc: 'เครื่องวัดแรงลม ฝน และความกดอากาศ', cat: 'environmental_monitoring', icon: 'Wind', color: '#14b8a6', tags: ['weather', 'meteo', 'wind'] },
      { name: 'เซ็นเซอร์ตรวจวัดอุณหภูมิ', desc: 'จุดตรวจความร้อนผิวหน้าดิน', cat: 'environmental_monitoring', icon: 'Thermometer', color: '#f43f5e', tags: ['temp', 'sensor', 'heat'] },
      { name: 'แนวพืชพันธุ์ธรรมชาติ / ป่า', desc: 'พื้นที่คุ้มครองธรรมชาติ', cat: 'environmental_monitoring', icon: 'Trees', color: '#16a34a', tags: ['trees', 'forest', 'nature'] },
      { name: 'จุดเฝ้าระวังดินถล่ม', desc: 'พื้นที่ลาดชันเสี่ยงภัยธรรมชาติ', cat: 'environmental_monitoring', icon: 'AlertTriangle', color: '#ea580c', tags: ['hazard', 'landslide', 'risk'] },

      // Category 8: Drone Survey Locations
      { name: 'ลานขึ้น-ลงโดรน (Drone LZ)', desc: 'จุดปล่อยและรับอากาศยานไร้คนขับ', cat: 'drone_survey', icon: 'Scan', color: '#06b6d4', tags: ['lz', 'launch', 'landing'] },
      { name: 'หมุดควบคุมภาคพื้นดิน GCP', desc: 'หมุดรังวัดพิกัดความละเอียดสูง RTK', cat: 'drone_survey', icon: 'Layers', color: '#8b5cf6', tags: ['gcp', 'rtk', 'survey'] },
      { name: 'สถานีฐานอ้างอิงพิกัด RTK Base', desc: 'เครื่องส่งค่าแก้อัตราพิกัดดาวเทียม', cat: 'drone_survey', icon: 'Crosshair', color: '#3b82f6', tags: ['rtk', 'base', 'gnss'] },
      { name: 'จุดตรวจจับความร้อนทางอากาศ', desc: 'ตำแหน่งบันทึกภาพกล้องอินฟราเรด', cat: 'drone_survey', icon: 'Camera', color: '#ec4899', tags: ['camera', 'thermal', 'sensor'] },

      // Category 9: General Map Graphics
      { name: 'จุดกลมระบุตำแหน่ง', desc: 'วงกลมมาร์กเกอร์มาตรฐาน', cat: 'general_graphics', icon: 'Circle', color: '#38bdf8', tags: ['dot', 'circle', 'point'] },
      { name: 'สี่เหลี่ยมกำหนดเขต', desc: 'กรอบสี่เหลี่ยมมาร์กเกอร์', cat: 'general_graphics', icon: 'Square', color: '#a855f7', tags: ['square', 'marker', 'box'] },
      { name: 'ข้อความกำกับบนแผนที่', desc: 'ป้ายชื่อหรือหมายเหตุอธิบาย', cat: 'general_graphics', icon: 'Type', color: '#ffffff', tags: ['text', 'label', 'annotation'] },
    ];

    for (const sym of seedSymbols) {
      await client.query(
        `INSERT INTO symbol_catalog (name, description, category, icon_key, default_color, tags, is_custom)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         ON CONFLICT DO NOTHING;`,
        [sym.name, sym.desc, sym.cat, sym.icon, sym.color, sym.tags]
      );
    }

    await client.query('COMMIT;');
    console.log('[Migration] Symbol Catalog & Drawing Tools migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Migration Error] Symbols migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
