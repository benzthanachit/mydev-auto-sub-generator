"use client";

import { CaptionSettings } from "@/types";

interface CustomizationPanelProps {
  settings: CaptionSettings;
  onChange: (settings: CaptionSettings) => void;
}

const FONTS = [
  { name: "Inter", value: "var(--font-inter)" },
  { name: "Roboto", value: "var(--font-roboto)" },
  { name: "Montserrat", value: "var(--font-montserrat)" },
  { name: "Bangers", value: "var(--font-bangers)" },
];

export function CustomizationPanel({ settings, onChange }: CustomizationPanelProps) {
  const handleChange = (key: keyof CaptionSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 text-sm text-zinc-300">
      {/* Words Per Screen */}
      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Words per Screen
          <span className="text-zinc-500">{settings.wordsPerScreen}</span>
        </label>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={settings.wordsPerScreen}
          onChange={(e) => handleChange("wordsPerScreen", parseInt(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>

      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Max Subtitle Airtime
          <span className="text-zinc-500">{settings.maxGapTime}s</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={settings.maxGapTime}
          onChange={(e) => handleChange("maxGapTime", parseFloat(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>

      <hr className="border-zinc-800" />

      {/* Font Family */}
      <div className="space-y-2">
        <label className="font-medium block">Font</label>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((font) => (
            <button
              key={font.value}
              onClick={() => handleChange("fontFamily", font.value)}
              className={`p-2 rounded border ${
                settings.fontFamily === font.value
                  ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
              } transition-colors`}
              style={{ fontFamily: font.value }}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Font Size
          <span className="text-zinc-500">{settings.fontSize}px</span>
        </label>
        <input
          type="range"
          min="16"
          max="120"
          step="1"
          value={settings.fontSize}
          onChange={(e) => handleChange("fontSize", parseInt(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>

      <hr className="border-zinc-800" />

      {/* Colors */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="font-medium">Text Color</label>
          <input
            type="color"
            value={settings.textColor}
            onChange={(e) => handleChange("textColor", e.target.value)}
            className="w-8 h-8 rounded bg-transparent cursor-pointer"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <label className="font-medium">Highlight Color</label>
          <input
            type="color"
            value={settings.highlightColor}
            onChange={(e) => handleChange("highlightColor", e.target.value)}
            className="w-8 h-8 rounded bg-transparent cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="font-medium">Stroke Color</label>
          <input
            type="color"
            value={settings.strokeColor}
            onChange={(e) => handleChange("strokeColor", e.target.value)}
            className="w-8 h-8 rounded bg-transparent cursor-pointer"
          />
        </div>
      </div>

      <hr className="border-zinc-800" />

      {/* Stroke & Shadow */}
      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Stroke Width
          <span className="text-zinc-500">{settings.strokeWidth}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={settings.strokeWidth}
          onChange={(e) => handleChange("strokeWidth", parseInt(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>

      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Shadow Blur
          <span className="text-zinc-500">{settings.shadowBlur}px</span>
        </label>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          value={settings.shadowBlur}
          onChange={(e) => handleChange("shadowBlur", parseInt(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>

      <hr className="border-zinc-800" />

      {/* Position */}
      <div className="space-y-2">
        <label className="flex justify-between font-medium">
          Y-Position
          <span className="text-zinc-500">{settings.yPosition}%</span>
        </label>
        <input
          type="range"
          min="10"
          max="90"
          step="1"
          value={settings.yPosition}
          onChange={(e) => handleChange("yPosition", parseInt(e.target.value))}
          className="w-full accent-yellow-500"
        />
      </div>
    </div>
  );
}
