'use client';

import React from 'react';
import { Calendar, ChevronRight, Sliders, CheckCircle2, AlertTriangle, Layers, Play } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

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
      className="h-28 bg-card/95 border-t border-border text-foreground px-6 py-2.5 flex flex-col justify-between z-20 backdrop-blur-md select-none shadow-2xl"
      role="region"
      aria-label="เส้นเวลาประวัติรอบบินสำรวจ"
    >
      {/* Top Controls: Survey Header and Action Buttons */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">เส้นเวลาประวัติการบินสำรวจ (Historical Timeline)</span>
          <span className="text-muted-foreground text-xs">({surveys.length} รอบการสำรวจ)</span>
        </div>

        {onRunComparison && (
          <Button
            variant="primary"
            size="md"
            onClick={onRunComparison}
            disabled={!baselineSurveyId || !comparisonSurveyId || baselineSurveyId === comparisonSurveyId}
            className="text-xs font-bold"
          >
            <Play className="w-4 h-4 fill-current mr-1.5" />
            เปรียบเทียบการเปลี่ยนแปลง (Analyze Changes)
          </Button>
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
                  ? 'bg-primary/10 border-primary text-foreground shadow-sm ring-1 ring-primary'
                  : isComparison
                  ? 'bg-info/10 border-info text-foreground shadow-sm ring-1 ring-info'
                  : 'bg-card-secondary border-border hover:border-primary/40 text-foreground'
              }`}
            >
              <div className="flex flex-col">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span>{formattedDate}</span>
                  {survey.processingStatus === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
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
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    isBaseline
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-card text-muted-foreground hover:text-primary hover:bg-muted border border-border'
                  }`}
                >
                  ฐาน (Base)
                </button>
                <button
                  onClick={() => onSelectComparison && onSelectComparison(survey.id)}
                  title="กำหนดเป็นภาพเปรียบเทียบ (Set as Comparison)"
                  aria-label={`กำหนดรอบบิน ${survey.surveyCode} เป็นภาพเปรียบเทียบ`}
                  aria-pressed={isComparison}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    isComparison
                      ? 'bg-info text-info-foreground shadow-sm'
                      : 'bg-card text-muted-foreground hover:text-info hover:bg-muted border border-border'
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
