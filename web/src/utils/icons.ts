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
import arrowUpload from "@fluentui/svg-icons/icons/arrow_upload_24_regular.svg?raw"
import copy from "@fluentui/svg-icons/icons/copy_24_regular.svg?raw"
import deleteIcon from "@fluentui/svg-icons/icons/delete_24_regular.svg?raw"
import dismiss from "@fluentui/svg-icons/icons/dismiss_24_regular.svg?raw"
import arrowCounterclockwise from "@fluentui/svg-icons/icons/arrow_counterclockwise_24_regular.svg?raw"
import checkmark from "@fluentui/svg-icons/icons/checkmark_24_regular.svg?raw"
import folderAdd from "@fluentui/svg-icons/icons/folder_add_24_regular.svg?raw"
import folderArrowUp from "@fluentui/svg-icons/icons/folder_arrow_up_24_regular.svg?raw"
import arrowMove from "@fluentui/svg-icons/icons/arrow_move_24_regular.svg?raw"
import rename from "@fluentui/svg-icons/icons/rename_24_regular.svg?raw"
import selectAllOn from "@fluentui/svg-icons/icons/select_all_on_24_regular.svg?raw"
import localLanguage from "@fluentui/svg-icons/icons/local_language_24_regular.svg?raw"
import navigation from "@fluentui/svg-icons/icons/navigation_24_regular.svg?raw"
import settings from "@fluentui/svg-icons/icons/settings_24_regular.svg?raw"
import arrowLeft from "@fluentui/svg-icons/icons/arrow_left_24_regular.svg?raw"
import add from "@fluentui/svg-icons/icons/add_24_regular.svg?raw"
import edit from "@fluentui/svg-icons/icons/edit_24_regular.svg?raw"
import tag from "@fluentui/svg-icons/icons/tag_24_regular.svg?raw"
import textBulletList from "@fluentui/svg-icons/icons/text_bullet_list_24_regular.svg?raw"
import { extension } from "./format"

export const icons = {
  localLanguage,
  navigation,
  settings,
  arrowLeft,
  add,
  edit,
  tag,
  textBulletList,
  arrowUpload,
  copy,
  deleteIcon,
  dismiss,
  arrowCounterclockwise,
  checkmark,
  folderAdd,
  folderArrowUp,
  arrowMove,
  rename,
  selectAllOn,
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

// Object types: 1 folder, 2 video, 3 audio, 4 text, 5 image
const BY_TYPE: Record<number, string> = { 1: folder, 2: video, 3: musicNote, 4: documentText, 5: image }

export function iconForEntry(entry: { name: string; is_dir: boolean; type: number }): string {
  if (entry.is_dir) return folder
  return BY_EXTENSION[extension(entry.name)] ?? BY_TYPE[entry.type] ?? document
}

import board from "@fluentui/svg-icons/icons/board_24_regular.svg?raw"
import eye from "@fluentui/svg-icons/icons/eye_24_regular.svg?raw"
import eyeOff from "@fluentui/svg-icons/icons/eye_off_24_regular.svg?raw"
import key from "@fluentui/svg-icons/icons/key_24_regular.svg?raw"
import search from "@fluentui/svg-icons/icons/search_24_regular.svg?raw"
import stop from "@fluentui/svg-icons/icons/stop_24_regular.svg?raw"

export const systemIcons = { board, eye, eyeOff, key, search, stop }

import appsListDetail from "@fluentui/svg-icons/icons/apps_list_detail_24_regular.svg?raw"
import arrowRight from "@fluentui/svg-icons/icons/arrow_right_24_regular.svg?raw"
import chevronDown from "@fluentui/svg-icons/icons/chevron_down_24_regular.svg?raw"
import clipboardPaste from "@fluentui/svg-icons/icons/clipboard_paste_24_regular.svg?raw"
import cut from "@fluentui/svg-icons/icons/cut_24_regular.svg?raw"
import hardDrive from "@fluentui/svg-icons/icons/hard_drive_24_regular.svg?raw"

export const browseIcons = { appsListDetail, arrowRight, chevronDown, clipboardPaste, cut, hardDrive }

import people from "@fluentui/svg-icons/icons/people_24_regular.svg?raw"

export const groupIcons = { people }
