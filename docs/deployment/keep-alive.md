# Keep-alive during assessment windows (RSK-001)
Render Free web services spin down after 15 minutes without inbound traffic and take up to about a
minute to spin back up; Neon Free compute suspends after 5 minutes idle and resumes in a few hundred ms.
`GET /healthz` runs `SELECT 1`, so one ping warms both. Ping every ~10 minutes ONLY inside declared
demo/assessment windows (a scheduled GitHub Actions workflow or an external uptime monitor), because
an always-on service consumes the 750 free instance hours/month.
