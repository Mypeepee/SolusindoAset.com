BEGIN;
ALTER TABLE public.booking_survei ADD COLUMN IF NOT EXISTS chatbot_request_id varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS booking_survei_chatbot_request_unik ON public.booking_survei (chatbot_request_id);
COMMIT;
