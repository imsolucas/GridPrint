// Shapes of the OpenF1 v1 responses we use. Every field that OpenF1 can omit
// or null is typed as nullable so callers are forced to handle it.

export interface OF1Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string | null;
  gmt_offset: string | null;
  location: string | null;
  country_name: string | null;
  country_code: string | null;
  circuit_short_name: string | null;
  circuit_key: number | null;
  year: number;
  is_cancelled?: boolean;
}

export interface OF1Meeting {
  meeting_key: number;
  meeting_name: string | null;
  meeting_official_name?: string | null;
  circuit_short_name: string | null;
  country_name: string | null;
  location: string | null;
  date_start?: string | null;
  year: number;
}

export interface OF1Driver {
  driver_number: number;
  session_key: number;
  broadcast_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  name_acronym: string | null;
  team_name: string | null;
  team_colour: string | null;
  country_code: string | null;
}

export interface OF1Lap {
  session_key: number;
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean | null;
  st_speed?: number | null;
  i1_speed?: number | null;
  i2_speed?: number | null;
}

export interface OF1Location {
  date: string;
  driver_number: number;
  session_key: number;
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface OF1CarData {
  date: string;
  driver_number: number;
  session_key: number;
  speed: number | null;
  brake: number | null;
  n_gear: number | null;
  throttle?: number | null;
  rpm?: number | null;
  drs?: number | null;
}
