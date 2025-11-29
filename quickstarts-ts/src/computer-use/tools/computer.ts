/**
 * Computer Tool - Screen, keyboard, and mouse interaction
 *
 * This tool requires a Linux environment with X11 and tools like:
 * - xdotool (keyboard/mouse control)
 * - gnome-screenshot or scrot (screenshots)
 * - imagemagick convert (image scaling)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BetaToolComputerUse20241022,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/index";
import { BaseAnthropicTool, ToolResult, ToolError } from "./base.js";
import { run } from "./run.js";

const OUTPUT_DIR = "/tmp/outputs";
const TYPING_DELAY_MS = 12;
const TYPING_GROUP_SIZE = 50;

type Action20241022 =
  | "key"
  | "type"
  | "mouse_move"
  | "left_click"
  | "left_click_drag"
  | "right_click"
  | "middle_click"
  | "double_click"
  | "screenshot"
  | "cursor_position";

type Action20250124 =
  | Action20241022
  | "left_mouse_down"
  | "left_mouse_up"
  | "scroll"
  | "hold_key"
  | "wait"
  | "triple_click";

type Action20251124 = Action20250124 | "zoom";

type ScrollDirection = "up" | "down" | "left" | "right";

interface Resolution {
  width: number;
  height: number;
}

// Sizes above XGA/WXGA are not recommended
const MAX_SCALING_TARGETS: Record<string, Resolution> = {
  XGA: { width: 1024, height: 768 }, // 4:3
  WXGA: { width: 1280, height: 800 }, // 16:10
  FWXGA: { width: 1366, height: 768 }, // ~16:9
};

const CLICK_BUTTONS: Record<string, string | number> = {
  left_click: 1,
  right_click: 3,
  middle_click: 2,
  double_click: "--repeat 2 --delay 10 1",
  triple_click: "--repeat 3 --delay 10 1",
};

type ScalingSource = "computer" | "api";

interface ComputerToolOptions {
  display_height_px: number;
  display_width_px: number;
  display_number: number | null;
}

function chunks(s: string, chunkSize: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < s.length; i += chunkSize) {
    result.push(s.slice(i, i + chunkSize));
  }
  return result;
}

function escapeShell(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Base computer tool with screen, keyboard, and mouse interaction.
 */
abstract class BaseComputerTool extends BaseAnthropicTool {
  readonly name = "computer" as const;
  width: number;
  height: number;
  displayNum: number | null;
  protected displayPrefix: string;
  protected xdotool: string;
  protected screenshotDelay = 2000; // ms
  protected scalingEnabled = true;

  constructor() {
    super();
    this.width = parseInt(process.env.WIDTH || "0", 10);
    this.height = parseInt(process.env.HEIGHT || "0", 10);

    if (!this.width || !this.height) {
      throw new Error("WIDTH and HEIGHT environment variables must be set");
    }

    const displayNumStr = process.env.DISPLAY_NUM;
    if (displayNumStr !== undefined) {
      this.displayNum = parseInt(displayNumStr, 10);
      this.displayPrefix = `DISPLAY=:${this.displayNum} `;
    } else {
      this.displayNum = null;
      this.displayPrefix = "";
    }

    this.xdotool = `${this.displayPrefix}xdotool`;
  }

  get options(): ComputerToolOptions {
    const [width, height] = this.scaleCoordinates(
      "computer",
      this.width,
      this.height
    );
    return {
      display_width_px: width,
      display_height_px: height,
      display_number: this.displayNum,
    };
  }

