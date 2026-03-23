"use client";

import { useState, useEffect } from "react";
import { useScheduleStore } from "@/store/useScheduleStore";
import { CustomRule, SegmentCategory, RuleBlueprint } from "@/types/wfm";
import Link from "next/link";

const CATEGORIES: SegmentCategory[] = [
  "Work",
  "Break",
  "Lunch",
  "Meeting",
  "Absence",
];
const BLUEPRINTS: { value: RuleBlueprint; label: string }[] = [
  { value: "MAX_DURATION", label: "Maximum Duration limit" },
  { value: "CONTAINMENT", label: "Must be inside another segment" },
  { value: "MIN_WORK_BEFORE", label: "Minimum time before segment starts" },
  { value: "MIN_GAP", label: "Minimum gap between two segments" },
];

export default function ConstraintsPage() {
  const rules = useScheduleStore((state) => state.rules);
  const addRule = useScheduleStore((state) => state.addRule);
  const updateRule = useScheduleStore((state) => state.updateRule);
  const toggleRule = useScheduleStore((state) => state.toggleRule);
  const deleteRule = useScheduleStore((state) => state.deleteRule);

  const [isMounted, setIsMounted] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [blueprint, setBlueprint] = useState<RuleBlueprint>("MAX_DURATION");
  const [target, setTarget] = useState<SegmentCategory>("Work");
  const [reference, setReference] = useState<SegmentCategory>("Work");

  const [hours, setHours] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleEditClick = (rule: CustomRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setBlueprint(rule.blueprint);
    setTarget(rule.targetCategory);
    if (rule.referenceCategory) setReference(rule.referenceCategory);

    setHours(Math.floor(rule.valueMinutes / 60));
    setMinutes(rule.valueMinutes % 60);

    setIsBuilding(true);
  };

  const handleResetForm = () => {
    setIsBuilding(false);
    setEditingRuleId(null);
    setRuleName("");
    setBlueprint("MAX_DURATION");
    setHours(1);
    setMinutes(0);
  };

  const handleSaveRule = () => {
    if (!ruleName.trim()) return;
    const totalMinutes = hours * 60 + minutes;

    if (editingRuleId) {
      updateRule(editingRuleId, {
        name: ruleName,
        blueprint,
        targetCategory: target,
        referenceCategory: reference,
        valueMinutes: totalMinutes,
      });
    } else {
      const newRule: CustomRule = {
        id: `rule_${Date.now()}`,
        name: ruleName,
        isActive: true,
        blueprint,
        targetCategory: target,
        referenceCategory: reference,
        valueMinutes: totalMinutes,
      };
      addRule(newRule);
    }

    handleResetForm();
  };

  if (!isMounted) return null;

  return (
    <main className="min-h-screen w-full bg-background text-gray-200 selection:bg-status-info/30 p-8 flex justify-center overflow-y-auto">
      <div className="max-w-4xl w-full flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-surfaceBorder pb-6">
          <div>
            <h1 className="font-heading font-bold text-3xl tracking-wide text-white mb-2">
              Rule Engine
            </h1>
            <p className="font-mono text-sm text-gray-400">
              Build custom operational rules to guard your schedule.
            </p>
          </div>
          <Link href="/">
            <button className="px-4 py-2 font-mono text-sm font-bold bg-surface border border-surfaceBorder text-gray-300 rounded hover:bg-surfaceBorder hover:text-white transition-colors">
              ← Back to Timeline
            </button>
          </Link>
        </div>

        {isBuilding ? (
          <div className="bg-surface border border-status-info/50 rounded-xl p-6 shadow-2xl flex flex-col gap-6 ring-1 ring-status-info/20">
            <h2 className="font-heading font-bold text-white text-lg border-b border-surfaceBorder pb-2">
              {editingRuleId ? "Edit Custom Rule" : "Create Custom Rule"}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                  Rule Name
                </label>
                <input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Union Break Rule"
                  className="bg-background border border-surfaceBorder rounded px-3 py-2 focus:outline-none focus:border-status-info text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                  Logic Blueprint
                </label>
                <select
                  value={blueprint}
                  onChange={(e) =>
                    setBlueprint(e.target.value as RuleBlueprint)
                  }
                  className="bg-background border border-surfaceBorder rounded px-3 py-2 focus:outline-none focus:border-status-info text-sm"
                >
                  {BLUEPRINTS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-background p-4 rounded border border-surfaceBorder/50 overflow-x-auto whitespace-nowrap">
              <span className="font-mono text-sm">IF TARGET IS</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as SegmentCategory)}
                className="bg-surface border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info text-sm font-bold text-status-info"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {(blueprint === "CONTAINMENT" ||
                blueprint === "MIN_GAP" ||
                blueprint === "MIN_WORK_BEFORE") && (
                <>
                  <span className="font-mono text-sm">AND REFERENCE IS</span>
                  <select
                    value={reference}
                    onChange={(e) =>
                      setReference(e.target.value as SegmentCategory)
                    }
                    className="bg-surface border border-surfaceBorder rounded px-2 py-1 focus:outline-none focus:border-status-info text-sm font-bold text-purple-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {blueprint !== "CONTAINMENT" && (
                <>
                  <span className="font-mono text-sm pl-2">ENFORCE</span>

                  {/* FIXED: Modern, sleek time inputs without default browser arrows */}
                  <div className="flex items-center gap-2 bg-surface border border-surfaceBorder rounded-md p-1 focus-within:border-status-info transition-colors">
                    <div className="flex items-center bg-background rounded px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        // The complex class below is standard Tailwind trickery to hide webkit arrows
                        className="w-8 bg-transparent focus:outline-none text-center font-mono text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="font-mono text-[10px] text-gray-500 font-bold uppercase select-none">
                        hrs
                      </span>
                    </div>

                    <span className="text-gray-500 font-bold">:</span>

                    <div className="flex items-center bg-background rounded px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={minutes}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                        className="w-8 bg-transparent focus:outline-none text-center font-mono text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="font-mono text-[10px] text-gray-500 font-bold uppercase select-none">
                        min
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleResetForm}
                className="px-4 py-2 font-mono text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                className="px-6 py-2 font-mono text-sm font-bold bg-status-info text-white rounded hover:bg-blue-600 transition-colors shadow-lg"
              >
                {editingRuleId ? "Update Rule" : "Save Rule"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsBuilding(true)}
            className="w-full py-4 border-2 border-dashed border-surfaceBorder rounded-xl text-gray-400 font-mono hover:bg-surfaceBorder/30 hover:text-white hover:border-status-info/50 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span> Add Custom Rule
          </button>
        )}

        <div className="flex flex-col gap-3">
          {rules.map((rule) => {
            const displayHours = Math.floor(rule.valueMinutes / 60);
            const displayMins = rule.valueMinutes % 60;
            const timeString =
              `${displayHours > 0 ? `${displayHours}h ` : ""}${displayMins > 0 ? `${displayMins}m` : ""}`.trim() ||
              "0m";

            return (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${rule.isActive ? "bg-surface border-surfaceBorder" : "bg-background border-surfaceBorder/30 opacity-60"}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-heading font-bold text-white">
                      {rule.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surfaceBorder text-gray-400">
                      {rule.blueprint}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-gray-400">
                    Target:{" "}
                    <span className="text-status-info font-bold">
                      {rule.targetCategory}
                    </span>
                    {rule.referenceCategory && (
                      <>
                        {" "}
                        | Ref:{" "}
                        <span className="text-purple-400 font-bold">
                          {rule.referenceCategory}
                        </span>
                      </>
                    )}
                    {rule.blueprint !== "CONTAINMENT" && (
                      <>
                        {" "}
                        | Value:{" "}
                        <span className="text-white">{timeString}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mr-2 ${rule.isActive ? "bg-status-good" : "bg-gray-600"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.isActive ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>

                  <button
                    onClick={() => handleEditClick(rule)}
                    className="text-gray-500 hover:text-status-info transition-colors p-2"
                    title="Edit Rule"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>

                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-gray-500 hover:text-status-danger transition-colors p-2"
                    title="Delete Rule"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
