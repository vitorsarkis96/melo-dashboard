module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.CLICKUP_TOKEN;
  if (!token) return res.status(500).json({ error: "Token não configurado" });

  // ATUALIZAR STATUS
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { taskId, status } = body;
      const r = await fetch("https://api.clickup.com/api/v2/task/" + taskId, {
        method: "PUT",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const d = await r.json();
      return res.status(200).json({ ok: true, task: d });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // BUSCAR DADOS
  try {
    const teamRes = await fetch("https://api.clickup.com/api/v2/team", {
      headers: { Authorization: token }
    });
    const teamData = await teamRes.json();
    const teamId = teamData.teams?.[0]?.id;
    if (!teamId) return res.status(500).json({ error: "Time não encontrado" });

    // Busca tarefas ativas
    const tasksRes = await fetch(
      "https://api.clickup.com/api/v2/team/" + teamId + "/task?include_closed=false&page=0",
      { headers: { Authorization: token } }
    );
    const tasksData = await tasksRes.json();

    // Busca time tracking dos últimos 60 dias
    const since = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const timeRes = await fetch(
      "https://api.clickup.com/api/v2/team/" + teamId + "/time_entries?start_date=" + since + "&end_date=" + Date.now(),
      { headers: { Authorization: token } }
    );
    const timeData = await timeRes.json();

    // Agrupa tempo por task_id
    const timeByTask = {};
    (timeData.data || []).forEach(function(e) {
      const id = e.task && e.task.id;
      if (!id) return;
      timeByTask[id] = (timeByTask[id] || 0) + Number(e.duration || 0);
    });

    const now = Date.now();
    const tasks = (tasksData.tasks || []).map(function(t) {
      const due = t.due_date ? Number(t.due_date) : null;
      return {
        id: t.id,
        name: t.name,
        status: t.status ? t.status.status : "-",
        statusType: t.status ? t.status.type : "",
        client: t.folder ? t.folder.name : (t.list ? t.list.name : "-"),
        due: due,
        overdue: due && due < now,
        daysLate: due && due < now ? Math.ceil((now - due) / 86400000) : 0,
        assignees: (t.assignees || []).map(function(a) { return a.username; }),
        url: t.url,
        timeMs: timeByTask[t.id] || 0
      };
    });

    return res.status(200).json({ tasks: tasks, updatedAt: Date.now() });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