  async call(params: {
    action: Action20241022;
    text?: string;
    coordinate?: [number, number];
  }): Promise<ToolResult> {
    const { action, text, coordinate } = params;

    if (action === "mouse_move" || action === "left_click_drag") {
      if (!coordinate) {
        throw new ToolError(`coordinate is required for ${action}`);
      }
      if (text !== undefined) {
        throw new ToolError(`text is not accepted for ${action}`);
      }

      const [x, y] = this.validateAndGetCoordinates(coordinate);

      if (action === "mouse_move") {
        return this.shell(`${this.xdotool} mousemove --sync ${x} ${y}`);
      } else {
        return this.shell(
          `${this.xdotool} mousedown 1 mousemove --sync ${x} ${y} mouseup 1`
        );
      }
    }

    if (action === "key" || action === "type") {
      if (text === undefined) {
        throw new ToolError(`text is required for ${action}`);
      }
      if (coordinate !== undefined) {
        throw new ToolError(`coordinate is not accepted for ${action}`);
      }

      if (action === "key") {
        return this.shell(`${this.xdotool} key -- ${text}`);
      } else {
        // Type in chunks
        const results: ToolResult[] = [];
        for (const chunk of chunks(text, TYPING_GROUP_SIZE)) {
          results.push(
            await this.shell(
              `${this.xdotool} type --delay ${TYPING_DELAY_MS} -- ${escapeShell(chunk)}`,
              false
            )
          );
        }
        const screenshot = await this.screenshot();
        return new ToolResult({
          output: results.map((r) => r.output || "").join(""),
          error: results.map((r) => r.error || "").join(""),
          base64Image: screenshot.base64Image,
        });
      }
    }

    if (
      [
        "left_click",
        "right_click",
        "double_click",
        "middle_click",
        "screenshot",
        "cursor_position",
      ].includes(action)
    ) {
      if (text !== undefined) {
        throw new ToolError(`text is not accepted for ${action}`);
      }
      if (coordinate !== undefined) {
        throw new ToolError(`coordinate is not accepted for ${action}`);
      }

      if (action === "screenshot") {
        return this.screenshot();
      }
      if (action === "cursor_position") {
        const result = await this.shell(
          `${this.xdotool} getmouselocation --shell`,
          false
        );
        const output = result.output || "";
        const xMatch = output.match(/X=(\d+)/);
        const yMatch = output.match(/Y=(\d+)/);
        if (xMatch && yMatch) {
          const [x, y] = this.scaleCoordinates(
            "computer",
            parseInt(xMatch[1], 10),
            parseInt(yMatch[1], 10)
          );
          return result.replace({ output: `X=${x},Y=${y}` });
        }
        return result;
      }

      return this.shell(`${this.xdotool} click ${CLICK_BUTTONS[action]}`);
    }

    throw new ToolError(`Invalid action: ${action}`);
  }

  validateAndGetCoordinates(coordinate: [number, number]): [number, number] {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new ToolError(`${coordinate} must be a tuple of length 2`);
    }
    if (!coordinate.every((i) => Number.isInteger(i) && i >= 0)) {
      throw new ToolError(`${coordinate} must be a tuple of non-negative ints`);
    }
    return this.scaleCoordinates("api", coordinate[0], coordinate[1]);
  }

  async screenshot(): Promise<ToolResult> {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const screenshotPath = path.join(OUTPUT_DIR, `screenshot_${randomUUID()}.png`);

    // Try gnome-screenshot first, fall back to scrot
    const cmd = `${this.displayPrefix}gnome-screenshot -f ${screenshotPath} -p 2>/dev/null || ${this.displayPrefix}scrot -p ${screenshotPath}`;
    const result = await this.shell(cmd, false);

    if (this.scalingEnabled) {
      const [x, y] = this.scaleCoordinates("computer", this.width, this.height);
      await this.shell(`convert ${screenshotPath} -resize ${x}x${y}! ${screenshotPath}`, false);
    }

    if (fs.existsSync(screenshotPath)) {
      const imageData = fs.readFileSync(screenshotPath);
      const base64 = imageData.toString("base64");
      return result.replace({ base64Image: base64 });
    }

    throw new ToolError(`Failed to take screenshot: ${result.error}`);
  }

  async shell(command: string, takeScreenshot = true): Promise<ToolResult> {
    const [, stdout, stderr] = await run(command);

    let base64Image: string | null = null;
    if (takeScreenshot) {
      await new Promise((resolve) => setTimeout(resolve, this.screenshotDelay));
      base64Image = (await this.screenshot()).base64Image;
    }

    return new ToolResult({
      output: stdout,
      error: stderr,
      base64Image,
    });
  }

  scaleCoordinates(source: ScalingSource, x: number, y: number): [number, number] {
    if (!this.scalingEnabled) {
      return [x, y];
    }

    const ratio = this.width / this.height;
    let targetDimension: Resolution | null = null;

    for (const dimension of Object.values(MAX_SCALING_TARGETS)) {
      // Allow some error in aspect ratio
      if (Math.abs(dimension.width / dimension.height - ratio) < 0.02) {
        if (dimension.width < this.width) {
          targetDimension = dimension;
        }
        break;
      }
    }

    if (!targetDimension) {
      return [x, y];
    }

    const xScalingFactor = targetDimension.width / this.width;
    const yScalingFactor = targetDimension.height / this.height;

    if (source === "api") {
      if (x > this.width || y > this.height) {
        throw new ToolError(`Coordinates ${x}, ${y} are out of bounds`);
      }
      // Scale up
      return [Math.round(x / xScalingFactor), Math.round(y / yScalingFactor)];
    }

    // Scale down
    return [Math.round(x * xScalingFactor), Math.round(y * yScalingFactor)];
  }
}

