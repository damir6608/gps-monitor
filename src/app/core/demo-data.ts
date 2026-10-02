import {
  Coordinates,
  EVENT_TYPE,
  EventType,
  Tracker,
  TrackerEvent,
  TrackerStatus,
} from "./models";

/** Seeded, generated once. Every historical event uses an actual history sample. */
export function createDemoData(now = Date.now()): {
  trackers: Tracker[];
  events: TrackerEvent[];
} {
  let seed = 1847;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const hubs: Coordinates[] = [
    [37.61, 55.75],
    [37.44, 55.89],
    [37.88, 55.8],
    [37.55, 55.57],
    [37.27, 55.67],
  ];
  const groups = [
    "Центральный парк",
    "Северный филиал",
    "Восточная логистика",
    "Южный филиал",
    "Западный парк",
  ];
  const names = [
    "Газель NEXT",
    "Lada Largus",
    "Ford Transit",
    "КАМАЗ 5490",
    "Hyundai Porter",
    "Mercedes Sprinter",
  ];
  const drivers = [
    "Алексей Морозов",
    "Дмитрий Волков",
    "Сергей Соколов",
    "Иван Кузнецов",
    "Михаил Орлов",
    "Андрей Попов",
    "Павел Лебедев",
    "Олег Смирнов",
  ];
  const trackers: Tracker[] = Array.from({ length: 80 }, (_, i) => {
    const hub = hubs[i % hubs.length];
    const coordinates: Coordinates =
      i < 3
        ? [37.61, 55.75]
        : [hub[0] + (random() - 0.5) * 0.1, hub[1] + (random() - 0.5) * 0.06];
    const status: TrackerStatus =
      i % 9 === 0 ? "offline" : i % 3 === 0 ? "parked" : "moving";
    const lastMessage =
      now - (status === "offline" ? (45 + i) * 60000 : (10 + i) * 1000);
    const speed = status === "moving" ? 25 + Math.floor(random() * 43) : 0;
    const speeds = Array.from({ length: 24 }, (_, j) =>
      j === 23 ? speed : j === 20 ? 0 : 28 + Math.floor(random() * 65),
    );
    const history = speeds.map((speed, j) => ({
      coordinates: [...coordinates] as Coordinates,
      speed,
      time: lastMessage - (23 - j) * 12000,
    }));
    // Integrate speed backwards, so the latest sample is exactly the current position.
    for (let j = 22; j >= 0; j--) {
      const next = history[j + 1];
      const km = (next.speed * 12) / 3600;
      history[j].coordinates = [
        next.coordinates[0] -
          (km * 0.866) /
            (111.32 * Math.cos((next.coordinates[1] * Math.PI) / 180)),
        next.coordinates[1] - (km * 0.5) / 111.32,
      ];
    }
    return {
      id: `trk-${String(i + 1).padStart(3, "0")}`,
      name: `${names[i % names.length]} · ${String(i + 1).padStart(2, "0")}`,
      plate: `${["А", "М", "К", "Е"][i % 4]}${String(100 + i * 7).padStart(3, "0")}КТ ${i % 2 ? "777" : "799"}`,
      driver: drivers[i % drivers.length],
      group: groups[i % 5],
      status,
      coordinates,
      speed,
      battery: i % 13 === 0 ? 14 : 54 + Math.floor(random() * 46),
      lastMessage,
      history,
    };
  });
  const events: TrackerEvent[] = Array.from({ length: 300 }, (_, i) => {
    const tracker = trackers[i % 80];
    const point = tracker.history[23 - Math.floor(i / 80)];
    const type: EventType =
      point.speed === 0
        ? tracker.status === "offline" && i < 80
          ? "lost"
          : "stop"
        : point.speed > 80
          ? "speed"
          : tracker.battery < 20
            ? "battery"
            : i % 2
              ? "start"
              : "restored";
    return {
      id: `evt-${i + 1}`,
      trackerId: tracker.id,
      time: point.time,
      type,
      severity:
        type === "lost"
          ? "critical"
          : type === "speed" || type === "battery"
            ? "warning"
            : "info",
      description: `${EVENT_TYPE[type]}. ${type === "speed" ? `Скорость ${point.speed} км/ч при лимите 80 км/ч` : type === "battery" ? `Заряд ${tracker.battery}%` : "Телеметрия получена от трекера"}.`,
      coordinates: [...point.coordinates],
    };
  });
  return { trackers, events: events.sort((a, b) => b.time - a.time) };
}
