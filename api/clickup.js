export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.CLICKUP_TOKEN;
  if (!token) return res.status(500).json({ error: "Token não configurado" });

  try {
    const teamRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: token }
    });
    const teamData = await teamRes.json();
    const teamId = teamData.teams?.[0]?.id;
    if (!teamId) return res.status(500).json({ error: "Time não encontrado" });

    const tasksRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?include_closed=false&page=0`,
      { headers: { Authorization: token } }
    );
    const tasksData = await tasksRes.json();

    const tasks = (tasksData.tasks || []).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status?.status || "—",
      client: t.folder?.name || t.list?.name || "—",
      due: t.due_date ? Number(t.due_date) : null,
      assignees: (t.assignees || []).map(a => a.username),
      url: t.url,
    }));

    return res.status(200).json({ tasks, updatedAt: Date.now() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