/**
 * ComputerTool20241022 - Original computer use tool
 */
export class ComputerTool20241022 extends BaseComputerTool {
  readonly apiType = "computer_20241022" as const;

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType, ...this.options } as unknown as BetaToolUnion;
  }
}

/**
 * ComputerTool20250124 - Extended with scroll, hold_key, wait, triple_click
 */
export class ComputerTool20250124 extends BaseComputerTool {
  readonly apiType = "computer_20250124" as const;

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType, ...this.options } as unknown as BetaToolUnion;
  }

  override async call(params: {
    action: Action20250124;
    text?: string;
    coordinate?: [number, number];
    scroll_direction?: ScrollDirection;
    scroll_amount?: number;
    duration?: number;
    key?: string;
  }): Promise<ToolResult> {
    const { action, text, coordinate, scroll_direction, scroll_amount, duration, key } =
      params;

    if (action === "left_mouse_down" || action === "left_mouse_up") {
      if (coordinate !== undefined) {
        throw new ToolError(`coordinate is not accepted for ${action}.`);
      }
      const cmd =
        action === "left_mouse_down"
          ? `${this.xdotool} mousedown 1`
          : `${this.xdotool} mouseup 1`;
      return this.shell(cmd);
    }

    if (action === "scroll") {
      if (!scroll_direction || !["up", "down", "left", "right"].includes(scroll_direction)) {
        throw new ToolError(
          `scroll_direction must be 'up', 'down', 'left', or 'right'`
        );
      }
      if (!Number.isInteger(scroll_amount) || scroll_amount! < 0) {
        throw new ToolError(`scroll_amount must be a non-negative int`);
      }

      let mouseMovePart = "";
      if (coordinate) {
        const [x, y] = this.validateAndGetCoordinates(coordinate);
        mouseMovePart = `mousemove --sync ${x} ${y}`;
      }

      const scrollButton = { up: 4, down: 5, left: 6, right: 7 }[scroll_direction];
      const parts = [this.xdotool, mouseMovePart];
      if (text) parts.push(`keydown ${text}`);
      parts.push(`click --repeat ${scroll_amount} ${scrollButton}`);
      if (text) parts.push(`keyup ${text}`);

      return this.shell(parts.filter(Boolean).join(" "));
    }

    if (action === "hold_key" || action === "wait") {
      if (duration === undefined || typeof duration !== "number") {
        throw new ToolError(`duration must be a number`);
      }
      if (duration < 0) {
        throw new ToolError(`duration must be non-negative`);
      }
      if (duration > 100) {
        throw new ToolError(`duration is too long.`);
      }

      if (action === "hold_key") {
        if (text === undefined) {
          throw new ToolError(`text is required for hold_key`);
        }
        const escapedKeys = escapeShell(text);
        return this.shell(
          `${this.xdotool} keydown ${escapedKeys} sleep ${duration} keyup ${escapedKeys}`
        );
      }

      // wait action
      await new Promise((resolve) => setTimeout(resolve, duration * 1000));
      return this.screenshot();
    }

    if (["left_click", "right_click", "double_click", "triple_click", "middle_click"].includes(action)) {
      if (text !== undefined) {
        throw new ToolError(`text is not accepted for ${action}`);
      }

      let mouseMovePart = "";
      if (coordinate) {
        const [x, y] = this.validateAndGetCoordinates(coordinate);
        mouseMovePart = `mousemove --sync ${x} ${y}`;
      }

      const parts = [this.xdotool, mouseMovePart];
      if (key) parts.push(`keydown ${key}`);
      parts.push(`click ${CLICK_BUTTONS[action]}`);
      if (key) parts.push(`keyup ${key}`);

      return this.shell(parts.filter(Boolean).join(" "));
    }

    // Fall back to parent implementation
    return super.call({ action: action as Action20241022, text, coordinate });
  }
}

