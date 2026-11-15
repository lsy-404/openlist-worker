import { decode } from "./useTextFile"

const pad = (value: string, width: number) => value.padStart(width, "0")

function srtToVtt(text: string): string {
  const body = text.replace(/\r/g, "").replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, (_, hms: string, ms: string) => `${pad(hms, 8)}.${pad(ms, 3)}`)
  return `WEBVTT\n\n${body}`
}

// "h:mm:ss.cc" in ASS becomes "hh:mm:ss.mmm"
function assTime(value: string): string {
  const [hms, cs = "0"] = value.trim().split(".")
  return `${pad(hms, 8)}.${pad(cs.padEnd(2, "0"), 2)}0`
}

function assToVtt(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n")
  let columns: string[] = []
  const cues: string[] = []
  let inEvents = false
  for (const line of lines) {
    if (/^\[events\]/i.test(line)) inEvents = true
    else if (/^\[/.test(line)) inEvents = false
    if (!inEvents) continue
    if (/^format:/i.test(line)) {
      columns = line.slice(7).split(",").map((c) => c.trim().toLowerCase())
    } else if (/^dialogue:/i.test(line) && columns.length) {
      const fields = line.slice(9).split(",")
      const textIndex = columns.indexOf("text")
      const start = fields[columns.indexOf("start")]
      const end = fields[columns.indexOf("end")]
      const content = fields
        .slice(textIndex)
        .join(",")
        .replace(/\{[^}]*\}/g, "")
        .replace(/\\N/gi, "\n")
        .replace(/\\h/g, " ")
        .trim()
      if (start && end && content) cues.push(`${assTime(start)} --> ${assTime(end)}\n${content}`)
    }
  }
  return `WEBVTT\n\n${cues.join("\n\n")}`
}

/** Subtitle file contents as a WebVTT blob URL, which is what media elements can display. */
export function subtitleToUrl(buffer: ArrayBuffer, ext: string): string {
  const text = decode(buffer).text.replace(/^﻿/, "")
  const vtt = ext === "vtt" ? text : ext === "srt" ? srtToVtt(text) : assToVtt(text)
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }))
}
