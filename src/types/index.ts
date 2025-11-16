export interface FileInfo {
  "File Size": number;
  "File Hash": string;
  "File URL": string;
  [key: string]: any;
}

export type FileMap = Record<string, FileInfo>;

export type ChangeType = "+" | "~" | "-";

export interface DiffEntry {
  path: string;
  change: ChangeType;
  new?: FileInfo;
  old?: FileInfo;
  diffs?: Array<{ key: string; old: any; new: any }>;
}

export interface DetailedChange {
  path: string;
  diffs: Array<{ key: string; old: any; new: any }>;
}