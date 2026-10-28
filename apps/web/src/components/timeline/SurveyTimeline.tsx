'use client';

import React from 'react';
import { Calendar, ChevronRight, Sliders, CheckCircle2, AlertTriangle, Layers, Play } from 'lucide-react';

export interface TimelineSurvey {
  id: string;
  surveyCode: string;
  surveyDate: string;
  droneModel: string | null;
  groundSampleDistanceCm: number | null;
  flightAltitudeM: number | null;
  processingStatus: string;
}

interface SurveyTimelineProps {
  surveys?: TimelineSurvey[];
  baselineSurveyId?: string | null;
  comparisonSurveyId?: string | null;
  onSelectBaseline?: (id: string) => void;
  onSelectComparison?: (id: string) => void;
  onRunComparison?: () => void;
}

export default function SurveyTimeline({
  surveys = [],
  baselineSurveyId,
  comparisonSurveyId,
  onSelectBaseline,
  onSelectComparison,
  onRunComparison,
}: SurveyTimelineProps) {
  if (surveys.length === 0) {
    return null;
  }

  return (
    <div
      className="h-28 bg-[#101A2D]/95 border-t border-[rgba(148,163,184,0.20)] px-6 py-2.5 flex flex-col justify-between z-20 backdrop-blur-md select-none shadow-2xl"
      role="region"
      aria-label="เส้นเวลาประวัติรอบบินสำรวจ"
    >
      {/* Top Controls: Survey Header and Action Buttons */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#06B6D4]" />
          <span className="font-bold text-[#F1F5F9]">เส้นเวลาประวัติการบินสำรวจ (Historical Timeline)</span>
          <span className="text-[#94A3B8] text-xs">({surveys.length} รอบการสำรวจ)</span>
        </div>

        {onRunComparison && (
          <button
            onClick={onRunComparison}
            disabled={!baselineSurveyId || !comparisonSurveyId || baselineSurveyId === comparisonSurveyId}
            className="min-h-[44px] px-4 py-2 bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 text-[#080F20] font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.35)] focus-visible:ring-2 focus-visible:ring-[#22D3EE] cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            เปรียบเทียบการเปลี่ยนแปลง (Analyze Changes)
          </button>
        )}
      </div>

      {/* Timeline Steps / Dates */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {surveys.map((survey) => {
          const isBaseline = survey.id === baselineSurveyId;
          const isComparison = survey.id === comparisonSurveyId;
          const formattedDate = new Date(survey.surveyDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={survey.id}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl border text-xs transition-all flex items-center gap-3 ${
                isBaseline
                  ? 'bg-[#1C2940] border-[#3B82F6] text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] ring-1 ring-[#3B82F6]'
                  : isComparison
                  ? 'bg-[#1C2940] border-[#06B6D4] text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1 ring-[#06B6D4]'
                  : 'bg-[#162238]/80 border-[rgba(148,163,184,0.15)] hover:border-[rgba(148,163,184,0.3)] text-[#CBD5E1]'
              }`}
            >
              <div className="flex flex-col">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span>{formattedDate}</span>
                  {survey.processingStatus === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  )}
                </div>
                <div className="text-[11px] text-[#94A3B8] font-mono mt-0.5">
                  {survey.surveyCode} • GSD {survey.groundSampleDistanceCm || 2.4}cm
                </div>
              </div>

              {/* Baseline / Comparison Toggle Buttons (Accessible Targets) */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onSelectBaseline && onSelectBaseline(survey.id)}
                  title="กำหนดเป็นภาพตั้งต้น (Set as Baseline)"
                  aria-label={`กำหนดรอบบิน ${survey.surveyCode} เป็นภาพตั้งต้น`}
                  aria-pressed={isBaseline}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-[#3B82F6] cursor-pointer ${
                    isBaseline
                      ? 'bg-[#3B82F6] text-white shadow-md'
                      : 'bg-[#101A2D] text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#162238] border border-[rgba(148,163,184,0.2)]'
                  }`}
                >
                  ฐาน (Base)
                </button>
                <button
                  onClick={() => onSelectComparison && onSelectComparison(survey.id)}
                  title="กำหนดเป็นภาพเปรียบเทียบ (Set as Comparison)"
                  aria-label={`กำหนดรอบบิน ${survey.surveyCode} เป็นภาพเปรียบเทียบ`}
                  aria-pressed={isComparison}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-[#06B6D4] cursor-pointer ${
                    isComparison
                      ? 'bg-[#06B6D4] text-[#080F20] shadow-md'
                      : 'bg-[#101A2D] text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#162238] border border-[rgba(148,163,184,0.2)]'
                  }`}
                >
                  เทียบ (Cmp)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