/**
 * ComputerTool20251124 - Extended with zoom
 */
export class ComputerTool20251124 extends BaseComputerTool {
  readonly apiType = "computer_20251124" as const;

  toParams(): BetaToolUnion {
    return { name: this.name, type: this.apiType, ...this.options } as unknown as BetaToolUnion;
  }

  override get options(): ComputerToolOptions & { enable_zoom: boolean } {
    return { ...super.options, enable_zoom: true };
  }

  override async call(params: {
    action: Action20251124;
    text?: string;
    coordinate?: [number, number];
    scroll_direction?: ScrollDirection;
    scroll_amount?: number;
    duration?: number;
    key?: string;
    region?: [number, number, number, number];
  }): Promise<ToolResult> {
    const { action, region } = params;

    if (action === "zoom") {
      if (!region || !Array.isArray(region) || region.length !== 4) {
        throw new ToolError(
          `region must be a tuple of 4 coordinates (x0, y0, x1, y1)`
        );
      }
      if (!region.every((c) => Number.isInteger(c) && c >= 0)) {
        throw new ToolError(`region must contain non-negative integers`);
      }

      let [x0, y0, x1, y1] = region;
      [x0, y0] = this.scaleCoordinates("api", x0, y0);
      [x1, y1] = this.scaleCoordinates("api", x1, y1);

      const screenshotResult = await this.screenshot();
      if (!screenshotResult.base64Image) {
        throw new ToolError("Failed to take screenshot for zoom");
      }

      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      const tempPath = path.join(OUTPUT_DIR, `screenshot_${randomUUID()}.png`);
      const croppedPath = path.join(OUTPUT_DIR, `zoomed_${randomUUID()}.png`);

      fs.writeFileSync(tempPath, Buffer.from(screenshotResult.base64Image, "base64"));

      const width = x1 - x0;
      const height = y1 - y0;
      await run(`convert ${tempPath} -crop ${width}x${height}+${x0}+${y0} +repage ${croppedPath}`);

      if (fs.existsSync(croppedPath)) {
        const croppedBase64 = fs.readFileSync(croppedPath).toString("base64");
        try {
          fs.unlinkSync(tempPath);
          fs.unlinkSync(croppedPath);
        } catch {
          // Ignore cleanup errors
        }
        return new ToolResult({ base64Image: croppedBase64 });
      }

      throw new ToolError("Failed to crop screenshot for zoom");
    }

    // Call base implementation for other actions
    return BaseComputerTool.prototype.call.call(this, params as Parameters<typeof BaseComputerTool.prototype.call>[0]);
  }
}

// Default export
export const ComputerTool = ComputerTool20251124;
