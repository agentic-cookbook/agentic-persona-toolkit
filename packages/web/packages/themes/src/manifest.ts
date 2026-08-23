import {
  adhCss,
  agenticcookbookwebCss,
  crtMonitorCss,
  devTeamCss,
  fishlampCss,
  greenMatrixCss,
  greenMatrixGlassCss,
  handheldCommunicatorCss,
  mikefullertonCss,
  myprojectsCss,
  myprojectsoverviewCss,
  oldSchoolTerminalCss,
  professionalCss,
  techyCss,
  terminalCss,
  terminalSplitCss,
  whimsicalCss,
} from './theme-data'

export type ThemeKey =
  | 'adh'
  | 'agenticcookbookweb'
  | 'crt-monitor'
  | 'dev-team'
  | 'fishlamp'
  | 'green-matrix'
  | 'green-matrix-glass'
  | 'handheld-communicator'
  | 'mikefullerton'
  | 'myprojects'
  | 'myprojectsoverview'
  | 'old-school-terminal'
  | 'professional'
  | 'techy'
  | 'terminal'
  | 'terminal-split'
  | 'whimsical'

export interface ThemeEntry {
  id: ThemeKey
  label: string
  css: string
}

export const themes: Record<ThemeKey, ThemeEntry> = {
  adh: { id: 'adh', label: 'Agentic Developer Hub', css: adhCss },
  agenticcookbookweb: { id: 'agenticcookbookweb', label: 'Agentic Cookbook', css: agenticcookbookwebCss },
  'crt-monitor': { id: 'crt-monitor', label: 'CRT Monitor', css: crtMonitorCss },
  'dev-team': { id: 'dev-team', label: 'Dev Team', css: devTeamCss },
  fishlamp: { id: 'fishlamp', label: 'fishlamp (ember on ink)', css: fishlampCss },
  'green-matrix': { id: 'green-matrix', label: 'Green Matrix', css: greenMatrixCss },
  'green-matrix-glass': { id: 'green-matrix-glass', label: 'Green Matrix (Glass)', css: greenMatrixGlassCss },
  'handheld-communicator': { id: 'handheld-communicator', label: 'Handheld Communicator', css: handheldCommunicatorCss },
  mikefullerton: { id: 'mikefullerton', label: 'Mike Fullerton', css: mikefullertonCss },
  myprojects: { id: 'myprojects', label: 'My Projects', css: myprojectsCss },
  myprojectsoverview: { id: 'myprojectsoverview', label: 'Projects Overview', css: myprojectsoverviewCss },
  'old-school-terminal': { id: 'old-school-terminal', label: 'Old School Terminal', css: oldSchoolTerminalCss },
  professional: { id: 'professional', label: 'Professional', css: professionalCss },
  techy: { id: 'techy', label: 'Techy', css: techyCss },
  terminal: { id: 'terminal', label: 'Terminal', css: terminalCss },
  'terminal-split': { id: 'terminal-split', label: 'Terminal Split', css: terminalSplitCss },
  whimsical: { id: 'whimsical', label: 'Whimsical', css: whimsicalCss },
}

export const themeIds: ThemeKey[] = Object.keys(themes) as ThemeKey[]
