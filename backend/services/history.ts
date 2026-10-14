import { db } from '../db.js';

export const logTaskHistory = async (
  taskId: number | string,
  userId: number | string,
  username: string,
  changeType: string,
  oldValue: string | null = null,
  newValue: string | null = null
) => {
  try {
    const nowIso = new Date().toISOString();
    await db.run(
      'INSERT INTO task_history (task_id, user_id, username, change_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [parseInt(taskId.toString()), parseInt(userId.toString()), username, changeType, oldValue, newValue, nowIso]
    );
  } catch (err) {
    console.error('Error logging task history:', err);
  }
};
