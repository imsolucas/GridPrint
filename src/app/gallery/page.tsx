import { listPosters } from "@/lib/gallery/store";
import GalleryView from "./gallery-view";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const posters = await listPosters();
  return (
    <GalleryView
      posters={posters.map((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        query: `session_key=${p.spec.sessionKey}&driver_number=${p.spec.driverNumber}&lap_number=${p.spec.lapNumber}&template=${p.spec.template}`,
        driverNumber: p.meta.driverNumber,
        driverName: p.meta.driverName,
        driverLastName: p.meta.driverLastName,
        teamColour: p.meta.teamColour,
        eventName: p.meta.eventName,
        year: p.meta.year,
        sessionName: p.meta.sessionName,
        lapNumber: p.meta.lapNumber,
        lapTime: p.meta.lapTime,
        templateName: p.templateName,
      }))}
    />
  );
}
