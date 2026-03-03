import SectionCard from "../ui/SectionCard";
import Field from "../ui/Field";
import type { Agent, TeamLeader } from "../../page";

export default function TabAgent({
  agent,
  leader,
}: {
  agent: Agent | null;
  leader: TeamLeader | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-6 space-y-4">
        <SectionCard title="Agent yang closing" subtitle="Profil singkat">
          <div className="grid gap-3">
            <Field label="Nama agent" value={agent?.nama ?? "-"} />
            <Field label="ID agent" value={agent?.id_agent ?? "-"} />
            <Field label="Kantor" value={agent?.kantor ?? "-"} />
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-6 space-y-4">
        <SectionCard title="Team Leader" subtitle="Atasan/leader agent">
          <div className="grid gap-3">
            <Field label="Nama TL" value={leader?.nama ?? "-"} />
            <Field label="ID TL" value={leader?.id_agent ?? (agent?.team_leader_id ?? "-")} />
            <Field label="Kantor TL" value={leader?.kantor ?? "-"} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}