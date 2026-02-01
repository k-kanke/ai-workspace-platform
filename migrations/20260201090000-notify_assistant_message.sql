-- Notify on assistant message insert tied to a run

CREATE OR REPLACE FUNCTION notify_assistant_message() RETURNS trigger AS $$
DECLARE
  payload text;
BEGIN
  IF NEW.role = 'assistant' AND NEW.run_id IS NOT NULL THEN
    payload := json_build_object(
      'run_id', NEW.run_id,
      'thread_id', NEW.thread_id,
      'message_id', NEW.id
    )::text;
    PERFORM pg_notify('assistant_message', payload);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_notify_assistant ON messages;
CREATE TRIGGER messages_notify_assistant
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_assistant_message();

