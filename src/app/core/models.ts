export type Coordinates = [longitude: number, latitude: number];
export type TrackerStatus = "moving" | "parked" | "offline";
export type EventType =
  | "start"
  | "stop"
  | "speed"
  | "lost"
  | "restored"
  | "battery";
export type Severity = "info" | "warning" | "critical";
export interface TrackPoint {
  coordinates: Coordinates;
  speed: number;
  time: number;
}
export interface Tracker {
  id: string;
  name: string;
  plate: string;
  driver: string;
  group: string;
  status: TrackerStatus;
  coordinates: Coordinates;
  speed: number;
  battery: number;
  lastMessage: number;
  history: TrackPoint[];
}
export interface TrackerEvent {
  id: string;
  trackerId: string;
  time: number;
  type: EventType;
  severity: Severity;
  description: string;
  coordinates: Coordinates;
}
export interface MapSettings {
  apiKey: string;
  center?: Coordinates;
  zoom?: number;
}
export const STATUS: Record<TrackerStatus, string> = {
  moving: "В движении",
  parked: "Стоянка",
  offline: "Нет связи",
};
export const STATUS_ICON: Record<TrackerStatus, string> = {
  moving: "➤",
  parked: "■",
  offline: "×",
};
export const EVENT_TYPE: Record<EventType, string> = {
  start: "Начало движения",
  stop: "Остановка",
  speed: "Превышение скорости",
  lost: "Потеря связи",
  restored: "Связь восстановлена",
  battery: "Низкий заряд",
};
export const SEVERITY: Record<Severity, string> = {
  info: "Информация",
  warning: "Внимание",
  critical: "Критично",
};
