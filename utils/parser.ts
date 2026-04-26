// utils/parser.ts

import Papa from "papaparse";
import { Agent, Segment, SegmentCategory, Requirement } from "@/types/wfm";

const generateId = () => Math.random().toString(36).substring(2, 11);

const getCategoryAndType = (
  segmentName: string,
  containerName: string,
): { category: SegmentCategory; isGeneral: boolean; isPaid: boolean } => {
  const cont = containerName.toUpperCase();
  const seg = segmentName.toUpperCase();

  const isPaid = !(cont.includes("UNPAY") || cont.includes("UNPAID"));

  // FIXED: Strict exact-matching to prevent accidentally hiding valid TN-Work shifts
  if (
    seg === "WW-SHIFT" ||
    cont === "WW-CONTAINER" ||
    cont.includes("INFO") ||
    seg.startsWith("WW-I-")
  ) {
    return { category: "Work", isGeneral: true, isPaid };
  }

  if (cont.includes("ABSOFFWORK")) {
    return { category: "Absence", isGeneral: false, isPaid };
  }

  if (cont.includes("ABSONWORK")) {
    if (!isPaid) return { category: "Lunch", isGeneral: false, isPaid };
    if (
      seg.includes("MEET") ||
      seg.includes("TRAIN") ||
      seg.includes("COACH")
    ) {
      return { category: "Meeting", isGeneral: false, isPaid };
    }
    return { category: "Break", isGeneral: false, isPaid };
  }

  return { category: "Work", isGeneral: false, isPaid: true };
};

const timeToMins = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleanStr = timeStr
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toUpperCase();
  const timeParts = cleanStr.split(" ")[0].split(":");
  let hours = parseInt(timeParts[0], 10) || 0;
  const minutes = parseInt(timeParts[1], 10) || 0;

  if (cleanStr.includes("PM") && hours < 12) hours += 12;
  if (cleanStr.includes("AM") && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const fetchRawCSV = async (): Promise<string> => {
  try {
    const res = await fetch(`/Schedule.csv?t=${Date.now()}`);
    if (!res.ok) throw new Error("File not found");
    return await res.text();
  } catch (e) {
    console.error("Failed to load /Schedule.csv", e);
    return "";
  }
};

const fetchRequirementsCSV = async (): Promise<string> => {
  try {
    const res = await fetch(`/Requirements.csv?t=${Date.now()}`);
    if (!res.ok) return "";
    return await res.text();
  } catch (e) {
    console.error("Failed to load /Requirements.csv", e);
    return "";
  }
};

export const fetchAvailableDates = async (): Promise<string[]> => {
  const csvText = await fetchRawCSV();
  const { data } = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const dates = new Set<string>();

  for (let i = 1; i < data.length; i++) {
    const dateValue = data[i][5]?.trim();
    if (dateValue && dateValue.includes("-")) dates.add(dateValue);
  }

  return Array.from(dates).sort();
};

export const parseScheduleData = async () => {
  const csvText = await fetchRawCSV();
  const { data: lines } = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const agents: Record<string, Agent> = {};
  const segments: Record<string, Segment> = {};
  const requirements: Record<string, Requirement> = {};

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i];
    if (columns.length < 8) continue;

    const agentId = columns[0]?.trim();
    const agentName = columns[1]?.trim() || "Unknown";
    const segmentName = columns[2]?.trim() || "";
    const containerName = columns[3]?.trim() || "";
    const rank = parseInt(columns[4]) || 1;
    const rowDate = columns[5]?.trim();
    const startStr = columns[6]?.trim();
    const endStr = columns[7]?.trim();

    if (!startStr || !endStr) continue;

    if (!agents[agentId]) {
      agents[agentId] = { id: agentId, name: agentName, segments: [] };
    }

    const startMin = timeToMins(startStr);
    let endMin = timeToMins(endStr);
    if (endMin < startMin) endMin += 1440;

    const { category, isGeneral, isPaid } = getCategoryAndType(
      segmentName,
      containerName,
    );

    const segId = generateId();
    segments[segId] = {
      id: segId,
      agentId,
      name: segmentName,
      category,
      isGeneral,
      isPaid,
      date: rowDate,
      startMin,
      endMin,
      rank,
    };
    agents[agentId].segments.push(segId);
  }

  const reqCsvText = await fetchRequirementsCSV();
  if (reqCsvText) {
    const { data: reqLines } = Papa.parse<string[]>(reqCsvText, {
      skipEmptyLines: true,
    });
    for (let i = 1; i < reqLines.length; i++) {
      const columns = reqLines[i];
      if (columns.length < 3) continue;

      const reqDate = columns[0]?.trim();
      const slotStr = columns[1]?.trim();
      const reqVal = parseFloat(columns[2]?.trim()) || 0;

      if (reqDate && slotStr) {
        requirements[`${reqDate}_${timeToMins(slotStr)}`] = {
          date: reqDate,
          timeMin: timeToMins(slotStr),
          req: reqVal,
        };
      }
    }
  }

  return { agents, segments, requirements };
};
