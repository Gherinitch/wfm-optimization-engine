// utils/parser.ts

import { Agent, Segment, SegmentCategory, Requirement } from "@/types/wfm";

const generateId = () => Math.random().toString(36).substring(2, 11);

const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let inQuotes = false;
  let currentWord = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(currentWord);
      currentWord = "";
    } else {
      currentWord += char;
    }
  }
  result.push(currentWord);
  return result;
};

const getCategoryAndType = (
  segmentName: string,
  containerName: string,
): { category: SegmentCategory; isGeneral: boolean; isPaid: boolean } => {
  const cont = containerName.toUpperCase();
  const seg = segmentName.toUpperCase();

  // 1. Determine Paid Status
  const isPaid = !(cont.includes("UNPAY") || cont.includes("UNPAID"));

  // 2. Invisible Structural Containers
  // We only hide it if the SEGMENT itself is called "SHIFT" or it's explicitly an "INFO" wrapper.
  // This protects your actual campaign Work blocks from being hidden!
  if (
    seg === "WW-SHIFT" ||
    cont.includes("CONTAINER") ||
    cont.includes("INFO") ||
    seg.startsWith("WW-I-")
  ) {
    return { category: "Work", isGeneral: true, isPaid };
  }

  // 3. Absences (Off-Work Exceptions)
  if (cont.includes("ABSOFFWORK")) {
    return { category: "Absence", isGeneral: false, isPaid };
  }

  // 4. On-Work Exceptions (Breaks, Lunches, Meetings)
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

  // 5. Default: Productive Work!
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

// --- EXPORTED PARSERS ---

export const fetchAvailableDates = async (): Promise<string[]> => {
  const csvText = await fetchRawCSV();
  const lines = csvText.split("\n").filter((line) => line.trim() !== "");

  const dates = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const columns = splitCsvLine(lines[i]);
    const dateValue = columns[5]?.trim();
    if (dateValue && dateValue.includes("-")) dates.add(dateValue);
  }

  return Array.from(dates).sort();
};

export const parseScheduleData = async (currentDate: string) => {
  const csvText = await fetchRawCSV();
  const lines = csvText.split("\n").filter((line) => line.trim() !== "");

  const agents: Record<string, Agent> = {};
  const segments: Record<string, Segment> = {};
  const requirements: Record<string, Requirement> = {};

  // DIAGNOSTIC LOGGER: Maps every unique segment configuration to see how the engine categorizes it
  const diagnosticLog = new Map<string, any>();

  for (let i = 1; i < lines.length; i++) {
    const columns = splitCsvLine(lines[i]);
    if (columns.length < 8) continue;

    const agentId = columns[0].trim();
    const agentName = columns[1].trim();
    const segmentName = columns[2].trim();
    const containerName = columns[3].trim();
    const rank = parseInt(columns[4]) || 1;
    const rowDate = columns[5].trim();
    const startStr = columns[6]?.trim();
    const endStr = columns[7]?.trim();

    if (!startStr || !endStr) continue;

    if (!agents[agentId]) {
      agents[agentId] = {
        id: agentId,
        name: agentName.replace(",", " "),
        segments: [],
      };
    }

    let startMin = timeToMins(startStr);
    let endMin = timeToMins(endStr);

    if (endMin < startMin) {
      endMin += 1440;
    }

    const { category, isGeneral, isPaid } = getCategoryAndType(
      segmentName,
      containerName,
    );

    // Log the configuration for this specific combination of Segment + Container
    const logKey = `${segmentName} | ${containerName}`;
    if (!diagnosticLog.has(logKey)) {
      diagnosticLog.set(logKey, {
        Segment: segmentName,
        Container: containerName,
        AssignedCategory: category,
        IsHiddenWrapper: isGeneral,
        IsPaid: isPaid,
        Rank: rank,
      });
    }

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

  // OUTPUT THE LOGS
  console.group("🧩 eWFM Parser Diagnostics");
  console.log("Here is exactly how the engine mapped your CSV data:");
  console.table(Array.from(diagnosticLog.values()));
  console.groupEnd();

  const reqCsvText = await fetchRequirementsCSV();
  if (reqCsvText) {
    const reqLines = reqCsvText
      .split("\n")
      .filter((line) => line.trim() !== "");

    for (let i = 1; i < reqLines.length; i++) {
      const columns = splitCsvLine(reqLines[i]);
      if (columns.length < 3) continue;

      const reqDate = columns[0].trim();
      const slotStr = columns[1].trim();
      const reqVal = parseFloat(columns[2].trim()) || 0;

      const timeMin = timeToMins(slotStr);
      requirements[`${reqDate}_${timeMin}`] = {
        date: reqDate,
        timeMin,
        req: reqVal,
      };
    }
  }

  return { agents, segments, requirements };
};
