import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_WRITERS_ROOM_PATH } from "./constants";
import { MODIFIER_DEFINITIONS } from "./constants.modifiers";
import { PERSONALITY_DEFINITIONS } from "./constants.personalities";
import {
  InterpretationLineTemplate,
  MetricPath,
  NarrativeTemplate,
  SuitabilityRule,
  TextTemplate,
  WritersRoomContent,
  WritersRoomModifierEntry,
  WritersRoomMomentTemplate,
  WritersRoomPersonalityEntry,
} from "./types";

const FLAT_SECTIONS = new Set([
  "interpretation-lines",
  "trench-copypasta",
  "cinematic-summaries",
  "x-lines",
]);

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseSuitabilityRules(raw: string | undefined): SuitabilityRule[] {
  if (!raw) return [];

  return raw
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^([a-zA-Z.]+)\s*(>=|<=)\s*([0-9.]+)(?:\|([0-9.]+))?$/);
      if (!match) return null;

      const [, metricPath, op, value, weight] = match;
      return {
        metricPath: metricPath as MetricPath,
        op: op === ">=" ? "gte" : "lte",
        value: Number(value),
        weight: weight ? Number(weight) : undefined,
      } as SuitabilityRule;
    })
    .filter((rule): rule is SuitabilityRule => Boolean(rule));
}

interface ParserState {
  section: string;
  subsection: string | null;
  flatRecord: Record<string, string> | null;
}

function emptyContent(filePath: string): WritersRoomContent {
  return {
    source: "missing",
    filePath,
    loadedAt: new Date().toISOString(),
    warnings: [],
    personalities: {},
    modifiers: {},
    interpretationLines: [],
    trenchCopypasta: [],
    moments: {},
    cinematicSummaries: [],
    xLines: [],
  };
}

function applyEngineCoverageDefaults(content: WritersRoomContent): {
  personalitiesAdded: number;
  modifiersAdded: number;
} {
  let personalitiesAdded = 0;
  let modifiersAdded = 0;

  for (const definition of PERSONALITY_DEFINITIONS) {
    if (content.personalities[definition.id]) {
      continue;
    }

    content.personalities[definition.id] = {
      id: definition.id,
      displayName: definition.displayName,
      description: definition.description,
      humorStyle: definition.humorStyle,
      themes: definition.preferredThemes,
    };
    personalitiesAdded += 1;
  }

  for (const definition of MODIFIER_DEFINITIONS) {
    if (content.modifiers[definition.id]) {
      continue;
    }

    content.modifiers[definition.id] = {
      id: definition.id,
      displayName: definition.displayName,
      description: definition.description,
      toneEffect: definition.toneEffect,
      triggerHints: definition.triggerHints,
    };
    modifiersAdded += 1;
  }

  return { personalitiesAdded, modifiersAdded };
}

