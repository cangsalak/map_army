'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Badge,
  Card,
  Modal,
  FormField,
  Input,
  Select,
} from '@/components/ui/primitives';
import {
  Layers,
  Plus,
  Upload,
  Play,
  Boxes,
  FileCode,
  HardDrive,
  Clock,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { cn } from '@/components/ui/primitives';

export default function SurveysPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateSurveyModalOpen, setIsCreateSurveyModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New Survey Form State
  const [surveyCode, setSurveyCode] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [droneModel, setDroneModel] = useState('DJI Matrice 350 RTK');
  const [sensorType, setSensorType] = useState('Zenmuse P1 45MP Full-Frame');
  const [flightAltitudeM, setFlightAltitudeM] = useState(120);
  const [gsdCm, setGsdCm] = useState(2.5);

  // Asset Upload Form State
  const [assetType, setAssetType] = useState('orthomosaic');
  const [fileName, setFileName] = useState('');
  const [fileSizeMb, setFileSizeMb] = useState(250);

  // Load Areas
  const loadAreas = async () => {
    try {
      const areasRes = await apiFetch<any>('/areas');
      const items = areasRes.items || areasRes || [];
      setAreas(items);
      if (items.length > 0 && !selectedAreaId) {
        setSelectedAreaId(items[0].id);
      }
    } catch (err) {
      console.warn('[Surveys Area Load Error]', err);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  // Load Surveys for Selected Area
  const loadSurveys = async () => {
    if (!selectedAreaId) {
      setSurveys([]);
      setActiveSurvey(null);
      return;
    }

    try {
      const sRes = await apiFetch<any[]>(`/areas/${selectedAreaId}/surveys`);
      const items = Array.isArray(sRes) ? sRes : [];
      setSurveys(items);
      if (items.length > 0) {
        const detail = await apiFetch<any>(`/surveys/${items[0].id}`);
        setActiveSurvey(detail);
      } else {
        setActiveSurvey(null);
      }
    } catch (err) {
      console.warn('[Surveys Load Error]', err);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [selectedAreaId]);

  const handleSelectSurvey = async (surveyId: string) => {
    try {
      const detail = await apiFetch<any>(`/surveys/${surveyId}`);
      setActiveSurvey(detail);
    } catch (err) {
      console.warn('[Survey Detail Error]', err);
    }
  };

  // 1. Create Survey Round Handler
  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;

    try {
      const code = surveyCode.trim() || `SURV-${Date.now().toString().slice(-6)}`;
      await apiFetch(`/areas/${selectedAreaId}/surveys`, {
        method: 'POST',
        body: JSON.stringify({
          surveyCode: code,
          surveyDate: new Date(surveyDate).toISOString(),
          droneModel,
          sensorType,
          flightAltitudeM: Number(flightAltitudeM),
          groundSampleDistanceCm: Number(gsdCm),
          crsHorizontal: 'EPSG:4326',
          crsVertical: 'EGM96 / WGS84 Ellipsoid',
        }),
      });

      setIsCreateSurveyModalOpen(false);
      setSurveyCode('');
      await loadSurveys();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  // 2. Register Deliverable Asset Handler
  const handleUploadAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey?.id) return;
    try {
      const name = fileName.trim() || `${assetType}_${Date.now()}.tif`;
      const fileSizeBytes = Math.max(1, Math.round(Number(fileSizeMb) * 1024 * 1024));
      const encoder = new TextEncoder();
      const hashData = encoder.encode(`${activeSurvey.id}:${assetType}:${name}:${fileSizeBytes}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
      const computedSha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await apiFetch(`/surveys/${activeSurvey.id}/assets`, {
        method: 'POST',
        body: JSON.stringify({
          assetType,
          fileName: name,
          fileSizeBytes,
          mimeType:
            assetType === 'orthomosaic' || assetType === 'dsm_raster'
              ? 'image/tiff'
              : 'application/octet-stream',
          checksumSha256: computedSha256,
          isPrimary: true,
        }),
      });

      setIsUploadModalOpen(false);
      setFileName('');
      const detail = await apiFetch<any>(`/surveys/${activeSurvey.id}`);
      setActiveSurvey(detail);
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  // 3. Trigger Processing Pipeline Handler
  const handleTriggerProcess = async (surveyId: string) => {
    setIsProcessing(true);
    try {
      await apiFetch(`/surveys/${surveyId}/process`, {
        method: 'POST',
        body: JSON.stringify({ jobType: 'photogrammetry_ingest' }),
      });
      const detail = await apiFetch<any>(`/surveys/${surveyId}`);
      setActiveSurvey(detail);
      await loadSurveys();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardLayout
      areas={areas}
      selectedAreaId={selectedAreaId}
      onSelectArea={setSelectedAreaId}
    >
      <PageHeader
        title="รอบการสำรวจและชุดข้อมูลผลลัพธ์ (Drone Deliverables)"
        description="จัดเก็บภาพถ่ายออร์โธโมเสก, โมเดลระดับความสูง DSM/DTM, 3D Tiles และไฟล์เวกเตอร์ใน S3 Object Storage"
        icon={Layers}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'รอบบินสำรวจและไฟล์โดรน' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              disabled={!selectedAreaId}
              onClick={() => setIsCreateSurveyModalOpen(true)}
              variant="primary"
              className="gap-2 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรอบบินสำรวจใหม่ (New Survey)</span>
            </Button>
            {activeSurvey && (
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                variant="outline"
                className="gap-2 text-xs font-semibold"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>เพิ่มไฟล์ Deliverable</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Area Selector Pill Tabs */}
      {areas.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border text-xs">
          <span className="text-muted-foreground text-xs font-medium mr-1 shrink-0">
            เลือกพื้นที่:
          </span>
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAreaId(a.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all border shrink-0 cursor-pointer',
                a.id === selectedAreaId
                  ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-sm'
                  : 'bg-card text-foreground hover:bg-card-secondary border-border'
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-3">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
          <div className="text-sm font-bold text-foreground">ยังไม่มีพื้นที่ในการดูแล</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            เริ่มต้นด้วยการสร้างพื้นที่ในการดูแลก่อน เพื่อกำหนดขอบเขตพิกัด PostGIS สำหรับการสำรวจทางอากาศ
          </p>
          <Link
            href="/areas"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างพื้นที่ดูแลใหม่ที่หน้าจัดการพื้นที่</span>
          </Link>
        </div>
      )}

      {/* Main Layout Grid */}
      {areas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Survey Timeline List */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                ประวัติรอบการบินสำรวจ ({surveys.length})
              </h3>
              <button
                onClick={() => setIsCreateSurveyModalOpen(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มรอบบิน
              </button>
            </div>

            {surveys.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-3 border border-dashed border-border rounded-xl">
                <Clock className="w-6 h-6 mx-auto text-muted-foreground" />
                <div>ยังไม่มีรอบการสำรวจสำหรับพื้นที่นี้</div>
                <Button
                  onClick={() => setIsCreateSurveyModalOpen(true)}
                  variant="primary"
                  size="sm"
                >
                  + เพิ่มรอบบินสำรวจแรก
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {surveys.map((s) => {
                  const isSelected = activeSurvey?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSurvey(s.id)}
                      className={cn(
                        'w-full text-left p-3.5 rounded-xl border text-xs transition-all space-y-1.5 block cursor-pointer',
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                          : 'bg-card border-border hover:border-primary/40 text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-primary">{s.surveyCode}</span>
                        <Badge
                          variant={s.processingStatus === 'completed' ? 'success' : 'warning'}
                          className="text-[10px]"
                        >
                          {s.processingStatus}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>วันที่: {new Date(s.surveyDate).toLocaleDateString('th-TH')}</span>
                        <span>•</span>
                        <span>{s.droneModel || 'DJI Drone'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Right Columns: Active Survey Details & Deliverables */}
          <div className="lg:col-span-2 space-y-5">
            {activeSurvey ? (
              <>
                {/* Survey Metadata Card */}
                <Card className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="text-[10px] font-mono text-primary uppercase font-bold">
                        รหัสรอบสำรวจ: {activeSurvey.surveyCode}
                      </div>
                      <h2 className="text-lg font-bold text-foreground">
                        {activeSurvey.areaName || 'พื้นที่สำรวจ'}
                      </h2>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ทำการบินวันที่:{' '}
                        {new Date(activeSurvey.surveyDate).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleTriggerProcess(activeSurvey.id)}
                        disabled={isProcessing}
                        isLoading={isProcessing}
                        variant="primary"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>เริ่มกระบวนการ Photogrammetry Pipeline</span>
                      </Button>
                    </div>
                  </div>

                  {/* Technical Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-card-secondary rounded-xl border border-border">
                      <div className="text-[10px] text-muted-foreground">รุ่นอากาศยานโดรน</div>
                      <div className="font-semibold text-foreground mt-0.5 truncate">
                        {activeSurvey.droneModel || 'N/A'}
                      </div>
                    </div>
                    <div className="p-3 bg-card-secondary rounded-xl border border-border">
                      <div className="text-[10px] text-muted-foreground">ชนิดกล้อง / เซนเซอร์</div>
                      <div className="font-semibold text-foreground mt-0.5 truncate">
                        {activeSurvey.sensorType || 'N/A'}
                      </div>
                    </div>
                    <div className="p-3 bg-card-secondary rounded-xl border border-border">
                      <div className="text-[10px] text-muted-foreground">ความสูงการบิน (Altitude)</div>
                      <div className="font-semibold text-primary font-mono mt-0.5">
                        {activeSurvey.flightAltitudeM ? `${activeSurvey.flightAltitudeM} ม.` : '120 ม.'}
                      </div>
                    </div>
                    <div className="p-3 bg-card-secondary rounded-xl border border-border">
                      <div className="text-[10px] text-muted-foreground">ความละเอียดภาพพื้นดิน GSD</div>
                      <div className="font-semibold text-primary font-mono mt-0.5">
                        {activeSurvey.groundSampleDistanceCm
                          ? `${activeSurvey.groundSampleDistanceCm} ซม./พิกเซล`
                          : '2.5 ซม./พิกเซล'}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Assets Card */}
                <Card className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-primary" />
                      ไฟล์ผลลัพธ์ใน Object Storage ({activeSurvey.assets?.length || 0})
                    </h3>
                    <Button
                      onClick={() => setIsUploadModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      เพิ่มไฟล์ผลลัพธ์
                    </Button>
                  </div>

                  {!activeSurvey.assets || activeSurvey.assets.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl space-y-2">
                      <div>ยังไม่มีไฟล์ผลลัพธ์ที่ลงทะเบียนสำหรับรอบการสำรวจนี้</div>
                      <Button
                        onClick={() => setIsUploadModalOpen(true)}
                        variant="primary"
                        size="sm"
                      >
                        + อัปโหลดไฟล์ Deliverable แรก
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeSurvey.assets.map((ass: any) => (
                        <div
                          key={ass.id}
                          className="p-3 bg-card-secondary border border-border rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                              {ass.assetType === 'tiles_3d' ? (
                                <Boxes className="w-4 h-4" />
                              ) : ass.assetType === 'geojson_vector' ? (
                                <FileCode className="w-4 h-4" />
                              ) : (
                                <Layers className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{ass.fileName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ประเภท: {ass.assetType} • ขนาด:{' '}
                                {(ass.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                              </div>
                            </div>
                          </div>

                          <Badge variant="success" className="text-[10px]">
                            พร้อมแสดงผลบน 3D Map
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center text-muted-foreground text-sm">
                เลือกรอบบินสำรวจเพื่อดูไฟล์ผลลัพธ์ หรือคลิกปุ่ม &quot;เพิ่มรอบบินสำรวจใหม่&quot;
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Create New Survey Round */}
      <Modal
        isOpen={isCreateSurveyModalOpen}
        onClose={() => setIsCreateSurveyModalOpen(false)}
        title="ลงทะเบียนรอบการบินสำรวจใหม่ (New Survey Round)"
        description="ระบุข้อมูลเที่ยวบินและคุณสมบัติเซนเซอร์ของโดรน"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSurvey} className="space-y-4">
          <FormField label="รหัสรอบสำรวจ (Survey Code)" required>
            <Input
              required
              placeholder="เช่น SURV-MTP-2026-001"
              value={surveyCode}
              onChange={(e) => setSurveyCode(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="วันที่ทำการบิน" required>
              <Input
                type="date"
                required
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
              />
            </FormField>
            <FormField label="รุ่นอากาศยานโดรน">
              <Input
                value={droneModel}
                onChange={(e) => setDroneModel(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="ความสูงการบิน (เมตร)">
              <Input
                type="number"
                value={flightAltitudeM}
                onChange={(e) => setFlightAltitudeM(Number(e.target.value))}
              />
            </FormField>
            <FormField label="GSD (ซม./พิกเซล)">
              <Input
                type="number"
                step="0.1"
                value={gsdCm}
                onChange={(e) => setGsdCm(Number(e.target.value))}
              />
            </FormField>
          </div>

          <FormField label="ชนิดกล้อง / เลนส์">
            <Input
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateSurveyModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary">
              บันทึกรอบบิน
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Deliverable Asset Upload */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="ลงทะเบียนไฟล์ Deliverable ผลลัพธ์โดรน"
        description="นำเข้าไฟล์ Orthomosaic GeoTIFF, DSM Raster หรือ 3D Tiles"
        maxWidth="md"
      >
        <form onSubmit={handleUploadAsset} className="space-y-4">
          <FormField label="ประเภทไฟล์ Deliverable" required>
            <Select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
            >
              <option value="orthomosaic">Orthophoto / Orthomosaic (GeoTIFF)</option>
              <option value="dsm_raster">Digital Surface Model - DSM (GeoTIFF)</option>
              <option value="tiles_3d">Cesium 3D Tiles (b3dm / tileset.json)</option>
              <option value="geojson_vector">Vector Footprint / Boundaries (GeoJSON)</option>
            </Select>
          </FormField>

          <FormField label="ชื่อไฟล์เอกสาร (File Name)">
            <Input
              placeholder={`เช่น mtp_ortho_${Date.now()}.tif`}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </FormField>

          <FormField label="ขนาดไฟล์โดยประมาณ (MB)">
            <Input
              type="number"
              value={fileSizeMb}
              onChange={(e) => setFileSizeMb(Number(e.target.value))}
            />
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary">
              ยืนยันการลงทะเบียนไฟล์
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
