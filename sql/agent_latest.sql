SELECT
  data_month,
  employee_id,
  executive_name,
  email,
  doj,
  manager
FROM
  `vyapar_data.ib_platform_agent_detail_logs`
QUALIFY
  ROW_NUMBER() OVER (
    PARTITION BY employee_id
    ORDER BY snapshot_week DESC, snapshot_at DESC
  ) = 1
  AND is_weekly_active = TRUE;