export async function loadWritersRoomContent(
  filePath = DEFAULT_WRITERS_ROOM_PATH,
): Promise<WritersRoomContent> {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const base = emptyContent(resolvedPath);

  let markdown = "";
  try {
    markdown = await fs.readFile(resolvedPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ...base,
        source: "missing",
        warnings: [
          `Writers room content bank not found at ${resolvedPath}. Using fallback constants.`,
        ],
      };
    }

    return {
      ...base,
      source: "malformed",
      warnings: [`Unable to read writers room file: ${(error as Error).message}`],
    };
  }

  try {
    const content: WritersRoomContent = {
      ...base,
      source: "file",
      warnings: [],
    };

    const state: ParserState = {
      section: "",
      subsection: null,
      flatRecord: null,
    };

    let inCodeFence = false;

    // Markdown parser strategy:
    // - heading-driven sections
    // - bullet key/value parsing
    // - duplicate id protection
    // - graceful skip for malformed blocks
    const flushFlatRecord = () => {
      if (!state.flatRecord || !state.section) {
        state.flatRecord = null;
        return;
      }

      const record = state.flatRecord;
      const id = record.id?.trim();
      if (!id) {
        if (record.__missingIdWarningIssued !== "1") {
          content.warnings.push(`Skipped malformed ${state.section} block with no id.`);
        }
        state.flatRecord = null;
        return;
      }

      if (state.section === "interpretation-lines") {
        if (content.interpretationLines.some((line) => line.id === id)) {
          content.warnings.push(`Duplicate interpretation-line id "${id}" ignored.`);
        } else {
          const line: InterpretationLineTemplate = {
            id,
            text: record.text ?? "",
            tags: parseList(record.tags),
            suitabilityRules: parseSuitabilityRules(record.suitabilityRules),
            tone: record.tone ?? "default",
          };
          if (!line.text) {
            content.warnings.push(`interpretation-line "${id}" has empty text.`);
          }
          content.interpretationLines.push(line);
        }
      }

      if (state.section === "trench-copypasta") {
        if (content.trenchCopypasta.some((item) => item.id === id)) {
          content.warnings.push(`Duplicate trench-copypasta id "${id}" ignored.`);
        } else {
          const item: TextTemplate = {
            id,
            trigger: record.trigger,
            text: record.text ?? "",
            tags: parseList(record.tags),
          };
          content.trenchCopypasta.push(item);
        }
      }

      if (state.section === "cinematic-summaries") {
        if (content.cinematicSummaries.some((item) => item.id === id)) {
          content.warnings.push(`Duplicate cinematic-summary id "${id}" ignored.`);
        } else {
          const item: NarrativeTemplate = {
            id,
            tone: record.tone,
            text: record.text ?? "",
            tags: parseList(record.tags),
          };
          content.cinematicSummaries.push(item);
        }
      }

      if (state.section === "x-lines") {
        if (content.xLines.some((item) => item.id === id)) {
          content.warnings.push(`Duplicate x-line id "${id}" ignored.`);
        } else {
          const item: NarrativeTemplate = {
            id,
            tone: record.tone,
            text: record.text ?? "",
            tags: parseList(record.tags),
          };
          content.xLines.push(item);
        }
      }

      state.flatRecord = null;
    };

    for (const rawLine of markdown.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith("```")) {
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence || line.startsWith("<!--")) {
        continue;
      }

      if (line.startsWith("# ")) {
        flushFlatRecord();
        state.section = slugify(line.slice(2));
        state.subsection = null;
        continue;
      }

      if (line.startsWith("## ")) {
        flushFlatRecord();
        state.subsection = line.slice(3).trim();

        if (state.section === "personalities" && state.subsection) {
          const id = slugify(state.subsection);
          content.personalities[id] = {
            id,
            displayName: state.subsection,
          };
        }

        if (state.section === "modifiers" && state.subsection) {
          const id = slugify(state.subsection);
          content.modifiers[id] = {
            id,
            displayName: state.subsection,
          };
        }

        if (state.section === "moments" && state.subsection) {
          const id = slugify(state.subsection);
          content.moments[id] = {
            id,
          };
        }

        continue;
      }

      const bullet = line.match(/^-\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (!bullet) {
        continue;
      }

      const [, keyRaw, value] = bullet;
      const key = keyRaw.trim();

      if (FLAT_SECTIONS.has(state.section)) {
        if (key === "id") {
          flushFlatRecord();
          state.flatRecord = { id: value.trim() };
          continue;
        }

        if (
          state.flatRecord?.id &&
          Object.prototype.hasOwnProperty.call(state.flatRecord, key)
        ) {
          flushFlatRecord();
        }

        if (!state.flatRecord) {
          content.warnings.push(
            `Skipped malformed ${state.section} block with no id.`,
          );
          state.flatRecord = { __missingIdWarningIssued: "1" };
        }
        state.flatRecord[key] = value.trim();
        continue;
      }

      if (state.section === "personalities" && state.subsection) {
        const id = slugify(state.subsection);
        const entry = content.personalities[id] as WritersRoomPersonalityEntry;
        if (key === "description") entry.description = value.trim();
        if (key === "humorStyle") entry.humorStyle = value.trim();
        if (key === "themes") entry.themes = parseList(value);
        continue;
      }

      if (state.section === "modifiers" && state.subsection) {
        const id = slugify(state.subsection);
        const entry = content.modifiers[id] as WritersRoomModifierEntry;
        if (key === "description") entry.description = value.trim();
        if (key === "toneEffect") entry.toneEffect = value.trim();
        if (key === "triggerHints") entry.triggerHints = parseList(value);
        continue;
      }

      if (state.section === "moments" && state.subsection) {
        const id = slugify(state.subsection);
        const entry = content.moments[id] as WritersRoomMomentTemplate;
        if (key === "title-template") entry.titleTemplate = value.trim();
        if (key === "humor-template") entry.humorTemplate = value.trim();
        continue;
      }
    }

    flushFlatRecord();

    const coverageDefaults = applyEngineCoverageDefaults(content);
    if (coverageDefaults.personalitiesAdded > 0 || coverageDefaults.modifiersAdded > 0) {
      content.warnings.push(
        `Writers room auto-filled ${coverageDefaults.personalitiesAdded} personalities and ${coverageDefaults.modifiersAdded} modifiers from engine defaults.`,
      );
    }

    return content;
  } catch (error) {
    return {
      ...base,
      source: "malformed",
      warnings: [`Failed to parse writers room markdown: ${(error as Error).message}`],
    };
  }
}
