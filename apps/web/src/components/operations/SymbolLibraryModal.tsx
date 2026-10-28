'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Grid,
  List,
  Star,
  Clock,
  Plus,
  X,
  Upload,
  Check,
  AlertCircle,
  Folder,
  Tag,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SymbolCatalogDTO, SymbolCategory, SYMBOL_CATEGORIES, SYMBOL_CATEGORY_LABELS } from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';
import { SymbolIcon } from './SymbolIcon';

interface SymbolLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: SymbolCatalogDTO) => void;
}

export default function SymbolLibraryModal({
  isOpen,
  onClose,
  onSelectSymbol,
}: SymbolLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'favorites' | 'recent' | 'create'>('catalog');
  const [symbols, setSymbols] = useState<SymbolCatalogDTO[]>([]);
  const [favorites, setFavorites] = useState<SymbolCatalogDTO[]>([]);
  const [recentSymbols, setRecentSymbols] = useState<SymbolCatalogDTO[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom symbol form state
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCategory, setCustomCategory] = useState<SymbolCategory>('custom_symbols');
  const [customIconKey, setCustomIconKey] = useState('map-pin');
  const [customColor, setCustomColor] = useState('#00f0ff');
  const [customSize, setCustomSize] = useState(24);
  const [customRotation, setCustomRotation] = useState(0);
  const [customTags, setCustomTags] = useState('custom, map');
  const [customSvg, setCustomSvg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // Load symbols based on active tab
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        if (activeTab === 'catalog') {
          const res = await apiFetch<SymbolCatalogDTO[]>('/symbols');
          setSymbols(Array.isArray(res) ? res : []);
        } else if (activeTab === 'favorites') {
          const res = await apiFetch<SymbolCatalogDTO[]>('/symbols/favorites');
          setFavorites(Array.isArray(res) ? res : []);
        } else if (activeTab === 'recent') {
          const res = await apiFetch<SymbolCatalogDTO[]>('/symbols/recent');
          setRecentSymbols(Array.isArray(res) ? res : []);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลสัญลักษณ์ได้');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [isOpen, activeTab]);

  // Toggle Favorite
  const handleToggleFavorite = async (symbol: SymbolCatalogDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = !!symbol.isFavorite;
    try {
      if (isFav) {
        await apiFetch(`/symbols/${symbol.id}/favorite`, { method: 'DELETE' });
      } else {
        await apiFetch(`/symbols/${symbol.id}/favorite`, { method: 'POST' });
      }

      // Update local state in all lists
      const updater = (list: SymbolCatalogDTO[]) =>
        list.map((s) => (s.id === symbol.id ? { ...s, isFavorite: !isFav } : s));
      setSymbols(updater);
      setRecentSymbols(updater);
      if (isFav) {
        setFavorites((prev) => prev.filter((s) => s.id !== symbol.id));
      } else {
        setFavorites((prev) => [{ ...symbol, isFavorite: true }, ...prev]);
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  // Filter symbols
  const displayedSymbols = useMemo(() => {
    let sourceList: SymbolCatalogDTO[] = [];
    if (activeTab === 'catalog') sourceList = symbols;
    else if (activeTab === 'favorites') sourceList = favorites;
    else if (activeTab === 'recent') sourceList = recentSymbols;

    return sourceList.filter((s) => {
      // Category filter
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesc = s.description?.toLowerCase().includes(q);
        const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCat = s.category.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTags && !matchesCat) {
          return false;
        }
      }
      return true;
    });
  }, [symbols, favorites, recentSymbols, activeTab, selectedCategory, searchQuery]);

  // Handle custom SVG file upload
  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      alert('กรุณาเลือกไฟล์รูปแบบ .svg เท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomSvg(content);
    };
    reader.readAsText(file);
  };

  // Create custom symbol
  const handleCreateCustomSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setErrorMsg('กรุณากรอกชื่อสัญลักษณ์');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setCreateSuccessMsg(null);

    try {
      const tagList = customTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: customName.trim(),
        description: customDesc.trim() || undefined,
        category: customCategory,
        iconKey: customIconKey.trim() || 'map-pin',
        defaultColor: customColor,
        defaultSize: Number(customSize),
        defaultRotation: Number(customRotation),
        tags: tagList,
        svgContent: customSvg.trim() || undefined,
      };

      const res = await apiFetch<SymbolCatalogDTO>('/symbols', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreateSuccessMsg('สร้างสัญลักษณ์ใหม่เรียบร้อยแล้ว');
      setSymbols((prev) => [res, ...prev]);

      // Reset form
      setCustomName('');
      setCustomDesc('');
      setCustomSvg('');
      setTimeout(() => {
        setActiveTab('catalog');
        setCreateSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถสร้างสัญลักษณ์ได้ (อาจมีโค้ดที่ไม่ปลอดภัยในไฟล์ SVG)');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-navy-900 border border-cyan-500/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 bg-navy-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                คลังสัญลักษณ์ทางยุทธวิธีและแผนที่ (Map Symbol Library)
              </h2>
              <p className="text-xs text-slate-400">
                เลือกสัญลักษณ์เพื่อวางลงบนแผนที่ 3 มิติ หรือสร้างสัญลักษณ์เฉพาะของหน่วยงาน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-navy-900 border-b border-navy-800 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              คลังสัญลักษณ์ทั้งหมด
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'favorites'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              รายการโปรด
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'recent'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              ใช้ล่าสุด
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              สร้างสัญลักษณ์กำหนดเอง
            </button>
          </div>

          {activeTab !== 'create' && (
            <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-navy-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${
                  viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองตาราง (Grid View)"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${
                  viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
                }`}
                title="มุมมองรายการ (List View)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'create' ? (
          /* Custom Symbol Creation Form */
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleCreateCustomSymbol} className="max-w-2xl mx-auto space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {createSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{createSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ชื่อสัญลักษณ์ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="เช่น ฐานส่งกำลังบำรุง ฉุกเฉิน"
                    className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">หมวดหมู่</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as SymbolCategory)}
                    className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {SYMBOL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {SYMBOL_CATEGORY_LABELS[cat] || cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">คำอธิบาย</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="รายละเอียดวัตถุประสงค์ หรือการใช้งานสัญลักษณ์"
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    คีย์ไอคอน Lucide
                  </label>
                  <input
                    type="text"
                    value={customIconKey}
                    onChange={(e) => setCustomIconKey(e.target.value)}
                    placeholder="map-pin, shield, truck"
                    className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">สีเริ่มต้น</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded border border-navy-700 bg-navy-950 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ขนาดพิกเซล: {customSize}px
                  </label>
                  <input
                    type="range"
                    min="14"
                    max="64"
                    value={customSize}
                    onChange={(e) => setCustomSize(Number(e.target.value))}
                    className="w-full accent-cyan-400 mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ป้ายกำกับค้นหา (Tags คั่นด้วยจุลภาค)
                </label>
                <input
                  type="text"
                  value={customTags}
                  onChange={(e) => setCustomTags(e.target.value)}
                  placeholder="forward-base, tactical, logistics"
                  className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Custom SVG upload */}
              <div className="border border-dashed border-navy-700 rounded-xl p-4 bg-navy-950/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    อัปโหลดไฟล์ SVG กำหนดเอง (ปลอดภัย ปราศจากสคริปต์)
                  </span>
                  {customSvg && (
                    <button
                      type="button"
                      onClick={() => setCustomSvg('')}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      ล้างไฟล์ SVG
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleSvgFileUpload}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                />
                {customSvg && (
                  <div className="mt-3 p-3 bg-navy-900 rounded-lg border border-navy-700 flex items-center gap-4">
                    <span className="text-xs text-slate-400">พรีวิว SVG:</span>
                    <SymbolIcon svgContent={customSvg} size={32} color={customColor} />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 rounded-lg border border-navy-700 text-xs text-slate-300 hover:bg-navy-800 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-navy-950 text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสัญลักษณ์'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Catalog / Favorites / Recent Browse Mode */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search and Category Filter Toolbar */}
            <div className="p-4 bg-navy-950/60 border-b border-navy-800 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อสัญลักษณ์ คำอธิบาย หรือแท็ก (เช่น บก., ยานพาหนะ, พยาบาล, เสาส่งสัญญาณ)..."
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="w-56 shrink-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">ทุกหมวดหมู่ (All Categories)</option>
                  {SYMBOL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {SYMBOL_CATEGORY_LABELS[cat] || cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gallery Grid / List */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-cyan-400 py-16">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">กำลังโหลดสัญลักษณ์...</span>
                </div>
              ) : displayedSymbols.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 py-16">
                  <AlertCircle className="w-8 h-8 text-slate-500" />
                  <span className="text-sm font-medium">ไม่พบสัญลักษณ์ที่ตรงตามเงื่อนไข</span>
                  <span className="text-xs text-slate-500">
                    ลองค้นหาด้วยคำสำคัญอื่น หรือเลือกหมวดหมู่อื่น
                  </span>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {displayedSymbols.map((symbol) => (
                    <div
                      key={symbol.id}
                      onClick={() => {
                        onSelectSymbol(symbol);
                        onClose();
                      }}
                      className="group relative bg-navy-950 border border-navy-800 hover:border-cyan-500/50 rounded-xl p-3.5 flex flex-col items-center text-center cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5"
                    >
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => handleToggleFavorite(symbol, e)}
                        className={`absolute top-2 right-2 p-1 rounded-md transition-colors ${
                          symbol.isFavorite
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                        }`}
                        title={symbol.isFavorite ? 'นำออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                      >
                        <Star
                          className={`w-4 h-4 ${symbol.isFavorite ? 'fill-amber-400' : ''}`}
                        />
                      </button>

                      {/* Icon Container */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: `${symbol.defaultColor || '#00f0ff'}18`,
                          border: `1px solid ${symbol.defaultColor || '#00f0ff'}40`,
                        }}
                      >
                        <SymbolIcon
                          iconKey={symbol.iconKey}
                          svgContent={symbol.svgContent}
                          color={symbol.defaultColor || '#00f0ff'}
                          size={24}
                        />
                      </div>

                      {/* Name & Category */}
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 line-clamp-1">
                        {symbol.name}
                      </span>
                      <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {SYMBOL_CATEGORY_LABELS[symbol.category] || symbol.category}
                      </span>

                      {/* Tags */}
                      {symbol.tags && symbol.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 justify-center">
                          {symbol.tags.slice(0, 2).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-navy-900 text-slate-400 border border-navy-800"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
                  {displayedSymbols.map((symbol) => (
                    <div
                      key={symbol.id}
                      onClick={() => {
                        onSelectSymbol(symbol);
                        onClose();
                      }}
                      className="group flex items-center justify-between bg-navy-950 border border-navy-800 hover:border-cyan-500/50 rounded-xl px-4 py-2.5 cursor-pointer transition-all hover:bg-navy-900/60"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${symbol.defaultColor || '#00f0ff'}18`,
                            border: `1px solid ${symbol.defaultColor || '#00f0ff'}40`,
                          }}
                        >
                          <SymbolIcon
                            iconKey={symbol.iconKey}
                            svgContent={symbol.svgContent}
                            color={symbol.defaultColor || '#00f0ff'}
                            size={18}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                            {symbol.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {symbol.description || (SYMBOL_CATEGORY_LABELS[symbol.category] || symbol.category)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-navy-900 border border-navy-800 text-slate-400">
                          {SYMBOL_CATEGORY_LABELS[symbol.category] || symbol.category}
                        </span>
                        <button
                          onClick={(e) => handleToggleFavorite(symbol, e)}
                          className={`p-1 rounded-md transition-colors ${
                            symbol.isFavorite
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-slate-600 hover:text-slate-300'
                          }`}
                        >
                          <Star
                            className={`w-4 h-4 ${symbol.isFavorite ? 'fill-amber-400' : ''}`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-navy-800 bg-navy-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            สัญลักษณ์ที่พร้อมใช้งาน:{' '}
            <strong className="text-cyan-400">{displayedSymbols.length}</strong> รายการ
          </span>
          <span className="text-[11px] text-slate-500">
            คลิกสัญลักษณ์ที่ต้องการเพื่อเริ่มโหมดวางตำแหน่งลงบนแผนที่
          </span>
        </div>
      </div>
    </div>
  );
}
