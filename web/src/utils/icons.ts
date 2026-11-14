import archive from "@fluentui/svg-icons/icons/archive_24_regular.svg?raw"
import arrowClockwise from "@fluentui/svg-icons/icons/arrow_clockwise_24_regular.svg?raw"
import arrowDown from "@fluentui/svg-icons/icons/arrow_down_24_regular.svg?raw"
import arrowDownload from "@fluentui/svg-icons/icons/arrow_download_24_regular.svg?raw"
import arrowSort from "@fluentui/svg-icons/icons/arrow_sort_24_regular.svg?raw"
import arrowUp from "@fluentui/svg-icons/icons/arrow_up_24_regular.svg?raw"
import chevronRight from "@fluentui/svg-icons/icons/chevron_right_24_regular.svg?raw"
import code from "@fluentui/svg-icons/icons/code_24_regular.svg?raw"
import desktop from "@fluentui/svg-icons/icons/desktop_24_regular.svg?raw"
import document from "@fluentui/svg-icons/icons/document_24_regular.svg?raw"
import documentPdf from "@fluentui/svg-icons/icons/document_pdf_24_regular.svg?raw"
import documentText from "@fluentui/svg-icons/icons/document_text_24_regular.svg?raw"
import folder from "@fluentui/svg-icons/icons/folder_24_regular.svg?raw"
import folderOpen from "@fluentui/svg-icons/icons/folder_open_24_regular.svg?raw"
import gridView from "@fluentui/svg-icons/icons/grid_24_regular.svg?raw"
import home from "@fluentui/svg-icons/icons/home_24_regular.svg?raw"
import image from "@fluentui/svg-icons/icons/image_24_regular.svg?raw"
import link from "@fluentui/svg-icons/icons/link_24_regular.svg?raw"
import listView from "@fluentui/svg-icons/icons/list_24_regular.svg?raw"
import lockClosed from "@fluentui/svg-icons/icons/lock_closed_24_regular.svg?raw"
import moreHorizontal from "@fluentui/svg-icons/icons/more_horizontal_24_regular.svg?raw"
import musicNote from "@fluentui/svg-icons/icons/music_note_1_24_regular.svg?raw"
import person from "@fluentui/svg-icons/icons/person_24_regular.svg?raw"
import signOut from "@fluentui/svg-icons/icons/sign_out_24_regular.svg?raw"
import video from "@fluentui/svg-icons/icons/video_24_regular.svg?raw"
import warning from "@fluentui/svg-icons/icons/warning_24_regular.svg?raw"
import weatherMoon from "@fluentui/svg-icons/icons/weather_moon_24_regular.svg?raw"
import weatherSunny from "@fluentui/svg-icons/icons/weather_sunny_24_regular.svg?raw"
import { extension } from "./format"

export const icons = {
  archive,
  arrowClockwise,
  arrowDown,
  arrowDownload,
  arrowSort,
  arrowUp,
  chevronRight,
  code,
  desktop,
  document,
  folder,
  folderOpen,
  gridView,
  home,
  link,
  listView,
  lockClosed,
  moreHorizontal,
  person,
  signOut,
  warning,
  weatherMoon,
  weatherSunny,
}

const BY_EXTENSION: Record<string, string> = {
  pdf: documentPdf,
  zip: archive,
  rar: archive,
  "7z": archive,
  tar: archive,
  gz: archive,
  xz: archive,
  bz2: archive,
  iso: archive,
  js: code,
  ts: code,
  json: code,
  html: code,
  css: code,
  py: code,
  sh: code,
  txt: documentText,
  md: documentText,
  log: documentText,
  reg: documentText,
}

// OpenList object types: 1 folder, 2 video, 3 audio, 4 text, 5 image
const BY_TYPE: Record<number, string> = { 1: folder, 2: video, 3: musicNote, 4: documentText, 5: image }

export function iconForEntry(entry: { name: string; is_dir: boolean; type: number }): string {
  if (entry.is_dir) return folder
  return BY_EXTENSION[extension(entry.name)] ?? BY_TYPE[entry.type] ?? document
}
