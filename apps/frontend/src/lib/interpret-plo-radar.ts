import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScaleAgainstThreshold, percentToFiveScale } from './five-scale';

// Fully deterministic, rule-based replacement for the real AI call
// (GET /ai-analysis/student/:id) — no network, no cost, same output shape
// as AiSkillAnalysisReport minus studentProfileId/generatedAt. Given the
// same radar+threshold, always produces the exact same text.
export interface PloInterpretation {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// Same fallback text AiAnalysisService uses for hasNoGradedData, kept
// verbatim so the "no data yet" experience is identical to the real
// endpoint's. Exported so callers (PloInterpretationCard) can detect the
// no-data case and render a dedicated empty state instead of the bullet
// list layout.
export const NO_DATA_SUMMARY = 'ยังไม่มีข้อมูลผลการเรียนเพียงพอสำหรับการวิเคราะห์';

const SUMMARY_TEMPLATES: Record<'excellent' | 'good' | 'average' | 'needsWork', string[]> = {
  excellent: [
    'จากผลการเรียนในภาพรวม นักศึกษามีผลสัมฤทธิ์เฉลี่ยอยู่ในระดับโดดเด่นที่ {avg} จาก PLO ทั้งหมด {count} ด้าน',
    'ข้อมูลผลการเรียนที่ผ่านมาบ่งชี้ว่านักศึกษามีผลสัมฤทธิ์ในระดับสูงมาก เฉลี่ย {avg} จาก PLO ทั้งหมด {count} ด้าน',
  ],
  good: [
    'จากผลการเรียนในภาพรวม นักศึกษามีผลสัมฤทธิ์เฉลี่ยอยู่ในเกณฑ์ดีที่ {avg} จาก PLO ทั้งหมด {count} ด้าน',
    'ข้อมูลผลการเรียนที่ผ่านมาบ่งชี้ว่านักศึกษามีผลสัมฤทธิ์อยู่ในเกณฑ์ดี เฉลี่ย {avg} จาก PLO ทั้งหมด {count} ด้าน',
  ],
  average: [
    'จากผลการเรียนในภาพรวม นักศึกษามีผลสัมฤทธิ์เฉลี่ยอยู่ในระดับปานกลางที่ {avg} จาก PLO ทั้งหมด {count} ด้าน',
    'ข้อมูลผลการเรียนที่ผ่านมาบ่งชี้ว่านักศึกษามีผลสัมฤทธิ์ในระดับปานกลาง เฉลี่ย {avg} จาก PLO ทั้งหมด {count} ด้าน',
  ],
  needsWork: [
    'จากผลการเรียนในภาพรวม นักศึกษามีผลสัมฤทธิ์เฉลี่ยอยู่ที่ {avg} จาก PLO ทั้งหมด {count} ด้าน ซึ่งมีแนวโน้มว่าควรพัฒนาเพิ่มเติม',
    'ข้อมูลผลการเรียนที่ผ่านมาบ่งชี้ว่านักศึกษามีผลสัมฤทธิ์เฉลี่ย {avg} จาก PLO ทั้งหมด {count} ด้าน อยู่ในระดับที่ควรพัฒนาต่อไป',
  ],
};

const STRENGTH_TEMPLATES = [
  'จากข้อมูลผลการเรียนที่เกี่ยวข้องกับ {name} นักศึกษามีผลสัมฤทธิ์อยู่ในระดับสูง ({value})',
  'ผลสัมฤทธิ์ในด้าน {name} อยู่ในระดับที่น่าพอใจ ({value}) จาก CLO ที่เกี่ยวข้อง',
  '{name} เป็นจุดแข็งที่บ่งชี้จากผลการเรียน โดยมีผลสัมฤทธิ์ {value}',
];

const WEAKNESS_TEMPLATES = [
  'ผลสัมฤทธิ์ในด้าน {name} อยู่ในระดับ {value} ซึ่งต่ำกว่าเกณฑ์ที่กำหนด',
  'จาก CLO ที่เกี่ยวข้องกับ {name} พบว่าผลสัมฤทธิ์อยู่ที่ {value} ยังไม่ถึงเกณฑ์',
  'มีแนวโน้มว่า {name} เป็นด้านที่ควรพัฒนาเพิ่มเติม อยู่ในระดับ {value}',
];

const NO_DATA_WEAKNESS = 'ยังไม่มีข้อมูลเพียงพอสำหรับ {name}';

const RECOMMENDATION_TEMPLATES = [
  'ควรพิจารณาเสริมความรู้และฝึกฝนเพิ่มเติมในด้าน {name}',
  'แนะนำให้ทบทวนเนื้อหาที่เกี่ยวข้องกับ {name} เพื่อพัฒนาผลสัมฤทธิ์ในด้านนี้',
  'ควรให้ความสำคัญกับการพัฒนาด้าน {name} เป็นลำดับถัดไป',
];

const RECOMMENDATION_FALLBACK =
  'ผลการเรียนโดยรวมอยู่ในเกณฑ์ดีทุกด้าน ควรรักษาระดับผลสัมฤทธิ์นี้ต่อไป';

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function pick(templates: string[], index: number): string {
  return templates[index % templates.length];
}

export function interpretPloRadar(radar: RadarPoint[], threshold: number): PloInterpretation {
  const graded = radar.filter((p): p is RadarPoint & { value: number } => p.value !== null);

  if (graded.length === 0) {
    return { summary: NO_DATA_SUMMARY, strengths: [], weaknesses: [], recommendations: [] };
  }

  // Band selection and strong/weak filtering compare against the raw
  // percent threshold — unchanged, internal logic only. Only the numbers
  // actually filled into the sentence templates convert to the 1-5 scale.
  const avg = graded.reduce((sum, p) => sum + p.value, 0) / graded.length;
  const band = avg >= threshold + 15 ? 'excellent' : avg >= threshold ? 'good' : avg >= 40 ? 'average' : 'needsWork';
  const summary = fill(pick(SUMMARY_TEMPLATES[band], 0), {
    avg: formatFiveScaleAgainstThreshold(avg, threshold, avg >= threshold),
    count: radar.length.toString(),
  });

  const strong = graded.filter((p) => p.value >= threshold).sort((a, b) => b.value - a.value).slice(0, 4);
  const weakGraded = graded.filter((p) => p.value < threshold).sort((a, b) => a.value - b.value);
  const ungraded = radar.filter((p) => p.value === null);
  const weak = [...weakGraded, ...ungraded].slice(0, 4);

  const strengths = strong.map((p, i) =>
    fill(pick(STRENGTH_TEMPLATES, i), { name: p.name, value: percentToFiveScale(p.value).toFixed(1) }),
  );

  const weaknesses = weak.map((p, i) => {
    if (p.value === null) {
      return fill(NO_DATA_WEAKNESS, { name: p.name });
    }
    return fill(pick(WEAKNESS_TEMPLATES, i), {
      name: p.name,
      value: formatFiveScaleAgainstThreshold(p.value, threshold, false),
    });
  });

  const recommendations = weakGraded
    .slice(0, 4)
    .map((p, i) => fill(pick(RECOMMENDATION_TEMPLATES, i), { name: p.name }));

  return {
    summary,
    strengths,
    weaknesses,
    recommendations: recommendations.length > 0 ? recommendations : [RECOMMENDATION_FALLBACK],
  };
}
