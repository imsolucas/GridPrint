import { TEMPLATES } from "@/lib/templates";
import Studio from "./studio";

export default function Home() {
  const templates = TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
  return <Studio templates={templates} />;
}
